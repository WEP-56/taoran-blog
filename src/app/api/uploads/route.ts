import { api, rateLimit } from "@/lib/api";
import { saveImage } from "@/lib/uploads";

export const runtime = "nodejs";
export const POST = api(async (request: Request) => {
  await rateLimit(request, "image-upload", 60, 600);
  return Response.json(await saveImage(request), { status: 201 });
}, { binary: true });
