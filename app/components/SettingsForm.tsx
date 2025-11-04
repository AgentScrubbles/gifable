import type { User } from "@prisma/client";
import { json } from "@remix-run/node";
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

  const { preferredLabels, theme, giphyApiKey } = settingsResult.data;

  await db.user.update({
    where: { id: userId },
    data: {
      preferredLabels,
      theme,
      giphyApiKey: giphyApiKey || null,
    },
  });

  return json({ success: true, intent: SETTINGS_INTENT });
}

type SettingsDefaultValues = {
  preferredLabels: string;
  theme: Theme;
  giphyApiKey?: string;
};

export function SettingsForm({
  defaultValues,
}: {
  defaultValues: SettingsDefaultValues;
}) {
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
        <SubmitButton>Save</SubmitButton>
      </fieldset>
    </ValidatedForm>
  );
}
