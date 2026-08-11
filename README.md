# DevConnect

DevConnect is a MERN-style social platform for developers: profiles, feed posts, project showcase, follow/search, notifications, coding groups, admin moderation, and real-time chat with Socket.io.

`client/` and `server/` are **two fully independent apps** — each has its own `package.json`, its own lockfile, and its own `.gitignore`. Either folder can be copied into its own git repository with zero changes. The root `package.json` is only a local-dev convenience for running both at once; it owns no dependencies of its own.

## Tech stack

- Frontend: React, Vite, React Router, Axios, Socket.io client, Lucide icons
- Backend: Node.js, Express, MongoDB/Mongoose, JWT, bcrypt, Socket.io
- Deployment target: Vercel for `client`, Render for `server`, MongoDB Atlas for database
- CI: GitHub Actions (separate pipelines per app, see below)

## Project structure

```
client/src/
├── App.jsx              # ~18 lines: just top-level routing
├── components/          # Shared UI pieces (Shell/nav, PostCard, Pagination, etc.)
├── pages/                # One file per route (Feed, Projects, Chat, Profile, Admin, ...)
├── lib/helpers.js        # initials(), splitList(), isValidUrl(), uploadImage()
├── state/AuthContext.jsx
└── data/demo.js          # Offline demo-mode fallback data

server/src/
├── index.js
├── models/               # User, Post, Project, Group, Conversation, Notification
├── routes/               # auth, users, posts, projects, search, uploads, chat, groups, notifications, admin
├── middleware/           # auth (JWT), rateLimit
├── utils/                # tokens, http, pagination
└── socket.js             # JWT-authenticated real-time chat
```

## Run locally

Since the apps are independent, install and run each separately (or use the root convenience scripts):

```bash
# from the project root - installs both
npm run install:all

# from the project root - runs both concurrently
npm run dev
```

Client: `http://localhost:5173`
Server: `http://localhost:5000`

Or run each on its own, from inside `client/` and `server/`:

```bash
cd server && npm install && npm run dev
cd client && npm install && npm run dev
```

## Environment variables

Create `server/.env` from `server/.env.example`.

Required for local backend:

```bash
PORT=5000
CLIENT_URL=http://localhost:5173
MONGODB_URI=mongodb://127.0.0.1:27017/devconnect
JWT_SECRET=replace-this-with-a-long-random-secret
JWT_EXPIRES_IN=7d
```

Optional for image upload:

```bash
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

## Important API routes

All list endpoints below are paginated: pass `?page=1&limit=12` (defaults to page 1, limit 12, max limit 50). Responses include `{ page, limit, total, totalPages, hasMore }` alongside the data.

- `POST /api/auth/register` / `POST /api/auth/login` - rate-limited (10 attempts / 15 min / IP)
- `GET /api/auth/me` - verify token and return current user
- `GET /api/posts` (**paginated**) / `POST /api/posts` - developer feed
- `PATCH /api/posts/:id` / `DELETE /api/posts/:id` - edit/delete your own post (or any post as admin)
- `POST /api/posts/:id/like` and `POST /api/posts/:id/comment` - engagement
- `GET /api/projects` (**paginated**) / `POST /api/projects` - project showcase
- `PATCH /api/projects/:id` / `DELETE /api/projects/:id` - edit/delete your own project (or any as admin)
- `GET /api/users` (**paginated**) - browse developers
- `GET /api/search?q=react` - search developers and projects
- `POST /api/users/:id/follow` - follow/unfollow developers
- `GET /api/chat` and `POST /api/chat/:userId` - conversations
- `GET /api/groups` / `POST /api/groups/:id/leave` - groups
- `POST /api/uploads/image` - Cloudinary image upload
- `GET /api/admin/stats` - admin dashboard metrics

## Security & production-level upgrades

- JWT auth with hashed passwords; server fails fast at boot if `JWT_SECRET` is missing
- Real-time chat authenticated via JWT on the socket handshake — a client can never spoof another user's identity by passing a fake sender id
- Search input is regex-escaped to prevent injection/ReDoS
- Rate limiting on login/register
- Shared async error handling and required-field validation
- Cloudinary-ready image upload endpoint using Multer memory storage
- Demo mode for UI walkthroughs before backend credentials are configured

## CI/CD

Two independent GitHub Actions workflows live in `.github/workflows/`:

- **`backend-ci.yml`** - runs `npm test` (the `mongodb-memory-server` + `supertest` suite) whenever `server/**` changes
- **`frontend-ci.yml`** - runs `npm run build` whenever `client/**` changes

Each only triggers on changes to its own folder, so a frontend-only PR won't wait on backend tests and vice versa.

> Note: neither folder has a committed `package-lock.json` yet (removed along with the old monorepo workspace lockfile). Run `npm install` once in each of `client/` and `server/`, commit the generated lockfiles, then switch the workflows' `npm install` back to `npm ci` (with `cache: npm` + `cache-dependency-path`) for faster, fully reproducible CI runs.

**Deployment (CD)** is handled by Render and Vercel's native git integration rather than a custom Actions deploy step — both platforms auto-deploy on every push to `main` once connected to the repo, which is simpler and doesn't require storing deploy credentials as GitHub secrets:

- Frontend: connect `client/` to Vercel, set `VITE_API_URL` to your Render backend URL
- Backend: connect the repo to Render using `render.yaml` (root path `server/`)
- Database: create a MongoDB Atlas cluster and set `MONGODB_URI` in Render
- Images: create a Cloudinary account and set the three Cloudinary environment variables in Render

## Interview talking points

- JWT auth with hashed passwords and protected routes
- Why chat needed its own auth layer: sockets don't get Express middleware for free, so identity has to be verified again at the socket handshake
- MongoDB relationship modeling for users, posts, comments, projects, groups, and conversations
- Real-time direct messaging through Socket.io rooms
- Pagination strategy (page/limit/skip) and why it matters at scale vs. a hardcoded `.limit(60)`
- Why client and server are decoupled apps rather than a tightly coupled monorepo, and what that buys you (independent deploys, independent CI, either one movable to its own repo)
- Search and developer matching by name, college, skills, and role
- Admin moderation and notification workflows

