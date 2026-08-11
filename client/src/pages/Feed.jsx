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
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get("/posts", { params: { page } })
      .then(({ data }) => {
        setPosts(data.posts);
        setTotalPages(data.totalPages || 1);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  function handleImagePick(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function clearImage() {
    setImageFile(null);
    setImagePreview("");
  }

  async function createPost(event) {
    event.preventDefault();
    setError("");
    if (!body.trim()) {
      setError("Write something in the box above before posting.");
      return;
    }

    let image = "";
    try {
      if (imageFile) {
        setUploading(true);
        image = await uploadImage(imageFile);
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
      image,
      likes: [],
      comments: []
    };
    setPosts([optimistic, ...posts]);
    setBody("");
    setTags("");
    clearImage();
    api.post("/posts", { body: optimistic.body, tags: optimistic.tags, image }).then(({ data }) => {
      setPosts((items) => [data.post, ...items.filter((item) => item._id !== optimistic._id)]);
    }).catch(() => {});
  }

  return (
    <div className="content-grid">
      <section className="panel span-2">
        <form className="composer" onSubmit={createPost}>
          <div className="composer-top">
            <Avatar name={user?.name} image={user?.avatar} />
            <div className="composer-fields">
              <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Share your coding progress, project update, or interview learning." />
              {imagePreview && (
                <div className="composer-image-preview">
                  <img src={imagePreview} alt="Selected upload preview" />
                  <button type="button" className="icon-button" onClick={clearImage} aria-label="Remove image">
                    <X size={14} />
                  </button>
                </div>
              )}
              <input className="tags-input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Add tags: DSA, MERN, Placement" />
            </div>
          </div>
          {error && <p className="error">{error}</p>}
          <div className="composer-row">
            <label className="composer-attach">
              <Image size={18} />
              <input type="file" accept="image/*" onChange={handleImagePick} hidden />
            </label>
            <button className="primary pill" disabled={uploading}>{uploading ? "Uploading..." : "Post"}</button>
          </div>
        </form>
        <div className="list">
          {posts.map((post) => (
            <PostCard
              key={post._id}
              post={post}
              onDeleted={(id) => setPosts((items) => items.filter((item) => item._id !== id))}
            />
          ))}
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
