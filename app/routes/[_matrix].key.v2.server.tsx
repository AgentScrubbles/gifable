import type { LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import envServer from "~/utils/env.server";

/**
 * Matrix Server Keys Endpoint
 * Implements: https://spec.matrix.org/latest/server-server-api/#publishing-keys
 *
 * This endpoint publishes the server's signing keys for federation.
 * For a media-only server, we provide a minimal implementation.
 *
 * NOTE: This is a minimal stub to satisfy federation discovery.
 * We don't actually sign federation requests since we're media-only.
 */
export async function loader({ request }: LoaderArgs) {
  const appUrl = envServer.appUrl;
  const serverName = new URL(appUrl).hostname;

  // Generate a stable "key ID" based on server name
  // This isn't a real signing key since we're not doing actual federation
  const keyId = `ed25519:${serverName.replace(/\./g, "_")}`;

  return json(
    {
      server_name: serverName,
      old_verify_keys: {},
      valid_until_ts: Date.now() + (365 * 24 * 60 * 60 * 1000), // Valid for 1 year
      verify_keys: {
        [keyId]: {
          key: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=", // Dummy key
        },
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
