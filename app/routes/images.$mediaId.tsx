import type { LoaderArgs } from "@remix-run/node";
import { notFound } from "remix-utils";
import { db } from "~/utils/db.server";
import { media } from "~/db/schema";
import { eq } from "drizzle-orm";
import { storage } from "~/utils/s3-storage.server";

/**
 * Simple image endpoint for direct access
 * Returns the full-size image with CORS headers
 * Only serves public media (no authentication required)
 */
export async function loader({ request, params }: LoaderArgs) {
  const mediaItem = await db.query.media.findFirst({
    where: eq(media.id, params.mediaId),
  });

  if (!mediaItem) {
    throw notFound({ message: "Media not found" });
  }

  // Only serve public media
  if (!mediaItem.isPublic) {
    throw notFound({ message: "Media not found" });
  }

  // Get the filename from the URL
  const s3 = storage();
  const filename = s3.getFilenameFromURL(mediaItem.url);

  if (!filename) {
    throw new Error("Invalid media URL");
  }

  // Get the object from S3
  const minioClient = (s3 as any).minioClient;
  const bucket = (s3 as any).bucket;
  const filePath = s3.makeFilePath(filename);

  try {
    const stream = await minioClient.getObject(bucket, filePath);

    // Determine content type from URL
    const ext = filename.split('.').pop()?.toLowerCase();
    const contentType = ext === 'gif' ? 'image/gif' :
                       ext === 'png' ? 'image/png' :
                       ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
                       'application/octet-stream';

    // Convert stream to buffer
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    return new Response(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Error fetching from S3:", error);
    throw new Error("Failed to fetch media");
  }
}
