// Turns a normal share link into an embeddable one. Returns null for
// anything unrecognised, so the caller can fall back to showing a plain
// link rather than a broken iframe.
export function toEmbedUrl(rawUrl) {
  if (!rawUrl) return null;

  let url;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "");

  if (host === "youtube.com" || host === "m.youtube.com") {
    const id = url.searchParams.get("v");
    if (id) return `https://www.youtube.com/embed/${id}`;
    // Handles /shorts/ID and /embed/ID forms too.
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] === "shorts" || parts[0] === "embed") return `https://www.youtube.com/embed/${parts[1]}`;
    return null;
  }

  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }

  if (host === "vimeo.com") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id ? `https://player.vimeo.com/video/${id}` : null;
  }

  if (host === "loom.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    const id = parts[parts.indexOf("share") + 1] || parts[1];
    return id ? `https://www.loom.com/embed/${id}` : null;
  }

  return null;
}
