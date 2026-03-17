import type { ActionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { db } from "~/utils/db.server";
import { requireUserId } from "~/utils/session.server";
import { generateImageMetadata, isAltTextEnabled } from "~/utils/alt-text.server";
import { storage } from "~/utils/s3-storage.server";

export async function action({ params, request }: ActionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const userId = await requireUserId(request);

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { cfAccountId: true, cfApiToken: true, cfAiModel: true },
  });

  if (!user || !isAltTextEnabled(user)) {
    return json({ error: "Alt text generation is not configured. Add your Cloudflare credentials in Settings." }, 501);
  }

  const media = await db.media.findFirst({
    where: { id: params.mediaId, userId },
    select: { thumbnailUrl: true, url: true },
  });

  if (!media) {
    return json({ error: "Media not found" }, 404);
  }

  const imageUrl = media.thumbnailUrl || media.url;
  const s3 = storage();
  const filename = s3.getFilenameFromURL(imageUrl);
  if (!filename) {
    return json({ error: "Invalid media URL" }, 500);
  }
  const minioClient = (s3 as any).minioClient;
  const bucket = (s3 as any).bucket;
  const filePath = s3.makeFilePath(filename);
  const stream = await minioClient.getObject(bucket, filePath);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);

  const result = await generateImageMetadata(user, buffer);

  if (!result.altText && !result.labels) {
    return json({ error: "Failed to generate metadata. Check your Cloudflare credentials in Settings." }, 500);
  }

  return json({ altText: result.altText, labels: result.labels });
}
