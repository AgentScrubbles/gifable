import type { LoaderArgs, V2_MetaArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData, useSearchParams } from "@remix-run/react";

import { db } from "~/utils/db.server";
import { media, users } from "~/db/schema";
import { and, count as drizzleCount, eq, like, ne } from "drizzle-orm";
import { requireUserId } from "~/utils/session.server";

import MediaList, { loadMedia, MEDIA_LIST_LINKS } from "~/components/MediaList";
import { getMediaLabels } from "~/utils/media.server";
import { useEffect, useState } from "react";
import { makeTitle } from "~/utils/meta";
import { withZod } from "@remix-validated-form/with-zod";
import { z } from "zod";
import { ValidatedForm } from "remix-validated-form";
import classNames from "classnames";
import QuickSearch from "~/components/QuickSearch";

type SelectOptions = "" | "all" | "not-mine";

const searchValidator = withZod(
  z.object({
    search: z.string().optional(),
  })
);

export function links() {
  return MEDIA_LIST_LINKS;
}

export function meta({ location }: V2_MetaArgs<typeof loader>) {
  let title = "Search";
  let selectTitle = "";
  const params = new URLSearchParams(location.search);
  const search = params.get("search");
  const select = params.get("select");

  if (search) {
    title = `Search results for '${search}'`;
  }

  if (select === "not-mine") {
    selectTitle = "not mine";
  }
  if (select === "all") {
    selectTitle = "all";
  }

  return [
    { title: makeTitle([title, selectTitle].filter(Boolean)) },
    {
      name: "description",
      content: "Search for media",
    },
  ];
}

export async function loader({ request }: LoaderArgs) {
  try {
    const userId = await requireUserId(request);
    const params = new URLSearchParams(request.url.split("?")[1]);

    const page = parseInt((params.get("page") || "1").trim(), 10);
    const search = (params.get("search") || "").trim();
    const select = (params.get("select") || "").trim();

    const conditions: any[] = [];
    const labelsConditions: any[] = [];

    if (search) {
      conditions.push(like(media.labels, `%${search}%`));
    }
    if (select === "") {
      conditions.push(eq(media.userId, userId));
      labelsConditions.push(eq(media.userId, userId));
    }
    if (select === "not-mine") {
      conditions.push(ne(media.userId, userId));
      labelsConditions.push(ne(media.userId, userId));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const labelsWhere = labelsConditions.length > 0 ? and(...labelsConditions) : undefined;

    const [{ media: mediaList, count: mediaCount }, user, totalMediaCount, labels] =
      await Promise.all([
        loadMedia({ where, page }),
        db.query.users.findFirst({
          where: eq(users.id, userId),
          columns: { preferredLabels: true },
        }),
        select === ""
          ? db
              .select({ count: drizzleCount() })
              .from(media)
              .where(eq(media.userId, userId))
              .then((result) => result[0]?.count || 0)
          : null,
        getMediaLabels({
          limit: 100,
          where: labelsWhere,
        }),
      ]);

    return json({
      user,
      mediaCount,
      totalMediaCount,
      media: mediaList,
      labels,
    });
  } catch (error) {
    console.error("Error in _index loader:", error);
    throw error;
  }
}

export default function MediaRoute() {
  const { media, mediaCount, totalMediaCount, user, labels } =
    useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams({
    search: "",
    select: "",
  });

  const search = searchParams.get("search") || "";
  const select = searchParams.get("select") as SelectOptions;
  const page = parseInt(searchParams.get("page") || "1", 10);

  const [searchValue, setSearchValue] = useState(search);

  const emptyUserCollection = select === "" && totalMediaCount === 0;

  useEffect(() => {
    setSearchValue(search);
  }, [search]);

  return (
    <>
      <header id="search">
        <center>
          <ValidatedForm action="/" method="get" validator={searchValidator}>
            <input type="hidden" name="select" value={select} tabIndex={-1} />
            <input
              type="search"
              name="search"
              aria-label="Search media"
              placeholder="Search"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              style={{ marginRight: "0.2em" }}
            />
            <div
              className="button-group"
              role="group"
              aria-label="Filter results by owner"
              title="Filter results by owner"
            >
              {["", "not-mine", "all"].map((option) => {
                const active = select === option;

                // Include active search query when switching filter,
                // unless the filter is already active. Then clear the search.
                let to = `/?select=${option}`;
                if (!active) {
                  to += `&search=${search}`;
                }

                return (
                  <Link
                    key={option}
                    className={classNames({ active }, "button")}
                    aria-current={active ? "page" : undefined}
                    to={to}
                  >
                    {option === "not-mine"
                      ? "Not Mine"
                      : option === "all"
                      ? "All"
                      : "Mine"}
                  </Link>
                );
              })}
            </div>
            &nbsp;
            <button type="submit" aria-label="Submit search">
              🔎 Search
            </button>
          </ValidatedForm>
        </center>

        <QuickSearch
          labels={labels || []}
          preferredLabels={user?.preferredLabels || ""}
        />
        <center>
          <Link
            prefetch="intent"
            to="/media/random"
            aria-label="Suprise me! Go to random media"
          >
            <small>
              <strong>Suprise me!</strong>
            </small>
          </Link>
        </center>
        <br />
      </header>

      <MediaList
        media={media}
        showUser={select !== ""}
        mediaCount={mediaCount}
        page={page}
      />

      {emptyUserCollection && (
        <div className="notice">
          <h3>Hi! Looks like you're new here 👋</h3>
          <p>
            <strong>Welcome!</strong> Would you like to...
          </p>
          <Link
            className="button"
            to="/media/new"
            style={{ lineBreak: "normal" }}
          >
            🚀 Add a file
          </Link>
          <p>or</p>
          <Link className="button" to="/?select=all">
            💡 Find some inspiration
          </Link>
        </div>
      )}
    </>
  );
}
