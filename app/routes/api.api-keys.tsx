import type { ActionArgs, LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { requireUserId } from "~/utils/session.server";
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  deleteApiKey,
  isApiKeyFeatureEnabled,
} from "~/utils/api-keys.server";
import { unauthorized } from "remix-utils";

export async function loader({ request }: LoaderArgs) {
  if (!isApiKeyFeatureEnabled()) {
    throw unauthorized({ message: "API keys are disabled" });
  }

  const userId = await requireUserId(request);
  const apiKeys = await listApiKeys(userId);

  return json({ apiKeys });
}

export async function action({ request }: ActionArgs) {
  if (!isApiKeyFeatureEnabled()) {
    throw unauthorized({ message: "API keys are disabled" });
  }

  const userId = await requireUserId(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const name = formData.get("name");
    if (!name || typeof name !== "string") {
      return json({ error: "Name is required" }, { status: 400 });
    }

    const apiKey = await createApiKey({ userId, name });
    return json({ success: true, apiKey });
  }

  if (intent === "revoke") {
    const id = formData.get("id");
    if (!id || typeof id !== "string") {
      return json({ error: "ID is required" }, { status: 400 });
    }

    const apiKey = await revokeApiKey({ id, userId });
    return json({ success: true, apiKey });
  }

  if (intent === "delete") {
    const id = formData.get("id");
    if (!id || typeof id !== "string") {
      return json({ error: "ID is required" }, { status: 400 });
    }

    await deleteApiKey({ id, userId });
    return json({ success: true });
  }

  return json({ error: "Invalid intent" }, { status: 400 });
}
