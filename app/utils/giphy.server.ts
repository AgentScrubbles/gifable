import { LRUCache } from "lru-cache";
import ms from "ms";

const GIPHY_API_BASE = "https://api.giphy.com/v1/gifs";

// Memory cache for Giphy search results (15 min TTL)
declare global {
  var giphySearchCache: LRUCache<string, any>;
}

global.giphySearchCache =
  global.giphySearchCache ||
  new LRUCache<string, any>({
    max: 100,
    ttl: ms("15m"),
  });

/**
 * Check if an ID is a Giphy ID (prefixed with "giphy_")
 */
export function isGiphyId(id: string): boolean {
  return id.startsWith("giphy_");
}

/**
 * Extract the Giphy ID from our prefixed format
 * Example: "giphy_abc123" => "abc123"
 */
export function extractGiphyId(id: string): string {
  if (!isGiphyId(id)) {
    throw new Error(`Not a Giphy ID: ${id}`);
  }
  return id.substring(6); // Remove "giphy_" prefix
}

/**
 * Add our prefix to a Giphy ID
 * Example: "abc123" => "giphy_abc123"
 */
export function addGiphyPrefix(giphyId: string): string {
  return `giphy_${giphyId}`;
}

/**
 * Search Giphy API
 */
export async function searchGiphy(
  apiKey: string,
  query: string,
  limit: number = 25,
  offset: number = 0
): Promise<any> {
  const cacheKey = `search:${query}:${limit}:${offset}`;
  const cached = global.giphySearchCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const url = new URL(`${GIPHY_API_BASE}/search`);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", limit.toString());
  url.searchParams.set("offset", offset.toString());
  url.searchParams.set("rating", "g"); // Keep it family-friendly by default

  const response = await fetch(url.toString());

  if (!response.ok) {
    console.error(`Giphy API error: ${response.status} ${response.statusText}`);
    throw new Error(`Giphy API returned ${response.status}`);
  }

  const data = await response.json();

  // Cache the result
  global.giphySearchCache.set(cacheKey, data);

  return data;
}

/**
 * Get a single GIF by Giphy ID
 */
export async function getGiphyGif(apiKey: string, giphyId: string): Promise<any> {
  const cacheKey = `gif:${giphyId}`;
  const cached = global.giphySearchCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const url = new URL(`${GIPHY_API_BASE}/${giphyId}`);
  url.searchParams.set("api_key", apiKey);

  const response = await fetch(url.toString());

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    console.error(`Giphy API error: ${response.status} ${response.statusText}`);
    throw new Error(`Giphy API returned ${response.status}`);
  }

  const result = await response.json();

  // Cache the result
  global.giphySearchCache.set(cacheKey, result.data);

  return result.data;
}

/**
 * Transform Giphy GIF object to match Gifable format
 */
export function transformGiphyToGifable(giphyGif: any): any {
  // Use original for full size, downsized_medium for thumbnails
  const original = giphyGif.images?.original;
  const thumbnail = giphyGif.images?.downsized_medium || giphyGif.images?.fixed_width;

  return {
    id: addGiphyPrefix(giphyGif.id),
    url: original?.url || giphyGif.url,
    thumbnailUrl: thumbnail?.url || original?.url,
    labels: giphyGif.title || "",
    altText: giphyGif.alt_text || giphyGif.title || "",
    width: parseInt(original?.width || "0", 10) || null,
    height: parseInt(original?.height || "0", 10) || null,
    color: null,
    size: parseInt(original?.size || "0", 10) || null,
    isPublic: true,
    // Giphy-specific metadata
    _giphy: {
      id: giphyGif.id,
      slug: giphyGif.slug,
      rating: giphyGif.rating,
      source: "giphy",
      images: {
        original_url: original?.url,
        thumbnail_url: thumbnail?.url,
      },
    },
  };
}

/**
 * Get image URL from Giphy GIF object
 */
export function getGiphyImageUrl(giphyGif: any, type: "original" | "thumbnail"): string {
  if (type === "thumbnail") {
    // Prefer downsized_medium for thumbnails (good balance of size/quality)
    return (
      giphyGif.images?.downsized_medium?.url ||
      giphyGif.images?.fixed_width?.url ||
      giphyGif.images?.original?.url ||
      giphyGif.url
    );
  }

  // For original, use the highest quality
  return giphyGif.images?.original?.url || giphyGif.url;
}
