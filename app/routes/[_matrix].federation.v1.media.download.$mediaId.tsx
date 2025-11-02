import type { LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { db } from "~/utils/db.server";
import { media } from "~/db/schema";
import { eq } from "drizzle-orm";
import { storage } from "~/utils/s3-storage.server";
import crypto from "crypto";

/**
 * Matrix Federation API - Media Download Endpoint
 * Implements: /_matrix/federation/v1/media/download/{mediaId}
 *
 * This is the server-to-server federation endpoint for media downloads.
 * Note: No serverName in path - federation requests are already directed at this server.
 *
 * Federation endpoints MUST return multipart/mixed responses with:
 * 1. Metadata part (JSON with Content-Type: application/json)
 * 2. Media part (binary data with appropriate image content type)
 *
 * Only serves public media.
 */

function createMultipartResponse(mediaBuffer: Buffer, contentType: string): Response {
  const boundary = crypto.randomBytes(16).toString('hex');

  // Build multipart response manually
  const parts: Buffer[] = [];

  // Part 1: Metadata (empty JSON object)
  parts.push(Buffer.from(`--${boundary}\r\n`));
  parts.push(Buffer.from(`Content-Type: application/json\r\n\r\n`));
  parts.push(Buffer.from(`{}\r\n`));

  // Part 2: Media data
  parts.push(Buffer.from(`--${boundary}\r\n`));
  parts.push(Buffer.from(`Content-Type: ${contentType}\r\n\r\n`));
  parts.push(mediaBuffer);
  parts.push(Buffer.from(`\r\n`));

  // End boundary
  parts.push(Buffer.from(`--${boundary}--\r\n`));

  const responseBody = Buffer.concat(parts);

  return new Response(responseBody, {
    headers: {
      "Content-Type": `multipart/mixed; boundary=${boundary}`,
      "Cache-Control": "public, max-age=86400",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
export async function loader({ request, params }: LoaderArgs) {
  const { mediaId } = params;

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

  // Only serve public media via federation
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

    // Return multipart/mixed response (required for federation endpoints)
    return createMultipartResponse(buffer, contentType);
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
