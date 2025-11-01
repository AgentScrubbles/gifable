import type { ActionArgs, LoaderArgs, V2_MetaArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useActionData, useLoaderData } from "@remix-run/react";
import { useEffect } from "react";
import { notFound } from "remix-utils";
import Alert from "~/components/Alert";
import {
  changePasswordAction,
  ChangePasswordForm,
  CHANGE_PASSWORD_INTENT,
} from "~/components/ChangePasswordForm";
import { useToast } from "~/components/Toast";
import { db } from "~/utils/db.server";
import { users } from "~/db/schema";
import { eq } from "drizzle-orm";
import { makeTitle } from "~/utils/meta";
import { requireUser } from "~/utils/session.server";

export function meta({ data }: V2_MetaArgs<typeof loader>) {
  return [{ title: makeTitle([`Edit ${data?.user?.username}`]) }];
}

export async function action({ request, params }: ActionArgs) {
  const activeUser = await requireUser(request);
  if (!activeUser.isAdmin) {
    throw new Response("Not found", { status: 404 });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.username, params.username!),
    columns: {
      id: true,
      username: true,
    },
  });

  if (!user) return notFound({ message: "Not found" });

  const form = await request.formData();

  const intent = form.get("intent");

  switch (intent) {
    case CHANGE_PASSWORD_INTENT:
      return changePasswordAction({ userId: user.id, form });

    default:
      return notFound({ message: "Invalid intent" });
  }
}

export async function loader({ request, params }: LoaderArgs) {
  const activeUser = await requireUser(request);
  if (!activeUser?.isAdmin) {
    throw new Response("Not found", {
      status: 404,
    });
  }

  const username = params.username as string;

  const user = await db.query.users.findFirst({
    where: eq(users.username, username),
    columns: {
      id: true,
      username: true,
    },
  });

  return json({ user });
}

export default function UserRoute() {
  const data = useLoaderData();
  const actionData = useActionData<typeof action>();
  const toast = useToast();

  useEffect(() => {
    switch (actionData?.intent) {
      case CHANGE_PASSWORD_INTENT:
        toast("Password changed");
        break;

      default:
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionData]);

  return (
    <>
      <h1>Edit {data.user.username}</h1>

      <ChangePasswordForm />
      <Alert>actionData?.message</Alert>
    </>
  );
}
