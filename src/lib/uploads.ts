import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { ApiError } from "./api";

export const maxImageBytes = 10 * 1024 * 1024;
export const uploadDirectory = () => process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");

export async function saveImage(request: Request) {
  if (!/^image\/(png|jpeg|webp|gif|avif)(?:;|$)/i.test(request.headers.get("content-type") || "")) throw new ApiError(415, "支持 JPG、PNG、WebP、GIF 和 AVIF 图片");
  if (Number(request.headers.get("content-length")) > maxImageBytes) throw new ApiError(413, "图片不能超过 10 MB");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "请选择图片");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxImageBytes) { void reader.cancel(); throw new ApiError(413, "图片不能超过 10 MB"); }
    chunks.push(value);
  }
  let output: Buffer;
  try {
    const input = Buffer.concat(chunks);
    const metadata = await sharp(input, { limitInputPixels: 40000000 }).metadata();
    if (!["jpeg", "png", "webp", "gif", "heif"].includes(metadata.format || "")) throw new Error("Unsupported image");
    // Decode and re-encode to strip metadata and active content. Animated inputs use their first frame.
    const isQr = new URL(request.url).searchParams.get("purpose") === "qr";
    const pipeline = sharp(input, { limitInputPixels: 40000000 }).rotate();
    // QR codes retain their original pixels and use lossless encoding for reliable scanning.
    output = isQr ? await pipeline.webp({ lossless: true }).toBuffer()
      : await pipeline.resize({ width: 2560, height: 2560, fit: "inside", withoutEnlargement: true }).webp({ quality: 88 }).toBuffer();
  } catch { throw new ApiError(400, "图片无法读取或尺寸过大，请换一张图片（最多 4000 万像素）"); }
  const directory = uploadDirectory();
  await mkdir(directory, { recursive: true });
  const filename = `${randomUUID()}.webp`;
  await writeFile(path.join(directory, filename), output, { flag: "wx", mode: 0o644 });
  return { url: `/uploads/${filename}` };
}
