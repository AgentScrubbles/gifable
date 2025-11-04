import type { User } from "@prisma/client";
import type { ActionArgs, LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useActionData, useLoaderData } from "@remix-run/react";
import { notFound } from "remix-utils";
import { db } from "~/utils/db.server";
import { requireUserId } from "~/utils/session.server";
import { makeTitle } from "~/utils/meta";
import { useEffect } from "react";
import { useToast } from "~/components/Toast";
import {
  settingsAction,
  SettingsForm,
  SETTINGS_INTENT,
} from "~/components/SettingsForm";
import {
  changePasswordAction,
  ChangePasswordForm,
  CHANGE_PASSWORD_INTENT,
} from "~/components/ChangePasswordForm";
import {
  apiTokenAction,
  APITokenForm,
  API_TOKEN_INTENT,
} from "~/components/APITokenForm";
import { APIKeysManager } from "~/components/APIKeysManager";
import { listApiKeys } from "~/utils/api-keys.server";
import { UserMangement } from "~/components/UserManagement";
import type { Theme } from "~/components/ThemeStyles";

export function meta() {
  return [{ title: makeTitle(["Settings"]) }];
}

export async function action({ request }: ActionArgs) {
  const userId = await requireUserId(request);

  const form = await request.formData();

  const intent = form.get("intent");

  switch (intent) {
    case CHANGE_PASSWORD_INTENT:
      return changePasswordAction({ userId, form });

    case API_TOKEN_INTENT:
      return apiTokenAction({ userId });

    case SETTINGS_INTENT:
      return settingsAction({ userId, form });

    default:
      throw notFound({ message: "Invalid intent" });
  }
}

export async function loader({ request }: LoaderArgs) {
  const userId = await requireUserId(request);
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      lastLogin: true,
      isAdmin: true,
      apiToken: true,
      preferredLabels: true,
      theme: true,
    },
  });

  const apiKeys = await listApiKeys(userId);

  return json({
    user,
    apiKeys,
    users: user?.isAdmin
      ? await db.user.findMany({
          select: {
            id: true,
            username: true,
            lastLogin: true,
            isAdmin: true,
          },
        })
      : null,
  });
}

export default function AdminRoute() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const toast = useToast();

  const apiToken = actionData?.apiToken || data.user?.apiToken;

  useEffect(() => {
    switch (actionData?.intent) {
      case CHANGE_PASSWORD_INTENT:
        toast("Password changed");
        break;

      case SETTINGS_INTENT:
        toast("Settings updated");
        break;

      case API_TOKEN_INTENT:
        toast("API token updated");
        break;

      default:
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionData]);

  const { user, users, apiKeys } = data;
  return (
    <div>
      <h1>Settings</h1>

      <SettingsForm
        defaultValues={{
          preferredLabels: user?.preferredLabels || "",
          theme: (user?.theme as Theme) || "system",
        }}
      />

      <ChangePasswordForm />

      <APIKeysManager initialApiKeys={apiKeys} />

      {apiToken && (
        <details style={{ marginTop: "2rem" }}>
          <summary>
            <strong>Legacy API Token (Deprecated)</strong>
          </summary>
          <div style={{ padding: "1rem 0" }}>
            <p style={{ color: "#856404", background: "#fff3cd", padding: "0.75rem", borderRadius: "4px" }}>
              ⚠️ You have an old-style API token. Please migrate to the new API Keys system above.
              The legacy token will continue to work but may be removed in a future update.
            </p>
            <APITokenForm apiToken={apiToken} />
          </div>
        </details>
      )}

      {user?.isAdmin ? (
        <section>
          <h2>Admin</h2>
          <UserMangement users={users as User[]} />
        </section>
      ) : null}
    </div>
  );
}
