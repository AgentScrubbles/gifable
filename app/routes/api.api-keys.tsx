import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { eq, and, desc } from "drizzle-orm";
import { db } from "~/utils/db.server";
import { apiKeys } from "~/db/schema";
import { requireUser } from "~/utils/session.server";
import { generateApiKey, isApiKeyFeatureEnabled } from "~/utils/api-keys.server";

/**
 * GET /api/api-keys - List all API keys for the current user
 */
export async function loader({ request }: LoaderFunctionArgs) {
  if (!isApiKeyFeatureEnabled()) {
    return json({ error: "API key feature is disabled" }, { status: 403 });
  }

  const user = await requireUser(request);

  const keys = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      key: apiKeys.key,
      enabled: apiKeys.enabled,
      createdAt: apiKeys.createdAt,
      lastUsedAt: apiKeys.lastUsedAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.userId, user.id))
    .orderBy(desc(apiKeys.createdAt));

  return json({ keys });
}

/**
 * POST /api/api-keys - Create, disable, enable, or delete API keys
 */
export async function action({ request }: ActionFunctionArgs) {
  if (!isApiKeyFeatureEnabled()) {
    return json({ error: "API key feature is disabled" }, { status: 403 });
  }

  const user = await requireUser(request);
  const formData = await request.formData();
  const action = formData.get("action");

  // CREATE new API key
  if (action === "create") {
    const name = formData.get("name")?.toString() || null;
    const key = generateApiKey();

    const [newKey] = await db
      .insert(apiKeys)
      .values({
        userId: user.id,
        key,
        name,
        enabled: true,
      })
      .returning();

    return json({
      success: true,
      key: newKey,
      message: "API key created successfully"
    });
  }

  // DISABLE API key
  if (action === "disable") {
    const keyId = formData.get("keyId")?.toString();
    if (!keyId) {
      return json({ error: "Key ID is required" }, { status: 400 });
    }

    await db
      .update(apiKeys)
      .set({ enabled: false })
      .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, user.id)));

    return json({ success: true, message: "API key disabled successfully" });
  }

  // ENABLE API key
  if (action === "enable") {
    const keyId = formData.get("keyId")?.toString();
    if (!keyId) {
      return json({ error: "Key ID is required" }, { status: 400 });
    }

    await db
      .update(apiKeys)
      .set({ enabled: true })
      .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, user.id)));

    return json({ success: true, message: "API key enabled successfully" });
  }

  // DELETE API key
  if (action === "delete") {
    const keyId = formData.get("keyId")?.toString();
    if (!keyId) {
      return json({ error: "Key ID is required" }, { status: 400 });
    }

    await db
      .delete(apiKeys)
      .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, user.id)));

    return json({ success: true, message: "API key deleted successfully" });
  }

  return json({ error: "Invalid action" }, { status: 400 });
}
