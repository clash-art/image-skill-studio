export function studioPreviewUrl(src, variant = "card") {
  if (!src || !String(src).startsWith("/studio-assets/")) return src;
  if (process.env.NODE_ENV !== "production") return src;

  const assetKey = String(src).slice("/studio-assets/".length);
  const previewKey = assetKey.replace(/\.[^./]+$/, ".webp");
  const previewVariant = variant === "reference" ? "reference" : "card";
  return `/studio-assets/_preview/${previewVariant}/${previewKey}`;
}
