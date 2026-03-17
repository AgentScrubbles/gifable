import type { ActionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { requireUserId } from "~/utils/session.server";

async function callCfAi(
  accountId: string,
  apiToken: string,
  model: string,
  prompt: string
): Promise<{ ok: boolean; data: any; status: number }> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: prompt }],
      max_tokens: 10,
    }),
    signal: controller.signal,
  });

  clearTimeout(timeoutId);
  const data = await response.json();
  return { ok: response.ok, data, status: response.status };
}

function getModelAgreementError(data: any): string | null {
  const errors = data?.errors || [];
  const agreementError = errors.find(
    (e: any) => typeof e.message === "string" && e.message.includes("Model Agreement")
  );
  return agreementError?.message || null;
}

export async function action({ request }: ActionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  await requireUserId(request);

  const formData = await request.formData();
  const cfAccountId = (formData.get("cfAccountId") as string)?.trim();
  const cfApiToken = (formData.get("cfApiToken") as string)?.trim();
  const cfAiModel = (formData.get("cfAiModel") as string) || "@cf/meta/llama-3.2-11b-vision-instruct";
  const acceptAgreement = formData.get("acceptAgreement") === "true";

  if (!cfAccountId || !cfApiToken) {
    return json({ success: false, error: "Account ID and API Token are required" });
  }

  try {
    // If user is explicitly accepting the agreement, send agree using the prompt field
    if (acceptAgreement) {
      const url = `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/ai/run/${cfAiModel}`;
      await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfApiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: "agree" }),
      });
    }

    const result = await callCfAi(cfAccountId, cfApiToken, cfAiModel, "Say 'hello' in one word.");

    if (!result.ok) {
      const agreementMsg = getModelAgreementError(result.data);
      if (agreementMsg) {
        return json({ success: false, needsAgreement: true, agreementMessage: agreementMsg });
      }

      const cfErrors = result.data?.errors?.map((e: any) => e.message).join(", ");
      return json({ success: false, error: cfErrors || `API returned ${result.status}` });
    }

    if (result.data?.result?.response) {
      return json({ success: true });
    }

    return json({ success: false, error: "Unexpected response from Cloudflare AI" });
  } catch (error: any) {
    if (error.name === "AbortError") {
      return json({ success: false, error: "Request timed out" });
    }
    return json({ success: false, error: error.message });
  }
}
