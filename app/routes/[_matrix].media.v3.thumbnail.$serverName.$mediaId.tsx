import type { LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { db } from "~/utils/db.server";
import { media } from "~/db/schema";
import { eq } from "drizzle-orm";
import { storage } from "~/utils/s3-storage.server";
import envServer from "~/utils/env.server";

/**
 * Matrix Media Thumbnail Endpoint
 * Implements: https://spec.matrix.org/latest/client-server-api/#get_matrixmediav3thumbnailservernamemediaid
 *
 * This endpoint allows Matrix homeservers to download thumbnails from this Gifable instance.
 * Similar to the download endpoint, but serves thumbnails instead of full images.
 *
 * Supports two modes:
 * - Redirect mode (allow_redirect=true): Returns 308 redirect to S3 thumbnail URL
 * - Proxy mode (allow_redirect=false): Streams thumbnail content through the server
 */
export async function loader({ request, params }: LoaderArgs) {
  const { serverName, mediaId } = params;

  // Validate server name matches our instance
  const appUrl = envServer.appUrl;
  const expectedServerName = new URL(appUrl).hostname;

  if (serverName !== expectedServerName) {
    return json(
      {
        errcode: "M_NOT_FOUND",
        error: `This server (${expectedServerName}) does not serve media for ${serverName}`,
      },
      {
        status: 404,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }

  // Validate mediaId is provided
  if (!mediaId) {
    return json(
      {
        errcode: "M_NOT_FOUND",
        error: "Media ID is required",
      },
      {
        status: 404,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }

  // Look up the media
  const mediaItem = await db.query.media.findFirst({
    where: eq(media.id, mediaId),
  });

  if (!mediaItem) {
    return json(
      {
        errcode: "M_NOT_FOUND",
        error: "Media not found",
      },
      {
        status: 404,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }

  // Matrix federation should only serve public media
  if (!mediaItem.isPublic) {
    return json(
      {
        errcode: "M_NOT_FOUND",
        error: "Media not found",
      },
      {
        status: 404,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }

  // Use thumbnail URL if available, otherwise use original image
  const thumbnailUrl = mediaItem.thumbnailUrl || mediaItem.url;

  // Get the S3 storage client
  const s3 = storage();
  const filename = s3.getFilenameFromURL(thumbnailUrl);

  if (!filename) {
    return json(
      {
        errcode: "M_UNKNOWN",
        error: "Invalid media URL",
      },
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }

  // Determine content type
  const ext = filename.split('.').pop()?.toLowerCase();
  const contentType = ext === 'gif' ? 'image/gif' :
                     ext === 'png' ? 'image/png' :
                     'image/jpeg';

  // Proxy the content through our server (no redirects for Matrix compatibility)
  const minioClient = (s3 as any).minioClient;
  const bucket = (s3 as any).bucket;
  const filePath = s3.makeFilePath(filename);

  try {
    const stream = await minioClient.getObject(bucket, filePath);

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
    console.error("Error fetching thumbnail from S3:", error);
    return json(
      {
        errcode: "M_UNKNOWN",
        error: "Failed to fetch thumbnail",
      },
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}
