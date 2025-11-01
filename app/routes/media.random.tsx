import type { LoaderArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { db } from "~/utils/db.server";
import { media } from "~/db/schema";
import { sql } from "drizzle-orm";
import { requireUserId } from "~/utils/session.server";

export async function loader({ request }: LoaderArgs) {
  await requireUserId(request);

  const [randomMedia] = await db.select({ id: media.id })
    .from(media)
    .orderBy(sql`RANDOM()`)
    .limit(1);

  if (!randomMedia) {
    return redirect("/media/new");
  }

  return redirect(`/media/${randomMedia.id}?random=true`);
}
