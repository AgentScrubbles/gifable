import type { LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { db } from "~/utils/db.server";
import { storage } from "~/utils/s3-storage.server";
import envServer from "~/utils/env.server";
import { isGiphyId, extractGiphyId } from "~/utils/giphy.server";
import { fetchGiphyImage } from "~/utils/giphy-fetch.server";
import { trackMediaView } from "~/utils/analytics.server";

/**
 * Matrix Media Thumbnail Endpoint
 * Implements: https://spec.matrix.org/latest/client-server-api/#get_matrixmediav3thumbnailservernamemediaid
 *
 * This endpoint allows Matrix homeservers to download thumbnails from this Gifable instance.
 * Similar to the download endpoint, but serves thumbnails instead of full images.
 *
 * Supports two modes:
 * - Redirect mode (allow_redirect=true): Returns 308 redirect to S3 thumbnail URL (or Giphy URL)
 * - Proxy mode (allow_redirect=false): Streams thumbnail content through the server
 *
 * Also supports Giphy IDs (prefixed with "giphy_") - these are always proxied to comply with federation
 */
export async function loader({ request, params }: LoaderArgs) {
  const { serverName, mediaId } = params;

  // Track view asynchronously (don't await) - Matrix views are "federation" type
  const userAgent = request.headers.get("User-Agent") || undefined;
  trackMediaView(mediaId!, undefined, userAgent, "federation");

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

  // Handle Giphy IDs - these are always proxied for Matrix federation
  if (isGiphyId(mediaId)) {
    const giphyId = extractGiphyId(mediaId);

    // Find any user with a Giphy API key for federation proxying
    // (Matrix federation is public, so we use any available key)
    const userWithKey = await db.user.findFirst({
      where: {
        giphyApiKey: { not: null },
      },
      select: { giphyApiKey: true },
    });

    if (!userWithKey?.giphyApiKey) {
      return json(
        {
          errcode: "M_NOT_FOUND",
          error: "Giphy integration not available",
        },
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Fetch and return Giphy thumbnail
    try {
      const imageResponse = await fetchGiphyImage(userWithKey.giphyApiKey, giphyId, "thumbnail");

      // Return the thumbnail with proper headers
      return new Response(imageResponse.body, {
        headers: {
          "Content-Type": imageResponse.headers.get("Content-Type") || "image/gif",
          "Cache-Control": "public, max-age=86400",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (error) {
      console.error("Error fetching Giphy thumbnail:", error);
      return json(
        {
          errcode: "M_UNKNOWN",
          error: "Failed to fetch Giphy thumbnail",
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

  // Look up local media
  const media = await db.media.findUnique({
    where: { id: mediaId },
  });

  if (!media) {
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
  if (!media.isPublic) {
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
  const thumbnailUrl = media.thumbnailUrl || media.url;

  // Check if client supports redirects
  const url = new URL(request.url);
  const allowRedirect = url.searchParams.get("allow_redirect") !== "false";

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

  // If redirect is allowed, return 308 redirect to S3 URL
  if (allowRedirect) {
    return new Response(null, {
      status: 308,
      headers: {
        "Location": thumbnailUrl,
        "Cache-Control": "public, max-age=86400",
      },
    });
  }

  // Otherwise, proxy the content through our server
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
