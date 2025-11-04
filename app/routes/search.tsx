import type { LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { searchMedia } from "~/utils/search.server";
import { getUser } from "~/utils/session.server";
import { getUserFromRequestWithApiKey } from "~/utils/api-keys.server";

/**
 * Simple Search Endpoint
 * Alternative to /_matrix/media/search for easier querying
 *
 * Requires authentication via session or API key
 *
 * Returns public media items with MXC URIs for use in Matrix clients
 *
 * Query Parameters:
 *   - q: Search query (searches labels/tags)
 *   - limit: Maximum number of results (default: 20, max: 50)
 *
 * Authentication:
 *   - Session cookie (logged in user)
 *   - API key via "Authorization: Bearer gbl_xxx" or "X-Api-Key: gbl_xxx"
 *
 * Example: /search?q=cat&limit=10
 */
export async function loader({ request }: LoaderArgs) {
  // Check authentication - either session or API key
  const user = await getUserFromRequestWithApiKey(request, () => getUser(request));

  if (!user) {
    return json(
      { error: "Unauthorized. Please log in or provide a valid API key." },
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "WWW-Authenticate": 'Bearer realm="Gifable API", charset="UTF-8"',
        },
      }
    );
  }

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
