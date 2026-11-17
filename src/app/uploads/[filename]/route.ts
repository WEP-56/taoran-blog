import { readFile } from "node:fs/promises";
import path from "node:path";
import { uploadDirectory } from "@/lib/uploads";

export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ filename: string }> }) {
  const { filename } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/.test(filename)) return new Response(null, { status: 404 });
  try {
    const bytes = await readFile(path.join(uploadDirectory(), filename));
    return new Response(new Uint8Array(bytes), { headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Response(null, { status: 404 });
    console.error("Image read failed", error);
    return new Response(null, { status: 503 });
  }
}
