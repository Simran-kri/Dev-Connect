import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../state/AuthContext.jsx";

const STATUS_LABEL = {
  open: "Open for applications",
  assigned: "In progress",
  submitted: "Work submitted",
  accepted: "Accepted",
  cancelled: "Cancelled"
};

function errorOf(err) {
  return err.response?.data?.message || "Something went wrong. Please try again.";
}


function SprintCard({ sprint, run }) {
  const [note, setNote] = useState("");
  const [url, setUrl] = useState("");
  const [submitNote, setSubmitNote] = useState("");

  const deadline = sprint.deadline ? new Date(sprint.deadline).toLocaleDateString("en-IN") : "";

  return (
    <article className="card">
      <h3>{sprint.title}</h3>
      <small>
        {STATUS_LABEL[sprint.status]} · ₹{sprint.budget} · Deadline {deadline} · Posted by {sprint.poster?.name || "Client"}
        {sprint.assignee && ` · Assigned to ${sprint.assignee.name}`}
      </small>
      <p>{sprint.description}</p>
      <div className="tags">{(sprint.skills || []).map((skill) => <span key={skill}>{skill}</span>)}</div>

      {/* Visible to the person who posted the sprint */}
      {sprint.isPoster && (
        <>
          <small>{sprint.applicantCount} applied</small>

          {sprint.status === "open" && sprint.applicants?.length > 0 && (
            <div className="group-member-list">
              {sprint.applicants.map((a) => (
                <div className="person compact" key={a.user._id}>
                  <div>
                    <strong>{a.user.name}</strong>
                    {a.note && <small>{a.note}</small>}
                  </div>
                  <button
                    className="secondary pill"
                    onClick={() => run(
                      () => api.post(`/sprints/${sprint._id}/assign`, { userId: a.user._id }),
                      "Student chosen. They've been notified."
                    )}
                  >
                    Choose
                  </button>
                </div>
              ))}
            </div>
          )}

          {sprint.deliverable?.url && (
            <p>
              Work:{" "}
              <a href={sprint.deliverable.url} target="_blank" rel="noreferrer">{sprint.deliverable.url}</a>
              {sprint.deliverable.note && <small> — {sprint.deliverable.note}</small>}
            </p>
          )}

          {sprint.status === "submitted" && (
            <button
              className="primary pill"
              onClick={() => run(() => api.post(`/sprints/${sprint._id}/accept`), "Work accepted.")}
            >
              Accept work
            </button>
          )}

          {["open", "assigned"].includes(sprint.status) && (
            <button
              className="secondary pill danger-action"
              onClick={() => {
                if (window.confirm("Cancel this sprint?")) {
                  run(() => api.post(`/sprints/${sprint._id}/cancel`), "Sprint cancelled.");
                }
              }}
            >
              Cancel sprint
            </button>
          )}
        </>
      )}

      {/* Visible to students who can apply */}
      {!sprint.isPoster && sprint.status === "open" && !sprint.hasApplied && (
        <div className="composer-row">
          <input
            placeholder="Why are you a good fit? (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button
            className="primary pill"
            onClick={() => run(
              () => api.post(`/sprints/${sprint._id}/apply`, { note }),
              "Applied. The client will review it."
            )}
          >
            Apply
          </button>
        </div>
      )}
      {!sprint.isPoster && sprint.status === "open" && sprint.hasApplied && (
        <small>You've applied to this sprint.</small>
      )}

      {/* Visible to the student who was chosen */}
      {sprint.isAssignee && sprint.status === "assigned" && (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => api.post(`/sprints/${sprint._id}/submit`, { url, note: submitNote }),
              "Work submitted. The client will review it."
            );
          }}
        >
          <input
            placeholder="Link to your work (GitHub, live demo, or Drive)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <input
            placeholder="Short note for the client (optional)"
            value={submitNote}
            onChange={(e) => setSubmitNote(e.target.value)}
          />
          <button className="primary pill">Submit work</button>
        </form>
      )}
      {sprint.isAssignee && sprint.deliverable?.url && (
        <p>
          Submitted:{" "}
          <a href={sprint.deliverable.url} target="_blank" rel="noreferrer">{sprint.deliverable.url}</a>
        </p>
      )}
    </article>
  );
}

export default function Sprints() {
  const { user } = useAuth();
  const [view, setView] = useState("open");
  const [sprints, setSprints] = useState([]);
  const [proof, setProof] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", skills: "", budget: "", deadline: "" });

  async function loadSprints(nextView) {
    setLoading(true);
    try {
      const { data } = await api.get("/sprints", { params: nextView === "mine" ? { mine: 1 } : {} });
      setSprints(data.sprints);
    } catch (err) {
      setError(errorOf(err));
    } finally {
      setLoading(false);
    }
  }

  async function loadProof() {
    if (!user?._id) return;
    try {
      const { data } = await api.get(`/sprints/proof/${user._id}`);
      setProof(data.proof);
    } catch {
      setProof([]);
    }
  }

  useEffect(() => {
    loadSprints(view);
  }, [view]);

  useEffect(() => {
    loadProof();
  }, [user?._id]);

  async function refresh() {
    await loadSprints(view);
    await loadProof();
  }

  // Runs an action, shows the result, and reloads the page's data.
  async function run(action, successMessage) {
    setError("");
    setNotice("");
    try {
      await action();
      if (successMessage) setNotice(successMessage);
      await refresh();
    } catch (err) {
      setError(errorOf(err));
    }
  }

  async function createSprint(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setCreating(true);
    try {
      await api.post("/sprints", form);
      setForm({ title: "", description: "", skills: "", budget: "", deadline: "" });
      setNotice("Sprint posted. Students can now apply.");
      await refresh();
    } catch (err) {
      setError(errorOf(err));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="content-grid">
      <section className="panel">
        <h2>Post a sprint</h2>
        <form className="stack" onSubmit={createSprint}>
          <input
            placeholder="What do you need built? e.g. Coaching centre enquiry form"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <textarea
            placeholder="Describe the scope, what 'done' looks like, and what you'll provide"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <input
            placeholder="Skills needed, e.g. React, Node, WordPress"
            value={form.skills}
            onChange={(e) => setForm({ ...form, skills: e.target.value })}
          />
          <input
            type="number"
            min="0"
            placeholder="Budget in ₹"
            value={form.budget}
            onChange={(e) => setForm({ ...form, budget: e.target.value })}
          />
          <input
            type="date"
            value={form.deadline}
            onChange={(e) => setForm({ ...form, deadline: e.target.value })}
          />
          <small>
            Agree on payment directly with the student for now. DevConnect doesn't hold or transfer money yet.
          </small>
          <button className="primary pill" disabled={creating}>
            {creating ? "Posting..." : "Post sprint"}
          </button>
        </form>
      </section>

      <section className="panel span-2">
        <div className="feed-tabs">
          <button className={view === "open" ? "selected" : ""} onClick={() => setView("open")}>Open sprints</button>
          <button className={view === "mine" ? "selected" : ""} onClick={() => setView("mine")}>My sprints</button>
        </div>

        {notice && <p className="success">{notice}</p>}
        {error && <p className="error">{error}</p>}

        {loading ? (
          <p className="empty-state">Loading sprints...</p>
        ) : sprints.length === 0 ? (
          <div className="empty-state">
            <strong>{view === "open" ? "No open sprints yet" : "You have no sprints yet"}</strong>
            <span>Post one on the left, or apply to an open sprint.</span>
          </div>
        ) : (
          <div className="list">
            {sprints.map((sprint) => (
              <SprintCard key={sprint._id} sprint={sprint} run={run} />
            ))}
          </div>
        )}
      </section>

      <section className="panel span-2">
        <h2>Verified work</h2>
        <p className="auth-note">Sprints where the client accepted the work.</p>
        {proof.length === 0 ? (
          <p className="empty-state">No accepted work yet.</p>
        ) : (
          <div className="list">
            {proof.map((item) => (
              <article className="card" key={item._id}>
                <h3>{item.title}</h3>
                <small>
                  Client: {item.client} · Accepted {new Date(item.acceptedAt).toLocaleDateString("en-IN")}
                </small>
                <div className="tags">{(item.skills || []).map((skill) => <span key={skill}>{skill}</span>)}</div>
                {item.deliverableUrl && (
                  <a href={item.deliverableUrl} target="_blank" rel="noreferrer">View the work</a>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
