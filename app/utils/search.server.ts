import { db } from "~/utils/db.server";
import { getMxcUri } from "~/utils/media.server";
import envServer from "~/utils/env.server";
import { searchGiphy, transformGiphyToGifable } from "~/utils/giphy.server";

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

/**
 * Search with external sources (Giphy) if enabled
 */
export async function searchWithExternal(
  query: string,
  limit: number,
  giphyApiKey?: string | null
): Promise<{
  results: any[];
  count: number;
  query: string;
  powered_by_giphy?: boolean;
  attribution?: {
    source: string;
    required_text: string;
  };
}> {
  // Always search local Gifable media
  const localResults = await searchMedia(query, limit);

  // If no Giphy API key, return only local results
  if (!giphyApiKey) {
    return localResults;
  }

  // Search Giphy
  let giphyResults: any[] = [];
  let giphyError = false;

  try {
    const giphyResponse = await searchGiphy(giphyApiKey, query, limit);
    giphyResults = giphyResponse.data.map((gif: any) => {
      const transformed = transformGiphyToGifable(gif);
      const mxcUri = getMxcUri(transformed.id);
      const appUrl = envServer.appUrl;

      return {
        id: transformed.id,
        mxc: mxcUri,
        body: transformed.altText || transformed.labels || "GIF",
        info: {
          w: transformed.width,
          h: transformed.height,
          mimetype: "image/gif",
          size: transformed.size || 0,
        },
        thumbnail_mxc: mxcUri,
        thumbnail_info: {
          w: transformed.width,
          h: transformed.height,
          mimetype: "image/gif",
        },
        tags: transformed.labels
          ? transformed.labels.split(",").map((t: string) => t.trim())
          : [],
        // Return Giphy's direct URLs for search (not proxied)
        http_url: transformed._giphy.images.original_url,
        thumbnail_url: transformed._giphy.images.thumbnail_url,
        // Keep proxy URLs as backup
        proxy_url: `${appUrl}/media/${transformed.id}/image`,
        proxy_thumbnail_url: `${appUrl}/media/${transformed.id}/thumbnail`,
      };
    });
  } catch (error) {
    console.error("Error searching Giphy:", error);
    giphyError = true;
  }

  // Combine results: local first, then Giphy
  const combinedResults = [...localResults.results, ...giphyResults];

  // Add attribution if Giphy results are included
  const response: any = {
    results: combinedResults,
    count: combinedResults.length,
    query: query,
  };

  if (giphyResults.length > 0) {
    response.powered_by_giphy = true;
    response.attribution = {
      source: "GIPHY",
      required_text: "Powered By GIPHY",
    };
  }

  return response;
}
