import type { LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { notFound } from "remix-utils";
import { db } from "~/utils/db.server";
import { media } from "~/db/schema";
import { eq } from "drizzle-orm";
import { storage } from "~/utils/s3-storage.server";
import envServer from "~/utils/env.server";

/**
 * Matrix Client API - Media Download Endpoint
 * Implements: https://spec.matrix.org/latest/client-server-api/#get_matrixclientv1mediadownloadservernamemediaid
 *
 * This endpoint allows Matrix clients (via their homeserver) to download media.
 * For PUBLIC media, we don't require authentication.
 *
 * The media ID is the Gifable media UUID, embedded in MXC URIs as:
 * mxc://<server-name>/<media-id>
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

  // Only serve public media (no authentication required for public content)
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

  // Get the S3 storage client
  const s3 = storage();
  const filename = s3.getFilenameFromURL(mediaItem.url);

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

  // Determine content type from URL
  const ext = filename.split('.').pop()?.toLowerCase();
  const contentType = ext === 'gif' ? 'image/gif' :
                     ext === 'png' ? 'image/png' :
                     ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
                     'application/octet-stream';

  // Proxy the content through our server
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
    console.error("Error fetching from S3:", error);
    return json(
      {
        errcode: "M_UNKNOWN",
        error: "Failed to fetch media",
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
