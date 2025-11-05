import { db } from "./db.server";
import { isGiphyId } from "./giphy.server";

/**
 * Track a media view
 * This is async but we don't await it in routes to avoid slowing down image serving
 *
 * @param viewType - "internal" (browsing app), "external" (direct/embed), "federation" (Matrix)
 */
export async function trackMediaView(
  mediaId: string,
  userId?: string | null,
  userAgent?: string | null,
  viewType: "internal" | "external" | "federation" = "external"
): Promise<void> {
  try {
    await db.mediaView.create({
      data: {
        mediaId,
        userId: userId || null,
        userAgent: userAgent || null,
        viewType,
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
  // Get view counts grouped by mediaId and viewType
  const viewsByType = await db.mediaView.groupBy({
    by: ["mediaId", "viewType"],
    _count: {
      id: true,
    },
  });

  // Get view counts by type for last 24h and 7d
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [viewsByType24h, viewsByType7d, totalViews, localMediaCount] =
    await Promise.all([
      db.mediaView.groupBy({
        by: ["mediaId", "viewType"],
        where: { viewedAt: { gte: since24h } },
        _count: { id: true },
      }),
      db.mediaView.groupBy({
        by: ["mediaId", "viewType"],
        where: { viewedAt: { gte: since7d } },
        _count: { id: true },
      }),
      getTotalViews(),
      getTotalLocalMediaCount(),
    ]);

  const lines: string[] = [];

  // Total views per media with viewType label
  lines.push(
    "# HELP media_views_total Total number of views per media item by view type"
  );
  lines.push("# TYPE media_views_total counter");
  for (const result of viewsByType) {
    const type = isGiphyId(result.mediaId) ? "giphy" : "local";
    const escapedId = result.mediaId.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    lines.push(
      `media_views_total{media_id="${escapedId}",media_type="${type}",view_type="${result.viewType}"} ${result._count.id}`
    );
  }
  lines.push("");

  // Last 24 hours per media with viewType
  lines.push(
    "# HELP media_views_last_24h Views in last 24 hours per media item by view type"
  );
  lines.push("# TYPE media_views_last_24h gauge");
  for (const result of viewsByType24h) {
    const type = isGiphyId(result.mediaId) ? "giphy" : "local";
    const escapedId = result.mediaId.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    lines.push(
      `media_views_last_24h{media_id="${escapedId}",media_type="${type}",view_type="${result.viewType}"} ${result._count.id}`
    );
  }
  lines.push("");

  // Last 7 days per media with viewType
  lines.push(
    "# HELP media_views_last_7d Views in last 7 days per media item by view type"
  );
  lines.push("# TYPE media_views_last_7d gauge");
  for (const result of viewsByType7d) {
    const type = isGiphyId(result.mediaId) ? "giphy" : "local";
    const escapedId = result.mediaId.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    lines.push(
      `media_views_last_7d{media_id="${escapedId}",media_type="${type}",view_type="${result.viewType}"} ${result._count.id}`
    );
  }
  lines.push("");

  // Aggregate metrics by view type
  const totalByViewType = await db.mediaView.groupBy({
    by: ["viewType"],
    _count: { id: true },
  });

  lines.push("# HELP total_media_views Total views across all media by view type");
  lines.push("# TYPE total_media_views counter");
  for (const result of totalByViewType) {
    lines.push(`total_media_views{view_type="${result.viewType}"} ${result._count.id}`);
  }
  lines.push("");

  lines.push("# HELP gifable_media_count Total number of local media items");
  lines.push("# TYPE gifable_media_count gauge");
  lines.push(`gifable_media_count ${localMediaCount}`);
  lines.push("");

  return lines.join("\n");
}
