import type { Media } from "@prisma/client";
import type { ActionArgs, LoaderArgs, V2_MetaArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  isRouteErrorResponse,
  Link,
  Outlet,
  useLoaderData,
  useRouteError,
} from "@remix-run/react";
import { useState } from "react";
import { forbidden, notFound, useHydrated } from "remix-utils";
import DialogModal from "~/components/DialogModal";
import { useToast } from "~/components/Toast";

import { db } from "~/utils/db.server";
import { formatBytes, formatDate } from "~/utils/format";
import { copyToClipboard } from "~/utils/helpers.client";
import { getTitle } from "~/utils/media";
import { deleteURL, reparse } from "~/utils/media.server";
import { makeTitle } from "~/utils/meta";
import { requireUser } from "~/utils/session.server";

export function meta({ data }: V2_MetaArgs<typeof loader>) {
  return [{ title: makeTitle([getTitle(data.media.url)]) }];
}

export async function action({ params, request }: ActionArgs) {
  const user = await requireUser(request);
  const form = await request.formData();

  const media = await db.media.findUnique({
    where: { id: params.mediaId },
  });
  if (!media) {
    throw notFound({ message: "Media not found" });
  }
  if (media.userId !== user.id || !user.isAdmin) {
    throw forbidden({ message: "You can't do that" });
  }

  switch (form.get("intent") as string) {
    case "reparse":
      if (!user.isAdmin) {
        throw forbidden({ message: "You can't do that" });
      }
      await db.media.update({
        where: { id: params.mediaId },
        data: await reparse(media),
      });
      return redirect(`/media/${params.mediaId}`);

    case "delete":
      await Promise.all([deleteURL(media.url), deleteURL(media.thumbnailUrl)]);
      await db.media.delete({ where: { id: params.mediaId } });
      return redirect("/");

    default:
      throw new Response(`The intent ${form.get("intent")} is not supported`, {
        status: 400,
      });
  }
}

export async function loader({ request, params }: LoaderArgs) {
  const user = await requireUser(request);
  const media = await db.media.findUnique({
    where: { id: params.mediaId },
    include: {
      user: {
        select: {
          username: true,
        },
      },
    },
  });
  if (!media) {
    console.log("Media not found", params.mediaId);
    throw new Response("What a media! Not found.", {
      status: 404,
    });
  }
  return json({ user, media });
}

export default function MediaRoute() {
  const { user, media } = useLoaderData<typeof loader>();
  const isMine = media.userId === user.id;

  const {
    url = "",
    labels = "",
    altText = "",
    size,
    createdAt,
    width,
    height,
    color,
  } = media;

  return (
    <>
      <h2>
        <center>{getTitle(url)}</center>
      </h2>
      <figure>
        <center>
          <img
            src={url}
            alt={labels || ""}
            width={width || 300}
            height={height || 200}
            style={{ backgroundColor: color || "#ccc" }}
          />
        </center>
      </figure>

      <Outlet />

      {useHydrated() && <ShareButtons media={media} />}

      <table style={{ width: "100%" }} role="grid" aria-labelledby="meta-title">
        <caption id="meta-title">
          <h3>Info</h3>
        </caption>
        <tbody role="presentation">
          <tr role="presentation">
            <th tabIndex={0}>URL</th>
            <td tabIndex={-1} style={{ wordBreak: "break-all" }}>
              <a href={url}>{url}</a>
            </td>
          </tr>
          <tr role="presentation">
            <th tabIndex={-1}>Labels</th>
            <td tabIndex={-1}>
              {labels?.split(",").map((text, i: number) => {
                const term = text.trim().toLowerCase();
                return (
                  <span key={text + i}>
                    {i > 0 ? ", " : ""}
                    <Link to={`/?search=${term}`} title={`Search for ${term}`}>
                      {term}
                    </Link>
                  </span>
                );
              })}
            </td>
          </tr>
          <tr role="presentation">
            <th tabIndex={-1}>Alt text</th>
            <td tabIndex={-1}>{altText}</td>
          </tr>
          <tr role="presentation">
            <th tabIndex={-1}>Size</th>
            <td tabIndex={-1}>
              {width} ⅹ {height} • {formatBytes(size)}
            </td>
          </tr>
          <tr role="presentation">
            <th tabIndex={-1}>Added</th>
            <td tabIndex={-1}>
              <time dateTime={createdAt}>{formatDate(createdAt)}</time>
            </td>
          </tr>
          {isMine ? null : (
            <tr role="presentation">
              <th tabIndex={-1}>User</th>
              <td tabIndex={-1}>{media.user.username}</td>
            </tr>
          )}
        </tbody>
      </table>

      {isMine ? (
        <center>
          <Link
            to={`/media/${media.id}/edit`}
            role="button"
            aria-label="Edit media info"
          >
            ✏️ Edit info
          </Link>{" "}
          &nbsp;
          <DeleteButton media={media} />
        </center>
      ) : null}

      {user.isAdmin ? (
        <center>
          <form method="post" style={{ display: "inline-block" }}>
            <button name="intent" type="submit" value="reparse">
              🔁 Reparse
            </button>
          </form>
        </center>
      ) : null}
    </>
  );
}

function DeleteButton({ media }: { media: Pick<Media, "id" | "url"> }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <>
      <form
        method="post"
        style={{ display: "inline-block" }}
        onSubmit={(event) => {
          event.preventDefault();
          setConfirmDelete(true);
        }}
      >
        <button
          name="intent"
          type="submit"
          value="delete"
          aria-label="Delete media"
        >
          🗑️ Delete
        </button>
      </form>

      <DialogModal open={confirmDelete} onClose={() => setConfirmDelete(false)}>
        <h2>Are you sure?</h2>
        <p>
          This will delete the media and all its data.
          <br />
          This action cannot be undone.
        </p>

        <form method="post">
          <button formMethod="dialog" aria-label="Cancel delete">
            🚫 Cancel
          </button>
          &nbsp;&nbsp;
          <button
            name="intent"
            type="submit"
            value="delete"
            aria-label="Delete media"
          >
            🗑️ Delete
          </button>
        </form>
      </DialogModal>
    </>
  );
}

function ShareButtons({ media }: { media: Pick<Media, "url" | "altText"> }) {
  const { url, altText } = media;

  const toast = useToast();

  return (
    <center>
      <fieldset>
        <legend>
          <strong>Share {getTitle(media.url)}</strong>
        </legend>
        <button
          type="button"
          aria-label="Copy URL to clipboard"
          onClick={() => copyToClipboard(url, () => toast("Copied URL"))}
        >
          🔗 Copy URL
        </button>
        &nbsp;
        <button
          type="button"
          aria-label="Copy alt text to clipboard"
          onClick={() =>
            copyToClipboard(altText || "", () => toast("Copied alt text"))
          }
        >
          💬 Copy alt text
        </button>
        &nbsp;
        <button
          type="button"
          aria-label="Copy Markdown to clipboard"
          onClick={() =>
            copyToClipboard(`![${altText || ""}](${url})`, () =>
              toast("Copied markdown")
            )
          }
        >
          📝 Copy markdown
        </button>
      </fieldset>
    </center>
  );
}

export function ErrorBoundary() {
  let error = useRouteError();
  if (isRouteErrorResponse(error)) {
    switch (error.status) {
      case 400: {
        return (
          <div className="notice">What you're trying to do is not allowed.</div>
        );
      }
      case 404: {
        return (
          <div className="notice">
            <h1>Media not found</h1>
          </div>
        );
      }
      case 403: {
        return <div className="notice">Sorry, but this is not your media.</div>;
      }
      default: {
        throw new Error(`Unhandled error: ${error.status}`);
      }
    }
  } else if (error instanceof Error) {
    return (
      <div className="notice">
        <h1>Error</h1>
        <p>{error.message}</p>
        <p>The stack trace is:</p>
        <pre>{error.stack}</pre>
      </div>
    );
  } else {
    return <h1>Unknown Error</h1>;
  }
}
