import type { LoaderArgs } from "@remix-run/node";
import { generatePrometheusMetrics } from "~/utils/analytics.server";

/**
 * Prometheus metrics endpoint
 * Returns metrics in Prometheus text format
 *
 * Example metrics:
 * - media_views_total: Total views per media ID
 * - media_views_last_24h: Views in last 24 hours
 * - total_media_views: Total views across all media
 * - giphy_media_views: Total views for Giphy media
 *
 * Access: GET /metrics
 */
export async function loader({ request }: LoaderArgs) {
  try {
    const metrics = await generatePrometheusMetrics();

    return new Response(metrics, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Error generating Prometheus metrics:", error);

    return new Response("# Error generating metrics\n", {
      status: 500,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }
}
