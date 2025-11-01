import type { LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import envServer from "~/utils/env.server";
import { getPublicKey, signServerKeys } from "~/utils/matrix-signing.server";

/**
 * Matrix Server Keys Endpoint
 * Implements: https://spec.matrix.org/latest/server-server-api/#publishing-keys
 *
 * This endpoint publishes the server's signing keys for federation.
 * The response is properly signed with an Ed25519 key.
 *
 * NOTE: For a media-only server, we generate and sign keys but don't use them
 * for actual federation request signing - we only serve media.
 */
export async function loader({ request }: LoaderArgs) {
  const appUrl = envServer.appUrl;
  const serverName = new URL(appUrl).hostname;

  // Get the public key for this server (generates keypair if needed)
  const publicKey = getPublicKey(serverName);

  // Create the unsigned response
  const unsignedResponse = {
    server_name: serverName,
    old_verify_keys: {},
    valid_until_ts: Date.now() + (365 * 24 * 60 * 60 * 1000), // Valid for 1 year
    verify_keys: {
      "ed25519:auto": {
        key: publicKey,
      },
    },
  };

  // Sign the response with our private key
  const signedResponse = signServerKeys(serverName, unsignedResponse);

  return json(
    signedResponse,
    {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}
