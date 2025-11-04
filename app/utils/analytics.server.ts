import { db } from "./db.server";
import { isGiphyId } from "./giphy.server";

/**
 * Track a media view
 * This is async but we don't await it in routes to avoid slowing down image serving
 */
export async function trackMediaView(
  mediaId: string,
  userId?: string | null,
  userAgent?: string | null
): Promise<void> {
  try {
    await db.mediaView.create({
      data: {
        mediaId,
        userId: userId || null,
        userAgent: userAgent || null,
      },
    });
  } catch (error) {
    console.error("Error tracking media view:", error);
    // Don't throw - we don't want analytics failures to break media serving
  }
}

/**
 * Get view counts grouped by mediaId for Prometheus metrics
 */
export async function getViewCounts(): Promise<Map<string, number>> {
  const results = await db.mediaView.groupBy({
    by: ["mediaId"],
    _count: {
      id: true,
    },
  });

  const counts = new Map<string, number>();
  for (const result of results) {
    counts.set(result.mediaId, result._count.id);
  }

  return counts;
}

/**
 * Get view counts for last 24 hours
 */
export async function getViewCountsLast24h(): Promise<Map<string, number>> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const results = await db.mediaView.groupBy({
    by: ["mediaId"],
    where: {
      viewedAt: {
        gte: since,
      },
    },
    _count: {
      id: true,
    },
  });

  const counts = new Map<string, number>();
  for (const result of results) {
    counts.set(result.mediaId, result._count.id);
  }

  return counts;
}

/**
 * Get view counts for last 7 days
 */
export async function getViewCountsLast7d(): Promise<Map<string, number>> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const results = await db.mediaView.groupBy({
    by: ["mediaId"],
    where: {
      viewedAt: {
        gte: since,
      },
    },
    _count: {
      id: true,
    },
  });

  const counts = new Map<string, number>();
  for (const result of results) {
    counts.set(result.mediaId, result._count.id);
  }

  return counts;
}

/**
 * Get total views across all media
 */
export async function getTotalViews(): Promise<number> {
  const result = await db.mediaView.count();
  return result;
}

/**
 * Get total Giphy views
 */
export async function getTotalGiphyViews(): Promise<number> {
  // Since we can't use a LIKE query directly in Prisma easily,
  // we'll fetch all view counts and filter
  const allViews = await getViewCounts();
  let giphyCount = 0;

  for (const [mediaId, count] of allViews) {
    if (isGiphyId(mediaId)) {
      giphyCount += count;
    }
  }

  return giphyCount;
}

/**
 * Get total local (Gifable) media count
 */
export async function getTotalLocalMediaCount(): Promise<number> {
  const result = await db.media.count();
  return result;
}

/**
 * Get detailed stats for a specific media
 */
export async function getMediaStats(mediaId: string): Promise<{
  total: number;
  last24h: number;
  last7d: number;
}> {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const week = 7 * day;

  const [total, last24h, last7d] = await Promise.all([
    db.mediaView.count({
      where: { mediaId },
    }),
    db.mediaView.count({
      where: {
        mediaId,
        viewedAt: {
          gte: new Date(now - day),
        },
      },
    }),
    db.mediaView.count({
      where: {
        mediaId,
        viewedAt: {
          gte: new Date(now - week),
        },
      },
    }),
  ]);

  return { total, last24h, last7d };
}

/**
 * Generate Prometheus metrics format
 */
export async function generatePrometheusMetrics(): Promise<string> {
  const [
    viewCounts,
    viewCounts24h,
    viewCounts7d,
    totalViews,
    giphyViews,
    localMediaCount,
  ] = await Promise.all([
    getViewCounts(),
    getViewCountsLast24h(),
    getViewCountsLast7d(),
    getTotalViews(),
    getTotalGiphyViews(),
    getTotalLocalMediaCount(),
  ]);

  const lines: string[] = [];

  // Total views per media
  lines.push("# HELP media_views_total Total number of views per media item");
  lines.push("# TYPE media_views_total counter");
  for (const [mediaId, count] of viewCounts) {
    const type = isGiphyId(mediaId) ? "giphy" : "local";
    const escapedId = mediaId.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    lines.push(`media_views_total{media_id="${escapedId}",type="${type}"} ${count}`);
  }
  lines.push("");

  // Last 24 hours per media
  lines.push("# HELP media_views_last_24h Views in last 24 hours per media item");
  lines.push("# TYPE media_views_last_24h gauge");
  for (const [mediaId, count] of viewCounts24h) {
    const type = isGiphyId(mediaId) ? "giphy" : "local";
    const escapedId = mediaId.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    lines.push(`media_views_last_24h{media_id="${escapedId}",type="${type}"} ${count}`);
  }
  lines.push("");

  // Last 7 days per media
  lines.push("# HELP media_views_last_7d Views in last 7 days per media item");
  lines.push("# TYPE media_views_last_7d gauge");
  for (const [mediaId, count] of viewCounts7d) {
    const type = isGiphyId(mediaId) ? "giphy" : "local";
    const escapedId = mediaId.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    lines.push(`media_views_last_7d{media_id="${escapedId}",type="${type}"} ${count}`);
  }
  lines.push("");

  // Aggregate metrics
  lines.push("# HELP total_media_views Total views across all media");
  lines.push("# TYPE total_media_views counter");
  lines.push(`total_media_views ${totalViews}`);
  lines.push("");

  lines.push("# HELP gifable_media_count Total number of local media items");
  lines.push("# TYPE gifable_media_count gauge");
  lines.push(`gifable_media_count ${localMediaCount}`);
  lines.push("");

  lines.push("# HELP giphy_media_views Total views for Giphy media");
  lines.push("# TYPE giphy_media_views counter");
  lines.push(`giphy_media_views ${giphyViews}`);
  lines.push("");

  return lines.join("\n");
}
