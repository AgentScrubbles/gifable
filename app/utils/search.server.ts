import { db } from "~/utils/db.server";
import { getMxcUri } from "~/utils/media.server";
import envServer from "~/utils/env.server";

/**
 * Search public media items
 * Used by both /search and /_matrix/media/search endpoints
 */
export async function searchMedia(query: string, limit: number) {
  // Build the where clause - only search public media
  const where: any = { isPublic: true };

  if (query.trim()) {
    where.labels = { contains: query.trim() };
  }

  // Query the database
  const results = await db.media.findMany({
    where,
    select: {
      id: true,
      url: true,
      thumbnailUrl: true,
      labels: true,
      width: true,
      height: true,
      altText: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const appUrl = envServer.appUrl;

  // Transform results to Matrix-compatible format
  const transformedResults = results.map((item) => {
    const mxcUri = getMxcUri(item.id);

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

      // Thumbnail - uses the SAME MXC URI (Matrix uses different endpoints, not different URIs)
      thumbnail_mxc: mxcUri,
      thumbnail_info: {
        w: item.width,
        h: item.height,
        mimetype: "image/jpeg", // Thumbnails are typically JPEG
      },

      // Additional metadata for compatibility
      tags: item.labels ? item.labels.split(",").map((t) => t.trim()) : [],

      // Simple HTTP URLs for direct access (for clients that don't support MXC yet)
      http_url: `${appUrl}/media/${item.id}/image`,
      thumbnail_url: `${appUrl}/media/${item.id}/thumbnail`,
    };
  });

  return {
    results: transformedResults,
    count: transformedResults.length,
    query: query,
  };
}
