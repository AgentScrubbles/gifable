import type { LoaderArgs, V2_MetaArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import MediaList, { loadMedia, MEDIA_LIST_LINKS } from "~/components/MediaList";
import QuickSearch from "~/components/QuickSearch";
import { db } from "~/utils/db.server";
import { users, media } from "~/db/schema";
import { eq, like, and } from "drizzle-orm";
import { getMediaLabels } from "~/utils/media.server";
import { makeTitle } from "~/utils/meta";
import { requireUserId } from "~/utils/session.server";

export function links() {
  return MEDIA_LIST_LINKS;
}

export function meta({ data }: V2_MetaArgs<typeof loader>) {
  return [{ title: makeTitle([`${data?.username}'s gifs`]) }];
}

export async function loader({ request, params }: LoaderArgs) {
  await requireUserId(request);
  const queryParams = new URLSearchParams(request.url.split("?")[1]);
  const page = parseInt((queryParams.get("page") || "1").trim(), 10);
  const search = (queryParams.get("search") || "").trim();

  const { username } = params;

  const user = await db.query.users.findFirst({
    where: eq(users.username, username!),
    columns: {
      id: true,
      username: true,
    },
  });

  if (!user) {
    throw new Response("Not found", { status: 404 });
  }

  const conditions = [eq(media.userId, user.id)];

  if (search) {
    conditions.push(like(media.labels, `%${search}%`));
  }

  const where = conditions.length > 1 ? and(...conditions) : conditions[0];

  const [{ media: mediaItems, count }, labels] = await Promise.all([
    loadMedia({ where, page }),
    getMediaLabels({ limit: 100, where: eq(media.userId, user.id) }),
  ]);

  return json({ media: mediaItems, mediaCount: count, username, page, labels, search });
}

export default function UserRoute() {
  const { media, mediaCount, page, username, labels, search } =
    useLoaderData<typeof loader>();

  return (
    <>
      <header>
        <h2>
          <center>{username}'s gifs</center>
        </h2>
        <QuickSearch title={`Search ${username}'s labels:`} labels={labels} />
        {search && (
          <center>
            <Link to={`/users/${username}`} replace>
              <strong>
                <small>Clear search</small>
              </strong>
            </Link>
          </center>
        )}
      </header>

      <br />

      <MediaList
        media={media}
        mediaCount={mediaCount}
        page={page}
        showUser={false}
      />
    </>
  );
}
