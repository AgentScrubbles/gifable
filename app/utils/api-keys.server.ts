import { randomBytes } from "crypto";
import { eq, and } from "drizzle-orm";
import { db } from "~/utils/db.server";
import { apiKeys, users } from "~/db/schema";
import type { User } from "~/db/schema";

/**
 * Check if API key feature is enabled
 */
export function isApiKeyFeatureEnabled(): boolean {
  const enabled = process.env.ENABLE_API_KEYS ?? "true";
  return enabled === "true" || enabled === "1";
}

/**
 * Generate a new API key with the "gbl_" prefix
 */
export function generateApiKey(): string {
  const randomPart = randomBytes(32).toString("base64url");
  return `gbl_${randomPart}`;
}

/**
 * Extract API key from request headers
 * Supports both "Authorization: Bearer <key>" and "X-Api-Key: <key>" formats
 */
export function extractApiKeyFromRequest(request: Request): string | null {
  // Check Authorization header (Bearer token)
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    if (token.startsWith("gbl_")) {
      return token;
    }
  }

  // Check X-Api-Key header
  const apiKeyHeader = request.headers.get("X-Api-Key");
  if (apiKeyHeader?.startsWith("gbl_")) {
    return apiKeyHeader;
  }

  return null;
}

/**
 * Validate an API key and return the associated user if valid
 * Updates lastUsedAt timestamp on successful validation
 */
export async function validateApiKey(
  key: string
): Promise<{ user: User; apiKeyId: string } | null> {
  if (!isApiKeyFeatureEnabled()) {
    return null;
  }

  try {
    const result = await db
      .select({
        apiKey: apiKeys,
        user: users,
      })
      .from(apiKeys)
      .innerJoin(users, eq(apiKeys.userId, users.id))
      .where(and(eq(apiKeys.key, key), eq(apiKeys.enabled, true)))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const { apiKey, user } = result[0];

    // Update lastUsedAt timestamp asynchronously (don't await)
    db.update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, apiKey.id))
      .then()
      .catch((err) => {
        console.error("Failed to update API key lastUsedAt:", err);
      });

    return { user, apiKeyId: apiKey.id };
  } catch (error) {
    console.error("Error validating API key:", error);
    return null;
  }
}

/**
 * Get user from request - checks session first, then API key
 * This is a convenience function for routes that accept either auth method
 */
export async function getUserFromRequestWithApiKey(
  request: Request,
  getUserFromSession: () => Promise<User | null>
): Promise<User | null> {
  // First, try to get user from session
  const sessionUser = await getUserFromSession();
  if (sessionUser) {
    return sessionUser;
  }

  // If no session, try API key
  if (!isApiKeyFeatureEnabled()) {
    return null;
  }

  const apiKey = extractApiKeyFromRequest(request);
  if (!apiKey) {
    return null;
  }

  const result = await validateApiKey(apiKey);
  return result?.user ?? null;
}
