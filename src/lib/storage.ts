import { supabase } from "@/lib/supabase";

/** Public bucket that holds candidate portraits. Created in migration 007. */
export const CANDIDATE_PHOTO_BUCKET = "candidate-photos";

/** Mirrors the bucket's server-side limits so we can fail fast in the UI. */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

const ALLOWED_PHOTO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** Value for a file input's `accept` attribute. */
export const PHOTO_ACCEPT = ".png,.jpg,.jpeg,.webp,.gif,image/*";

/** Returns a human-readable problem with the chosen file, or null if it is fine. */
export function photoValidationError(file: File): string | null {
  if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
    return "Use a PNG, JPG, WEBP or GIF image.";
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return "That image is larger than 5 MB. Please choose a smaller file.";
  }
  return null;
}

/**
 * Uploads a candidate portrait and returns the public URL to save on the row.
 * Throws with the storage message if the upload is rejected.
 */
export async function uploadCandidatePhoto(file: File, electionId: string): Promise<string> {
  const extension = EXTENSION_BY_TYPE[file.type] ?? "jpg";
  const path = `${electionId}/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage
    .from(CANDIDATE_PHOTO_BUCKET)
    .upload(path, file, { cacheControl: "31536000", contentType: file.type, upsert: false });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(CANDIDATE_PHOTO_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
