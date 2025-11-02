import type { LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { db } from "~/utils/db.server";
import { media } from "~/db/schema";
import { like, and, eq, desc } from "drizzle-orm";
import { getMxcUri } from "~/utils/media.server";
import envServer from "~/utils/env.server";

/**
 * Matrix Media Search Endpoint
 * Compatible with Matrix sticker picker widgets
 *
 * Returns public media items with MXC URIs for use in Matrix clients
 *
 * Query Parameters:
 *   - q: Search query (searches labels/tags)
 *   - limit: Maximum number of results (default: 20, max: 50)
 *
 * Example: /_matrix/media/search?q=cat&limit=10
 */
export async function loader({ request }: LoaderArgs) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") || "";
  const limitParam = url.searchParams.get("limit") || "20";
  const limit = Math.min(parseInt(limitParam, 10) || 20, 50); // Max 50 results

  // Build the where clause - only search public media
  const conditions = [eq(media.isPublic, true)];

  if (query.trim()) {
    conditions.push(like(media.labels, `%${query.trim()}%`));
  }

  const where = conditions.length > 1 ? and(...conditions) : conditions[0];

  // Query the database
  const results = await db.query.media.findMany({
    where,
    columns: {
      id: true,
      url: true,
      thumbnailUrl: true,
      labels: true,
      width: true,
      height: true,
      altText: true,
      createdAt: true,
    },
    orderBy: desc(media.createdAt),
    limit,
  });

  const appUrl = envServer.appUrl;
  const serverName = new URL(appUrl).hostname;

  // Transform results to Matrix-compatible format
  const transformedResults = results.map((item) => {
    const mxcUri = getMxcUri(item.id);

    // Create thumbnail MXC URI if thumbnail exists
    const thumbnailMxc = item.thumbnailUrl ? getMxcUri(item.id) + "/thumbnail" : mxcUri;

    return {
      // Matrix sticker picker format
      id: item.id,
      mxc: mxcUri,

      // Image metadata
      body: item.altText || item.labels || "GIF",
      info: {
        w: item.width,
        h: item.height,
        mimetype: "image/gif", // Most Gifable content is GIFs
        size: 0, // We don't store file size in this field currently
      },

      // Thumbnail
      thumbnail_mxc: thumbnailMxc,
      thumbnail_info: {
        w: item.width,
        h: item.height,
        mimetype: "image/jpeg", // Thumbnails are typically JPEG
      },

      // Additional metadata for compatibility
      tags: item.labels ? item.labels.split(",").map(t => t.trim()) : [],

      // HTTP URLs for direct access (optional, for clients that don't support MXC yet)
      http_url: `${appUrl}/_matrix/media/v3/download/${serverName}/${item.id}`,
      thumbnail_url: `${appUrl}/_matrix/media/v3/thumbnail/${serverName}/${item.id}`,
    };
  });

  return json({
    results: transformedResults,
    count: transformedResults.length,
    query: query,
  }, {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=60", // Cache for 1 minute
    },
  });
}
