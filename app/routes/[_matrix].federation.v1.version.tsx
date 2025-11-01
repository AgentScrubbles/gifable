import type { LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

/**
 * Matrix Federation Version Endpoint
 * Implements: https://spec.matrix.org/latest/server-server-api/#get_matrixfederationv1version
 *
 * This endpoint returns the server's supported Matrix specification versions.
 * For a media-only server, we provide a minimal implementation.
 */
export async function loader({ request }: LoaderArgs) {
  return json(
    {
      server: {
        name: "Gifable Media Proxy",
        version: "1.0.0",
      },
    },
    {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}
