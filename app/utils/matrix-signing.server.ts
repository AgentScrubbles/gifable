import crypto from "node:crypto";

/**
 * Matrix Signing Utilities
 * Implements the Matrix signing algorithm for server keys
 * https://spec.matrix.org/v1.16/appendices/#signing-json
 */

// Fixed Ed25519 keypair for this server
// In production, this should be stored securely and persisted
// For now, we generate a deterministic key based on the server
const KEYPAIR_CACHE = new Map<string, crypto.KeyPairKeyObjectResult>();

/**
 * Get or generate an Ed25519 keypair for the server
 */
function getOrCreateKeypair(serverName: string): crypto.KeyPairKeyObjectResult {
  if (KEYPAIR_CACHE.has(serverName)) {
    return KEYPAIR_CACHE.get(serverName)!;
  }

  // Generate a new keypair
  const keypair = crypto.generateKeyPairSync('ed25519');
  KEYPAIR_CACHE.set(serverName, keypair);

  return keypair;
}

/**
 * Convert a key to unpadded base64 (Matrix format)
 */
function toUnpaddedBase64(buffer: Buffer): string {
  return buffer.toString('base64').replace(/=/g, '');
}

/**
 * Get the public key in Matrix format (unpadded base64)
 */
export function getPublicKey(serverName: string): string {
  const keypair = getOrCreateKeypair(serverName);
  const publicKeyDer = keypair.publicKey.export({ type: 'spki', format: 'der' });

  // Ed25519 public keys in SPKI format are 44 bytes total:
  // 12 bytes of ASN.1 header + 32 bytes of actual public key
  // We only want the last 32 bytes
  const publicKeyRaw = publicKeyDer.slice(-32);

  return toUnpaddedBase64(publicKeyRaw);
}

/**
 * Create canonical JSON for signing
 * https://spec.matrix.org/v1.16/appendices/#canonical-json
 *
 * Canonical JSON requirements:
 * 1. Remove 'signatures' and 'unsigned' fields
 * 2. Keys sorted lexicographically at ALL levels (recursively)
 * 3. Minimal whitespace (no spaces after : or ,)
 */
function canonicalJson(obj: any): string {
  // Recursively sort all object keys
  function sortKeys(value: any): any {
    if (value === null || value === undefined) {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map(sortKeys);
    }

    if (typeof value === 'object') {
      const sorted: any = {};
      // Sort keys lexicographically (Unicode codepoint order)
      Object.keys(value).sort().forEach(key => {
        sorted[key] = sortKeys(value[key]);
      });
      return sorted;
    }

    return value;
  }

  // Remove 'signatures' and 'unsigned' fields as per Matrix spec
  const { signatures, unsigned, ...rest } = obj;

  // Recursively sort all keys
  const sorted = sortKeys(rest);

  // Stringify with minimal whitespace (no spaces)
  return JSON.stringify(sorted);
}

/**
 * Sign a JSON object with the server's Ed25519 key
 */
export function signJson(serverName: string, obj: any): string {
  const keypair = getOrCreateKeypair(serverName);
  const canonical = canonicalJson(obj);

  // Sign with Ed25519
  const signature = crypto.sign(null, Buffer.from(canonical, 'utf8'), keypair.privateKey);

  return toUnpaddedBase64(signature);
}

/**
 * Sign the server keys response
 */
export function signServerKeys(serverName: string, response: any): any {
  const signature = signJson(serverName, response);

  return {
    ...response,
    signatures: {
      [serverName]: {
        "ed25519:auto": signature,
      },
    },
  };
}
