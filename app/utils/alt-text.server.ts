import debug from "debug";

const log = debug("app:alt-text");

const DEFAULT_MODEL = "@cf/meta/llama-3.2-11b-vision-instruct";
const TIMEOUT_MS = 30_000;

type CfCredentials = {
  cfAccountId: string | null;
  cfApiToken: string | null;
  cfAiModel: string | null;
};

export type AiImageResult = {
  altText: string | null;
  labels: string | null;
};

export function isAltTextEnabled(user: CfCredentials): boolean {
  return !!(user.cfAccountId && user.cfApiToken);
}

export async function generateImageMetadata(
  user: CfCredentials,
  imageBuffer: Buffer
): Promise<AiImageResult> {
  if (!user.cfAccountId || !user.cfApiToken) {
    log("Skipping: missing Cloudflare credentials");
    return { altText: null, labels: null };
  }

  const model = user.cfAiModel || DEFAULT_MODEL;
  const base64Image = imageBuffer.toString("base64");
  let mime = "image/jpeg";
  if (imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50) mime = "image/png";
  else if (imageBuffer[0] === 0x47 && imageBuffer[1] === 0x49) mime = "image/gif";
  const dataUri = `data:${mime};base64,${base64Image}`;
  log("Sending image: %s, %d bytes", mime, imageBuffer.length);

  // Run both prompts in parallel
  const [altText, labels] = await Promise.all([
    callVisionModel(user, model, dataUri,
      "Describe this image in one or two sentences for use as alt text. " +
      "Be concise. If it contains text, include the text. " +
      "Respond with ONLY the description, nothing else."
    ),
    callVisionModel(user, model, dataUri,
      "List 3-8 single-word tags that describe this image's specific content and subject matter. " +
      "Use lowercase. Do NOT include generic tags like meme, image, funny, cartoon, comic, animation, reaction, humor. " +
      "Focus on what makes this image unique: characters, emotions, objects, actions, topics. " +
      "Respond with ONLY comma-separated words, nothing else. " +
      "Example: dog, confused, office, typing, frustrated",
      32
    ),
  ]);

  // Clean up labels: lowercase, deduplicate, remove generic tags, cap at 8
  const GENERIC_TAGS = new Set([
    "meme", "image", "picture", "photo", "gif", "funny", "humor",
    "comic", "cartoon", "animation", "internet", "viral", "online",
    "text", "caption", "reaction", "screenshot", "digital",
  ]);
  const cleanLabels = labels
    ? [...new Set(
        labels
          .replace(/^labels:\s*/i, "")
          .split(",")
          .map((l) => l.trim().toLowerCase().replace(/[^a-z0-9-]/g, ""))
          .filter((l) => l.length > 0 && l.length < 30 && !GENERIC_TAGS.has(l))
      )]
        .slice(0, 8)
        .join(", ")
    : null;

  log("Alt text: %s", altText);
  log("Labels: %s", cleanLabels);

  return { altText, labels: cleanLabels || null };
}

async function callVisionModel(
  user: CfCredentials,
  model: string,
  dataUri: string,
  prompt: string,
  maxTokens = 128
): Promise<string | null> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${user.cfAccountId}/ai/run/${model}`;

  try {
    const fetchPromise = fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${user.cfApiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: dataUri } },
              { type: "text", text: prompt },
            ],
          },
        ],
        max_tokens: maxTokens,
      }),
    });

    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => {
        log("Timed out after %dms for prompt: %s", TIMEOUT_MS, prompt.slice(0, 50));
        resolve(null);
      }, TIMEOUT_MS);
    });

    const response = await Promise.race([fetchPromise, timeoutPromise]);
    if (!response) return null;

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      log("API error: %d %s — %s", response.status, response.statusText, errorBody);
      return null;
    }

    const data = await response.json();
    const text = data?.result?.response?.trim();

    if (!text) {
      log("Empty response: %j", data);
      return null;
    }

    return text;
  } catch (error: any) {
    log("Call failed: %s", error.message);
    return null;
  }
}
