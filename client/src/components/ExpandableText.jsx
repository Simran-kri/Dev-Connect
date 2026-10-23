import { useState } from "react";

const LIMIT = 280;

export default function ExpandableText({ text = "" }) {
  const [expanded, setExpanded] = useState(false);

  if (text.length <= LIMIT) {
    return <p className="post-text">{text}</p>;
  }

  return (
    <p className="post-text">
      {expanded ? text : `${text.slice(0, LIMIT).trimEnd()}...`}{" "}
      <button type="button" className="link-button" onClick={() => setExpanded((value) => !value)}>
        {expanded ? "Show less" : "Read more"}
      </button>
    </p>
  );
}