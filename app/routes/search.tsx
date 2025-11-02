import type { LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { searchMedia } from "~/utils/search.server";

/**
 * Simple Search Endpoint
 * Alternative to /_matrix/media/search for easier querying
 *
 * Returns public media items with MXC URIs for use in Matrix clients
 *
 * Query Parameters:
 *   - q: Search query (searches labels/tags)
 *   - limit: Maximum number of results (default: 20, max: 50)
 *
 * Example: /search?q=cat&limit=10
 */
export async function loader({ request }: LoaderArgs) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") || "";
  const limitParam = url.searchParams.get("limit") || "20";
  const limit = Math.min(parseInt(limitParam, 10) || 20, 50); // Max 50 results

  const data = await searchMedia(query, limit);

  return json(data, {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=60", // Cache for 1 minute
    },
  });
}
