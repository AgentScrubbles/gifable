import type { ActionArgs } from "@remix-run/node";
import {
  unstable_createMemoryUploadHandler,
  unstable_parseMultipartFormData,
} from "@remix-run/node";
import { json } from "@remix-run/node";
import bytes from "bytes";

import { db } from "~/utils/db.server";
import {
  extractApiKeyFromRequest,
  validateApiKey,
} from "~/utils/api-keys.server";
import {
  storeBuffer,
  makeThumbnailFilename,
  getFullProxyImageUrl,
  getFullProxyThumbnailUrl,
} from "~/utils/media.server";
import { getImageData } from "~/utils/image.server";
import { storage } from "~/utils/s3-storage.server";
import {
  badRequest,
  unauthorized,
  payloadTooLarge,
} from "~/utils/request.server";
import { isRateLimited } from "~/utils/rate-limiter.server";
import { FILENAME_REGEX } from "~/utils/validators";
import envServer from "~/utils/env.server";

const MAX_FILE_SIZE = bytes(envServer.get("MAX_FILE_SIZE") ?? "10MB");

const UPLOAD_RATE_LIMITER_OPTIONS = {
  keyPrefix: "api-upload",
  points: 5,
  duration: 60,
};

const ALLOWED_MIME_TYPES = ["image/gif", "image/jpeg", "image/png"];

export async function action({ request }: ActionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  // Authenticate via API key
  const apiKey = extractApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized({ error: "Missing or invalid API key" });
  }

  const result = await validateApiKey(apiKey);
  if (!result) {
    return unauthorized({ error: "Invalid API key" });
  }

  const { user } = result;

  // Rate limit
  const rateLimited = await isRateLimited(
    user.id,
    UPLOAD_RATE_LIMITER_OPTIONS
  );
  if (rateLimited) {
    return json(
      {
        error: `Too many requests. Try again in ${Math.round(
          rateLimited.msBeforeNext / 1000
        )} seconds.`,
      },
      { status: 429 }
    );
  }

  // Parse multipart form data
  let formData: FormData;
  try {
    formData = await unstable_parseMultipartFormData(
      request,
      unstable_createMemoryUploadHandler({
        maxPartSize: MAX_FILE_SIZE,
        filter: (file) => {
          if (file.name !== "file") return true;
          return file.contentType?.startsWith("image/") ?? false;
        },
      })
    );
  } catch {
    return payloadTooLarge({
      error: `File too large (max ${bytes(MAX_FILE_SIZE)})`,
    });
  }

  // Extract fields
  const file = formData.get("file") as File | null;
  const filename = formData.get("filename") as string | null;
  const labels = (formData.get("labels") as string | null)?.trim() || undefined;
  const altText =
    (formData.get("altText") as string | null)?.trim() || undefined;
  const isPublic = (formData.get("isPublic") as string) !== "false";

  // Validate required fields
  if (!file || !filename) {
    return badRequest({ error: "file and filename are required" });
  }

  // Validate filename format
  if (!FILENAME_REGEX.test(filename)) {
    return badRequest({
      error:
        "Invalid filename. Must be alphanumeric with hyphens/underscores and a valid extension (.gif, .jpg, .jpeg, .png)",
    });
  }

  // Validate MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return badRequest({
      error: `Unsupported file type: ${file.type}. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}`,
    });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Store file to S3
  const userFilename = `${user.username}/${filename}`;
  let mediaUrl: string;
  let fileHash: string;
  let size: number;

  try {
    const resp = await storeBuffer(buffer, userFilename);
    mediaUrl = resp.url;
    fileHash = resp.hash;
    size = resp.size;
  } catch (error: any) {
    if (error?.message === "File already exists") {
      return json(
        { error: `Filename ${filename} already exists` },
        { status: 409 }
      );
    }
    throw error;
  }

  // Generate thumbnail + extract metadata
  const { thumbnail, ...imageData } = await getImageData(buffer);

  let thumbnailUrl: string | null = null;
  if (thumbnail) {
    const thumbnailFilename = makeThumbnailFilename(userFilename);
    const resp = await storage().upload(thumbnail, thumbnailFilename);
    thumbnailUrl = resp.url;
  }

  // Create DB record
  const media = await db.media.create({
    data: {
      url: mediaUrl,
      thumbnailUrl,
      labels,
      altText,
      isPublic,
      ...imageData,
      size,
      userId: user.id,
      fileHash,
    },
  });

  return json(
    {
      id: media.id,
      url: getFullProxyImageUrl(media.id),
      thumbnailUrl: getFullProxyThumbnailUrl(media.id),
      labels: media.labels,
      altText: media.altText,
      width: media.width,
      height: media.height,
      color: media.color,
    },
    { status: 201 }
  );
}
