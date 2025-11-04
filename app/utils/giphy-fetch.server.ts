import { getGiphyGif, getGiphyImageUrl, extractGiphyId } from "./giphy.server";

/**
 * Fetch a Giphy image and return as a buffer
 * This does NOT cache - fetches fresh every time per Giphy ToS
 */
export async function fetchGiphyImage(
  apiKey: string,
  giphyId: string,
  type: "original" | "thumbnail" = "original"
): Promise<{ buffer: Buffer; contentType: string }> {
  // Get the GIF metadata from Giphy API
  const giphyGif = await getGiphyGif(apiKey, giphyId);

  if (!giphyGif) {
    throw new Error(`Giphy GIF not found: ${giphyId}`);
  }

  // Get the appropriate image URL
  const imageUrl = getGiphyImageUrl(giphyGif, type);

  // Fetch the image directly from Giphy's CDN
  const response = await fetch(imageUrl);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch Giphy image: ${response.status} ${response.statusText}`
    );
  }

  // Get the buffer
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Determine content type from response or URL
  let contentType =
    response.headers.get("content-type") || "image/gif";

  // Fallback: guess from URL extension
  if (imageUrl.endsWith(".mp4")) {
    contentType = "video/mp4";
  } else if (imageUrl.endsWith(".webp")) {
    contentType = "image/webp";
  } else if (imageUrl.endsWith(".gif")) {
    contentType = "image/gif";
  }

  return { buffer, contentType };
}

/**
 * Stream a Giphy image directly (for use in route responses)
 */
export async function streamGiphyImage(
  apiKey: string,
  id: string,
  type: "original" | "thumbnail" = "original"
): Promise<Response> {
  try {
    const giphyId = extractGiphyId(id);
    const { buffer, contentType } = await fetchGiphyImage(apiKey, giphyId, type);

    return new Response(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "public, max-age=86400", // 24 hours
        "X-Content-Source": "giphy", // Indicate this is from Giphy
      },
    });
  } catch (error) {
    console.error("Error streaming Giphy image:", error);
    throw error;
  }
}
