import { randomBytes } from "crypto";
import { db } from "~/utils/db.server";
import type { User, ApiKey } from "@prisma/client";

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
    const apiKey = await db.apiKey.findUnique({
      where: { key, enabled: true },
      include: { user: true },
    });

    if (!apiKey) {
      return null;
    }

    // Update lastUsedAt timestamp asynchronously (don't await)
    db.apiKey
      .update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() },
      })
      .then()
      .catch((err) => {
        console.error("Failed to update API key lastUsedAt:", err);
      });

    return { user: apiKey.user, apiKeyId: apiKey.id };
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

/**
 * Create a new API key for a user
 */
export async function createApiKey({
  userId,
  name,
}: {
  userId: string;
  name: string;
}): Promise<ApiKey> {
  const key = generateApiKey();

  return db.apiKey.create({
    data: {
      key,
      name,
      userId,
    },
  });
}

/**
 * List all API keys for a user
 */
export async function listApiKeys(userId: string): Promise<ApiKey[]> {
  return db.apiKey.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Revoke (disable) an API key
 */
export async function revokeApiKey({
  id,
  userId,
}: {
  id: string;
  userId: string;
}): Promise<ApiKey> {
  // First verify the key belongs to this user
  const apiKey = await db.apiKey.findUnique({
    where: { id },
  });

  if (!apiKey || apiKey.userId !== userId) {
    throw new Error("API key not found or does not belong to user");
  }

  return db.apiKey.update({
    where: { id },
    data: { enabled: false },
  });
}

/**
 * Delete an API key permanently
 */
export async function deleteApiKey({
  id,
  userId,
}: {
  id: string;
  userId: string;
}): Promise<ApiKey> {
  // First verify the key belongs to this user
  const apiKey = await db.apiKey.findUnique({
    where: { id },
  });

  if (!apiKey || apiKey.userId !== userId) {
    throw new Error("API key not found or does not belong to user");
  }

  return db.apiKey.delete({
    where: { id },
  });
}
