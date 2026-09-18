import { Check, Flag, Heart, MessageSquare, Pencil, Repeat2, Send, Share2, Trash2, X } from "lucide-react";
import { useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../state/AuthContext.jsx";
import Avatar from "./Avatar.jsx";
import { fullTimestamp, timeAgo } from "../lib/helpers.js";

export default function PostCard({ post, onDeleted, onUpdated }) {
  const { user } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [likes, setLikes] = useState(post.likes || []);
  const [liking, setLiking] = useState(false);
  const [comments, setComments] = useState(post.comments || []);
  const [commentText, setCommentText] = useState("");
  const [showComments, setShowComments] = useState(false);
  const [posting, setPosting] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState(null);
  const [shared, setShared] = useState(false);
  const [actionError, setActionError] = useState("");
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(post.body);
  const [editTags, setEditTags] = useState((post.tags || []).join(", "));
  const [saving, setSaving] = useState(false);
  const [reported, setReported] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reposts, setReposts] = useState(post.repostOf?.reposts || post.reposts || []);
  const [reposting, setReposting] = useState(false);

  // A repost carries no content of its own - render the original's content
  // and credit its author, while attribution for the repost sits on top.
  const isRepost = Boolean(post.repostOf);
  const source = isRepost ? post.repostOf : post;
  const hasReposted = user?._id && reposts.some((id) => String(id?._id || id) === String(user._id));

  const isOwner = user?._id && post.author?._id && String(user._id) === String(post.author._id);
  // Editing only applies to original posts you wrote - a repost has no
  // content of its own to edit.
  const canEdit = isOwner && !isRepost;
  const hasLiked = user?._id && likes.some((id) => String(id?._id || id) === String(user._id));
  // Fallback/offline posts have short non-Mongo ids like "p1" and don't exist on the
  // server, so liking/commenting on them will always fail - flag it instead of guessing.
  const isRealPost = /^[a-f\d]{24}$/i.test(post._id);

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

  async function saveEdit(event) {
    event.preventDefault();
    if (!editBody.trim()) {
      setActionError("Post can't be empty.");
      return;
    }
    setSaving(true);
    setActionError("");
    try {
      const tags = editTags.split(",").map((tag) => tag.trim()).filter(Boolean);
      const { data } = await api.patch(`/posts/${post._id}`, { body: editBody, tags });
      onUpdated?.(data.post);
      setEditing(false);
    } catch (err) {
      setActionError(err.response?.data?.message || "Couldn't save changes.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleLike() {
    if (liking) return;
    setActionError("");
    if (!isRealPost) {
      setActionError("This is sample placeholder content, not a real post, so it can't be liked.");
      return;
    }
    // Optimistic update so it feels instant, rolled back only if the request actually fails.
    const wasLiked = hasLiked;
    setLikes((current) =>
      wasLiked
        ? current.filter((id) => String(id?._id || id) !== String(user._id))
        : [...current, user._id]
    );
    setLiking(true);
    try {
      await api.post(`/posts/${post._id}/like`);
    } catch (err) {
      setLikes((current) =>
        wasLiked
          ? [...current, user._id]
          : current.filter((id) => String(id?._id || id) !== String(user._id))
      );
      setActionError(err.response?.data?.message || "Couldn't update the like. Check your connection and try again.");
    } finally {
      setLiking(false);
    }
  }

  async function submitComment(event) {
    event.preventDefault();
    if (!commentText.trim() || posting) return;
    setActionError("");
    if (!isRealPost) {
      setActionError("This is sample placeholder content, not a real post, so it can't be commented on.");
      return;
    }
    setPosting(true);
    try {
      const { data } = await api.post(`/posts/${post._id}/comment`, { text: commentText });
      setComments(data.post.comments);
      setCommentText("");
    } catch (err) {
      setActionError(err.response?.data?.message || "Couldn't post the comment. Check your connection and try again.");
    } finally {
      setPosting(false);
    }
  }

  async function deleteComment(commentId) {
    if (!window.confirm("Delete this comment?")) return;
    setDeletingCommentId(commentId);
    try {
      const { data } = await api.delete(`/posts/${post._id}/comment/${commentId}`);
      setComments(data.post.comments);
    } catch (err) {
      setActionError(err.response?.data?.message || "Couldn't delete the comment.");
    } finally {
      setDeletingCommentId(null);
    }
  }

  async function handleShare() {
    // There's no dedicated per-post page to link to yet, so share copies the
    // post content itself - genuinely useful for pasting into WhatsApp/LinkedIn,
    // and honest about what it actually does rather than faking a share count.
    const text = `${post.body}\n\n— shared from DevConnect`;
    try {
      await navigator.clipboard.writeText(text);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch {
      setActionError("Couldn't copy to clipboard. Your browser may be blocking it.");
    }
  }

  async function toggleRepost() {
    if (reposting) return;
    setActionError("");
    if (!isRealPost) {
      setActionError("This is sample placeholder content, not a real post, so it can't be reposted.");
      return;
    }
    setReposting(true);
    try {
      const { data } = await api.post(`/posts/${source._id}/repost`);
      setReposts((current) =>
        data.reposted
          ? [...current, user._id]
          : current.filter((id) => String(id?._id || id) !== String(user._id))
      );
      if (data.reposted) setActionError("");
    } catch (err) {
      setActionError(err.response?.data?.message || "Couldn't repost.");
    } finally {
      setReposting(false);
    }
  }

  async function handleReport() {
    if (reporting || reported) return;
    setActionError("");
    if (!isRealPost) {
      setActionError("This is sample placeholder content, not a real post, so it can't be reported.");
      return;
    }
    if (!window.confirm("Report this post to the moderators?")) return;
    setReporting(true);
    try {
      await api.post(`/posts/${post._id}/report`);
      setReported(true);
    } catch (err) {
      setActionError(err.response?.data?.message || "Couldn't report this post.");
    } finally {
      setReporting(false);
    }
  }

  return (
    <article className="card post-card">
      {isRepost && (
        <div className="repost-attribution">
          <Repeat2 size={14} />
          <span>{post.author?.name} reposted</span>
        </div>
      )}
      <div className="post-card-head">
        <div className="person">
          <Avatar name={source.author?.name} image={source.author?.avatar} />
          <div>
            <strong>{source.author?.name}</strong>
            <small>{source.author?.title || source.author?.college || "Developer"}</small>
          </div>
        </div>
        <time className="timestamp" title={fullTimestamp(source.createdAt)}>
          {timeAgo(source.createdAt)}
          <span className="timestamp-full">{fullTimestamp(source.createdAt)}</span>
        </time>
      </div>
      {editing ? (
        <form className="post-edit-form" onSubmit={saveEdit}>
          <textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} />
          <input
            className="tags-input"
            value={editTags}
            onChange={(e) => setEditTags(e.target.value)}
            placeholder="Tags, comma separated"
          />
          {actionError && <p className="error post-error">{actionError}</p>}
          <div className="post-edit-actions">
            <button type="button" className="secondary pill" onClick={() => { setEditing(false); setEditBody(post.body); setEditTags((post.tags || []).join(", ")); setActionError(""); }}>
              Cancel
            </button>
            <button className="primary pill" disabled={saving}>{saving ? "Saving..." : "Save"}</button>
          </div>
        </form>
      ) : (
        <>
          <p>{source.body}</p>
          {source.images?.length > 0 && (
            <div className={`post-image-grid count-${Math.min(source.images.length, 4)}`}>
              {source.images.slice(0, 4).map((src, index) => (
                <img className="post-image" key={src + index} src={src} alt={`Post attachment ${index + 1}`} />
              ))}
            </div>
          )}
          {source.tags?.length > 0 && (
            <div className="tags">{source.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>
          )}
          <div className="actions">
            <button className={hasLiked ? "liked" : ""} onClick={toggleLike} disabled={liking}>
              <Heart size={15} fill={hasLiked ? "currentColor" : "none"} /> {likes.length}
            </button>
            <button onClick={() => setShowComments((value) => !value)}>
              <MessageSquare size={15} /> {comments.length}
            </button>
            <button
              className={hasReposted ? "reposted" : ""}
              onClick={toggleRepost}
              disabled={reposting}
            >
              <Repeat2 size={15} /> {reposts.length}
            </button>
            <button onClick={handleShare}>
              {shared ? <Check size={15} /> : <Share2 size={15} />} {shared ? "Copied" : "Share"}
            </button>
            {!isOwner && (
              <button onClick={handleReport} disabled={reporting || reported}>
                <Flag size={15} /> {reported ? "Reported" : "Report"}
              </button>
            )}
            {canEdit && (
              <button onClick={() => setEditing(true)}>
                <Pencil size={15} /> Edit
              </button>
            )}
            {isOwner && (
              <button className="danger-action" onClick={handleDelete} disabled={deleting}>
                <Trash2 size={15} /> {deleting ? "Deleting..." : "Delete"}
              </button>
            )}
          </div>
          {actionError && <p className="error post-error">{actionError}</p>}
        </>
      )}
      {showComments && (
        <div className="comment-thread">
          {comments.map((comment) => {
            const canDeleteComment =
              user?._id &&
              (String(comment.author?._id) === String(user._id) ||
                String(post.author?._id) === String(user._id) ||
                user.role === "admin");
            return (
              <div className="comment" key={comment._id}>
                <Avatar name={comment.author?.name} image={comment.author?.avatar} size="small" />
                <div>
                  <strong>{comment.author?.name}</strong>
                  <span>{comment.text}</span>
                </div>
                {canDeleteComment && (
                  <button
                    className="icon-button comment-delete"
                    onClick={() => deleteComment(comment._id)}
                    disabled={deletingCommentId === comment._id}
                    aria-label="Delete comment"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            );
          })}
          <form className="comment-form" onSubmit={submitComment}>
            <Avatar name={user?.name} image={user?.avatar} size="small" />
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Write a comment..."
            />
            <button className="icon-button" disabled={posting || !commentText.trim()} aria-label="Send comment">
              <Send size={14} />
            </button>
          </form>
        </div>
      )}
    </article>
  );
}
