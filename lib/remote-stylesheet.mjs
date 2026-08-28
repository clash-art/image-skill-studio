export const REMOTE_STYLESHEET_ENV = "IMAGE_SKILL_STUDIO_REMOTE_STYLESHEET_URL";

export function normalizeRemoteStylesheetUrl(value) {
  if (!value || !String(value).trim()) return null;
  let url;
  try {
    url = new URL(String(value).trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.hash) return null;
  return url.toString();
}

export function remoteStylesheetOrigin(value) {
  const stylesheetUrl = normalizeRemoteStylesheetUrl(value);
  return stylesheetUrl ? new URL(stylesheetUrl).origin : null;
}

export function injectRemoteStylesheet(html, value) {
  const stylesheetUrl = normalizeRemoteStylesheetUrl(value);
  if (!stylesheetUrl) return String(html);
  const tag = `<link rel="stylesheet" data-image-skill-studio-remote href="${stylesheetUrl}">`;
  const source = String(html).replace(/<link rel="stylesheet" data-image-skill-studio-remote[^>]*>/g, "");
  if (source.includes("</head>")) return source.replace("</head>", `${tag}</head>`);
  return `${tag}${source}`;
}
