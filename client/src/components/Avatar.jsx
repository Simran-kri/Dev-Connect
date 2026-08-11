import { initials } from "../lib/helpers.js";

export default function Avatar({ name, image, size = "" }) {
  const className = ["avatar", size].filter(Boolean).join(" ");

  if (image) {
    return <img className={`${className} image-avatar`} src={image} alt={name || "avatar"} />;
  }

  return <span className={className}>{initials(name)}</span>;
}
