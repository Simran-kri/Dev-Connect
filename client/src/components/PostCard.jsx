import { Heart, MessageSquare, Share2, Trash2 } from "lucide-react";
import { useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../state/AuthContext.jsx";
import Avatar from "./Avatar.jsx";
import { timeAgo } from "../lib/helpers.js";

export default function PostCard({ post, onDeleted }) {
  const { user } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const isOwner = user?._id && post.author?._id && String(user._id) === String(post.author._id);

  async function handleDelete() {
    if (!window.confirm("Delete this post? This can't be undone.")) return;
    setDeleting(true);
    try {
      await api.delete(`/posts/${post._id}`);
      onDeleted?.(post._id);
    } catch {
      setDeleting(false);
    }
  }

  return (
    <article className="card post-card">
      <div className="post-card-head">
        <div className="person">
          <Avatar name={post.author?.name} image={post.author?.avatar} />
          <div>
            <strong>{post.author?.name}</strong>
            <small>{post.author?.title || post.author?.college || "Developer"}</small>
          </div>
        </div>
        <time className="timestamp">{timeAgo(post.createdAt)}</time>
      </div>
      <p>{post.body}</p>
      {post.image && <img className="post-image" src={post.image} alt="Post attachment" />}
      {post.tags?.length > 0 && (
        <div className="tags">{post.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>
      )}
      <div className="actions">
        <button><Heart size={15} /> {post.likes?.length || 0}</button>
        <button><MessageSquare size={15} /> {post.comments?.length || 0}</button>
        <button><Share2 size={15} /> Share</button>
        {isOwner && (
          <button className="danger-action" onClick={handleDelete} disabled={deleting}>
            <Trash2 size={15} /> {deleting ? "Deleting..." : "Delete"}
          </button>
        )}
      </div>
    </article>
  );
}
