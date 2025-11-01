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

  // Use a valid Ed25519 public key for testing
  // This is a dummy key - we don't actually sign anything since we're media-only
  // Generated from: crypto.generateKeyPairSync('ed25519').publicKey.export({type: 'spki', format: 'der'})
  // then extracted the 32-byte public key portion and base64-encoded it
  const dummyKey = "nH3NPI3L3xDldc4FRN+RIjMEtWLhOTfaZ1xtO1zkJ2w=";

  return json(
    {
      server_name: serverName,
      old_verify_keys: {},
      valid_until_ts: Date.now() + (365 * 24 * 60 * 60 * 1000), // Valid for 1 year
      verify_keys: {
        "ed25519:auto": {
          key: dummyKey,
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
