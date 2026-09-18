import { Image, X } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api.js";
import { demoPosts } from "../data/demo.js";
import { useAuth } from "../state/AuthContext.jsx";
import Avatar from "../components/Avatar.jsx";
import PostCard from "../components/PostCard.jsx";
import NotificationList from "../components/NotificationList.jsx";
import Pagination from "../components/Pagination.jsx";
import { uploadImage } from "../lib/helpers.js";

export default function Feed() {
  const { user } = useAuth();
  const [posts, setPosts] = useState(demoPosts);
  const [feedMode, setFeedMode] = useState("all");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const params = { page };
    if (feedMode === "following") params.feed = "following";
    if (feedMode === "trending") params.feed = "trending";

    api.get("/posts", { params })
      .then(({ data }) => {
        setPosts(data.posts);
        setTotalPages(data.totalPages || 1);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, feedMode]);

  function switchFeed(mode) {
    if (mode === feedMode) return;
    setFeedMode(mode);
    setPage(1);
  }

  function handleImagePick(event) {
    const picked = Array.from(event.target.files || []);
    if (picked.length === 0) return;

    const combined = [...imageFiles, ...picked].slice(0, 4);
    setImageFiles(combined);
    setImagePreviews(combined.map((file) => URL.createObjectURL(file)));
    event.target.value = "";
  }

  function removeImage(index) {
    const next = imageFiles.filter((_, i) => i !== index);
    setImageFiles(next);
    setImagePreviews(next.map((file) => URL.createObjectURL(file)));
  }

  function clearImages() {
    setImageFiles([]);
    setImagePreviews([]);
  }

  async function createPost(event) {
    event.preventDefault();
    setError("");
    if (!body.trim()) {
      setError("Write something in the box above before posting.");
      return;
    }

    let images = [];
    try {
      if (imageFiles.length > 0) {
        setUploading(true);
        images = await Promise.all(imageFiles.map((file) => uploadImage(file)));
      }
    } catch (err) {
      setUploading(false);
      setError(err.response?.data?.message || "Image upload failed. Check Cloudinary configuration.");
      return;
    }
    setUploading(false);

    const optimistic = {
      _id: crypto.randomUUID(),
      author: JSON.parse(localStorage.getItem("devconnect_user") || "{}"),
      body,
      tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      images,
      likes: [],
      comments: []
    };
    setPosts([optimistic, ...posts]);
    setBody("");
    setTags("");
    clearImages();
    api.post("/posts", { body: optimistic.body, tags: optimistic.tags, images }).then(({ data }) => {
      setPosts((items) => [data.post, ...items.filter((item) => item._id !== optimistic._id)]);
    }).catch((err) => {
      // Roll back the placeholder since it was never actually saved, and
      // say why instead of pretending the post went through.
      setPosts((items) => items.filter((item) => item._id !== optimistic._id));
      setError(err.response?.data?.message || "Couldn't save your post. Check your connection and try again.");
    });
  }

  return (
    <div className="content-grid">
      <section className="panel span-2">
        <div className="feed-tabs">
          <button className={feedMode === "all" ? "selected" : ""} onClick={() => switchFeed("all")}>For You</button>
          <button className={feedMode === "trending" ? "selected" : ""} onClick={() => switchFeed("trending")}>Trending</button>
          <button className={feedMode === "following" ? "selected" : ""} onClick={() => switchFeed("following")}>Following</button>
        </div>
        <form className="composer" onSubmit={createPost}>
          <div className="composer-top">
            <Avatar name={user?.name} image={user?.avatar} />
            <div className="composer-fields">
              <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Share your coding progress, project update, or interview learning." />
              {imagePreviews.length > 0 && (
                <div className="composer-image-grid">
                  {imagePreviews.map((preview, index) => (
                    <div className="composer-image-preview" key={preview}>
                      <img src={preview} alt={`Selected upload ${index + 1}`} />
                      <button type="button" className="icon-button" onClick={() => removeImage(index)} aria-label="Remove image">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <input className="tags-input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Add tags: DSA, MERN, Placement" />
            </div>
          </div>
          {error && <p className="error">{error}</p>}
          <div className="composer-row">
            <label className="composer-attach">
              <Image size={18} />
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImagePick}
                disabled={imageFiles.length >= 4}
                hidden
              />
            </label>
            {imageFiles.length > 0 && <span className="composer-image-count">{imageFiles.length}/4</span>}
            <button className="primary pill" disabled={uploading}>{uploading ? "Uploading..." : "Post"}</button>
          </div>
        </form>
        <div className="list">
          {posts.map((post) => (
            <PostCard
              key={post._id}
              post={post}
              onDeleted={(id) => setPosts((items) => items.filter((item) => item._id !== id))}
              onUpdated={(updated) => setPosts((items) => items.map((item) => item._id === updated._id ? updated : item))}
            />
          ))}
          {!loading && feedMode === "following" && posts.length === 0 && (
            <div className="empty-state">
              <strong>Nothing here yet</strong>
              <span>Follow some developers in Network to see their posts here.</span>
            </div>
          )}
          {!loading && feedMode === "trending" && posts.length === 0 && (
            <div className="empty-state">
              <strong>Nothing trending right now</strong>
              <span>Posts with likes and comments in the last 2 days will show up here.</span>
            </div>
          )}
        </div>
        <Pagination page={page} totalPages={totalPages} onChange={setPage} loading={loading} />
      </section>
      <aside className="panel">
        <h2>Notifications</h2>
        <NotificationList />
      </aside>
    </div>
  );
}
