import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { app, server } from "../src/index.js";
import User from "../src/models/User.js";
import Post from "../src/models/Post.js";
import Project from "../src/models/Project.js";

let mongo;

async function registerUser(overrides = {}) {
  const payload = {
    name: "Test User",
    email: `user-${Date.now()}-${Math.random()}@devconnect.local`,
    password: "password123",
    college: "Test College",
    skills: ["React", "Node"],
    ...overrides
  };

  const response = await request(app).post("/api/auth/register").send(payload).expect(201);
  return response.body;
}

before(async () => {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "test-secret";
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Post.deleteMany({}),
    Project.deleteMany({})
  ]);
});

after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
  server.close();
});

describe("auth", () => {
  it("registers users with a token and hides password", async () => {
    const { token, user } = await registerUser();

    assert.ok(token);
    assert.equal(user.email.includes("@devconnect.local"), true);
    assert.equal(user.password, undefined);
    assert.deepEqual(user.skills, ["React", "Node"]);
  });

  it("rejects duplicate emails", async () => {
    await registerUser({ email: "duplicate@devconnect.local" });

    await request(app)
      .post("/api/auth/register")
      .send({
        name: "Duplicate User",
        email: "duplicate@devconnect.local",
        password: "password123"
      })
      .expect(409);
  });

  it("protects authenticated routes", async () => {
    await request(app).get("/api/posts").expect(401);

    const { token } = await registerUser();
    await request(app)
      .get("/api/posts")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
  });
});

describe("posts", () => {
  it("creates and lists feed posts", async () => {
    const { token } = await registerUser();

    const created = await request(app)
      .post("/api/posts")
      .set("Authorization", `Bearer ${token}`)
      .send({ body: "Solved dynamic programming today.", tags: "DSA, DP" })
      .expect(201);

    assert.equal(created.body.post.body, "Solved dynamic programming today.");
    assert.deepEqual(created.body.post.tags, ["DSA", "DP"]);

    const list = await request(app)
      .get("/api/posts")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    assert.equal(list.body.posts.length, 1);
  });
});

describe("projects and search", () => {
  it("creates projects, fetches details, and searches by tech stack", async () => {
    const { token } = await registerUser();

    const created = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Interview Tracker",
        description: "Tracks applications, rounds, notes, and offers.",
        techStack: "React, Express, MongoDB",
        github: "https://github.com/example/interview-tracker",
        liveDemo: "https://example.vercel.app"
      })
      .expect(201);

    const projectId = created.body.project._id;
    assert.deepEqual(created.body.project.techStack, ["React", "Express", "MongoDB"]);

    const detail = await request(app)
      .get(`/api/projects/${projectId}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    assert.equal(detail.body.project.title, "Interview Tracker");

    const search = await request(app)
      .get("/api/search?q=MongoDB")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    assert.equal(search.body.projects.length, 1);
  });
});

