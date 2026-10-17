const ABSOLUTE_URL = /^https?:\/\//i;

/**
 * Drafts store either a full Supabase Storage URL or an older `/scans/...` path.
 * Absolute URLs are used as stored. Relative scan paths point at the public bucket.
 */
export function resolveScanImageUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (ABSOLUTE_URL.test(trimmed)) return trimmed;

  const withoutSlash = trimmed.replace(/^\/+/, "");
  const filename = withoutSlash.startsWith("scans/")
    ? withoutSlash.slice("scans/".length)
    : withoutSlash;
  if (!filename || filename.includes("..") || filename.includes("/")) {
    return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  }

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  if (!base) return `/scans/${filename}`;
  return `${base}/storage/v1/object/public/scans/${encodeURIComponent(filename)}`;
}
