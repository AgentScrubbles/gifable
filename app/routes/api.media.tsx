import type { LoaderArgs } from "@remix-run/node";

import { db } from "~/utils/db.server";
import { users, media } from "~/db/schema";
import { eq, like, and, desc } from "drizzle-orm";
import { getFullProxyImageUrl, getFullProxyThumbnailUrl } from "~/utils/media.server";

import { unauthorized } from "remix-utils";

export async function loader({ request }: LoaderArgs) {
  const auth = request.headers.get("Authorization");
  if (!auth) {
    return unauthorized({ message: "Unauthorized" });
  }

  const token = auth.replace("Bearer ", "");
  const user = await db.query.users.findFirst({
    where: eq(users.apiToken, token),
    columns: { id: true },
  });

  if (!user) {
    return unauthorized({ message: "Unauthorized" });
  }

  const params = new URLSearchParams(request.url.split("?")[1]);
  const search = (params.get("search") || "").trim();

  const conditions = [eq(media.userId, user.id)];

  if (search) {
    conditions.push(like(media.labels, `%${search}%`));
  }

  const where = conditions.length > 1 ? and(...conditions) : conditions[0];

  const data = await db.query.media.findMany({
    where,
    columns: {
      id: true,
      url: true,
      thumbnailUrl: true,
      labels: true,
      width: true,
      height: true,
      color: true,
      altText: true,
    },
    with: {
      user: {
        columns: {
          username: true,
        },
      },
    },
    orderBy: desc(media.createdAt),
  });

  // Transform to use full proxy URLs
  const transformedData = data.map((item) => ({
    ...item,
    url: getFullProxyImageUrl(item.id),
    thumbnailUrl: getFullProxyThumbnailUrl(item.id),
  }));

  return new Response(JSON.stringify({ data: transformedData }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
