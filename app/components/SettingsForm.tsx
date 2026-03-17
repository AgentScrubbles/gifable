import type { User } from "@prisma/client";
import { json } from "@remix-run/node";
import { useFetcher } from "@remix-run/react";
import { withZod } from "@remix-validated-form/with-zod";
import { ValidatedForm, validationError } from "remix-validated-form";
import { z } from "zod";
import { db } from "~/utils/db.server";
import FormInput from "./FormInput";
import SubmitButton from "./SubmitButton";
import type { Theme } from "./ThemeStyles";

export const SETTINGS_INTENT = "settings";

const validator = withZod(
  z.object({
    intent: z.literal(SETTINGS_INTENT),
    preferredLabels: z.string().trim().toLowerCase(),
    theme: z.enum(["system", "light", "dark"]),
    giphyApiKey: z.string().trim().optional(),
    cfAccountId: z.string().trim().optional(),
    cfApiToken: z.string().trim().optional(),
    cfAiModel: z.string().optional(),
  })
);

export async function settingsAction({
  userId,
  form,
}: {
  userId: User["id"];
  form: FormData;
}) {
  const settingsResult = await validator.validate(form);

  if (settingsResult.error) {
    return validationError(settingsResult.error);
  }

  const { preferredLabels, theme, giphyApiKey, cfAccountId, cfApiToken, cfAiModel } = settingsResult.data;

  await db.user.update({
    where: { id: userId },
    data: {
      preferredLabels,
      theme,
      giphyApiKey: giphyApiKey || null,
      cfAccountId: cfAccountId || null,
      cfApiToken: cfApiToken || null,
      cfAiModel: cfAiModel || null,
    },
  });

  return json({ success: true, intent: SETTINGS_INTENT });
}

type SettingsDefaultValues = {
  preferredLabels: string;
  theme: Theme;
  giphyApiKey?: string;
  cfAccountId?: string;
  cfApiToken?: string;
  cfAiModel?: string;
};

export function SettingsForm({
  defaultValues,
}: {
  defaultValues: SettingsDefaultValues;
}) {
  const testFetcher = useFetcher<{
    success?: boolean;
    error?: string;
    needsAgreement?: boolean;
    agreementMessage?: string;
  }>();
  const isTesting = testFetcher.state !== "idle";

  const getFormValues = () => {
    const form = document.querySelector<HTMLFormElement>('form:has([name="cfAccountId"])');
    if (!form) return null;
    const formData = new FormData();
    formData.set("cfAccountId", (form.querySelector('[name="cfAccountId"]') as HTMLInputElement)?.value || "");
    formData.set("cfApiToken", (form.querySelector('[name="cfApiToken"]') as HTMLInputElement)?.value || "");
    formData.set("cfAiModel", (form.querySelector('[name="cfAiModel"]') as HTMLSelectElement)?.value || "");
    return formData;
  };

  return (
    <ValidatedForm
      validator={validator}
      method="post"
      defaultValues={defaultValues}
    >
      <fieldset>
        <legend>
          <h3>General</h3>
        </legend>
        <FormInput name="intent" type="hidden" value="settings" required />
        <FormInput
          name="preferredLabels"
          type="textarea"
          label="Preferred Labels"
          placeholder="e.g. 'yay, oh no, excited'"
          help="Comma separated list of labels to use for quick search."
        />
        <FormInput
          name="theme"
          type="select"
          label="Theme"
          options={[
            { value: "system", label: "System" },
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
          ]}
        />
        <FormInput
          name="giphyApiKey"
          type="password"
          label="Giphy API Key (Optional)"
          placeholder="Enter your Giphy API key"
          help="Enable external GIF search from Giphy. Get your key at https://developers.giphy.com"
        />
        {defaultValues.giphyApiKey && (
          <div style={{
            background: "#fff3cd",
            border: "1px solid #ffc107",
            padding: "0.75rem",
            borderRadius: "4px",
            marginBottom: "1rem",
            color: "#856404"
          }}>
            <strong>⚠️ Giphy Integration Warning</strong>
            <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.9em" }}>
              Enabling Giphy integration may violate Giphy's Terms of Service when used with Matrix federation,
              as homeservers may cache proxied images. By keeping your API key saved, you acknowledge and accept this risk.
            </p>
          </div>
        )}
        <hr />
        <h4>AI Alt Text Generation (Optional)</h4>
        <p style={{ fontSize: "0.9em", color: "#666", marginBottom: "1rem" }}>
          Automatically generate alt text for uploaded images using Cloudflare Workers AI.
          Free tier includes 10,000 neurons/day.
          Find your Account ID and create an API token (needs "Workers AI - Read" permission)
          at <a href="https://dash.cloudflare.com" target="_blank" rel="noopener noreferrer">dash.cloudflare.com</a>.
        </p>
        <FormInput
          name="cfAccountId"
          type="text"
          label="Cloudflare Account ID"
          placeholder="e.g. abc123def456..."
        />
        <FormInput
          name="cfApiToken"
          type="password"
          label="Cloudflare API Token"
          placeholder="Enter your API token"
        />
        <FormInput
          name="cfAiModel"
          type="select"
          label="AI Model"
          options={[
            {
              value: "@cf/meta/llama-3.2-11b-vision-instruct",
              label: "Llama 3.2 Vision 11B — Balanced (recommended, ~10 neurons/req)",
            },
            {
              value: "@cf/meta/llama-4-scout-17b-16e-instruct",
              label: "Llama 4 Scout 17B — Best quality (~32 neurons/req, 3x cost)",
            },
            {
              value: "@cf/unum/uform-gen2-qwen-500m",
              label: "UForm 500M — Fastest, basic captions (lowest cost)",
            },
          ]}
        />
        <p>
          <button
            type="button"
            className="link"
            disabled={isTesting}
            onClick={() => {
              const formData = getFormValues();
              if (formData) testFetcher.submit(formData, { method: "post", action: "/api/test-cloudflare-ai" });
            }}
          >
            {isTesting ? "Testing..." : "Test connection"}
          </button>
          {testFetcher.data?.success === true && (
            <span style={{ color: "green", marginLeft: "0.5rem" }}>Connected</span>
          )}
          {testFetcher.data?.success === false && !testFetcher.data?.needsAgreement && (
            <span style={{ color: "red", marginLeft: "0.5rem" }}>{testFetcher.data.error}</span>
          )}
        </p>
        {testFetcher.data?.needsAgreement && (
          <div style={{
            background: "#fff3cd",
            border: "1px solid #ffc107",
            padding: "0.75rem",
            borderRadius: "4px",
            marginBottom: "1rem",
            color: "#856404",
            fontSize: "0.9em",
          }}>
            <strong>Model license agreement required</strong>
            <p style={{ margin: "0.5rem 0" }}>
              This model requires you to accept its license before use.
              Please review the{" "}
              <a href="https://github.com/meta-llama/llama-models/blob/main/models/llama3_2/LICENSE" target="_blank" rel="noopener noreferrer">
                Community License
              </a>{" "}and{" "}
              <a href="https://github.com/meta-llama/llama-models/blob/main/models/llama3_2/USE_POLICY.md" target="_blank" rel="noopener noreferrer">
                Acceptable Use Policy
              </a>.
            </p>
            <button
              type="button"
              disabled={isTesting}
              onClick={() => {
                const formData = getFormValues();
                if (!formData) return;
                formData.set("acceptAgreement", "true");
                testFetcher.submit(formData, { method: "post", action: "/api/test-cloudflare-ai" });
              }}
            >
              {isTesting ? "Accepting..." : "Accept license & test"}
            </button>
          </div>
        )}
        <SubmitButton>Save</SubmitButton>
      </fieldset>
    </ValidatedForm>
  );
}
