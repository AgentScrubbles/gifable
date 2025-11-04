import type { LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { searchMedia } from "~/utils/search.server";
import { getUserIdFromRequestWithApiKey } from "~/utils/api-keys.server";
import { getUserId } from "~/utils/session.server";

/**
 * Simple search endpoint for public media
 * Supports authentication via session or API key
 * Query params:
 *   - q or query: search query
 *   - limit: max results (default 50, max 100)
 *   - api_key: optional API key for authentication
 */
export async function loader({ request }: LoaderArgs) {
  // Try to authenticate (session or API key)
  // Note: This endpoint works without auth but may return different results
  const userId = await getUserIdFromRequestWithApiKey(request, () =>
    getUserId(request)
  );

  const url = new URL(request.url);
  const query = url.searchParams.get("q") || url.searchParams.get("query") || "";
  const limitParam = url.searchParams.get("limit");
  let limit = 50; // default

  if (limitParam) {
    const parsed = parseInt(limitParam, 10);
    if (!isNaN(parsed) && parsed > 0) {
      limit = Math.min(parsed, 100); // max 100
    }
  }

  const results = await searchMedia(query, limit);

  return json(results, {
    headers: {
      "Content-Type": "application/json",
      // Add CORS headers for easy external access
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Api-Key",
    },
  });
}

// Handle OPTIONS for CORS preflight
export async function action({ request }: LoaderArgs) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Api-Key",
      },
    });
  }

  return json({ error: "Method not allowed" }, { status: 405 });
}
