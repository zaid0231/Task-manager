# Ethara Project Tracker

A web application for creating projects, assigning tasks, tracking progress, and controlling access with Admin/Member roles.

## Features

- User authentication (signup/login)
- Project creation and team membership
- Role-based access control for Admin and Member
- Task creation, assignment, and status tracking
- Dashboard with task status counts and overdue items
- REST API backend with SQL database support

## Tech stack

- Node.js + Express
- Knex.js with SQLite (local) / PostgreSQL (production)
- JWT authentication
- Static frontend with vanilla JavaScript

## Setup locally

1. Install dependencies

```bash
npm install
```

2. Start the server

```bash
npm start
```

3. Open `http://localhost:4000`

## Environment variables

Set these for production deployment:

- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — secret used to sign JWT tokens
- `PORT` — optional, defaults to `4000`

## Deployment to Railway

1. Create a Railway project and add a PostgreSQL plugin.
2. Set `DATABASE_URL` to the plugin's database URL.
3. Set `JWT_SECRET` in Railway variables.
4. Ensure the `start` script in `package.json` is `node server.js`.
5. Deploy the repository.

Railway will detect the Node.js app and start the server automatically.

## API endpoints

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:projectId`
- `PATCH /api/projects/:projectId`
- `DELETE /api/projects/:projectId`
- `POST /api/projects/:projectId/members`
- `GET /api/tasks/project/:projectId`
- `POST /api/tasks/project/:projectId`
- `PATCH /api/tasks/:taskId`
- `DELETE /api/tasks/:taskId`
- `GET /api/dashboard`

## Notes

- The app serves the frontend from `public/`.
- Local development uses SQLite at `./data/dev.db`.
- Production is designed to use PostgreSQL via `DATABASE_URL`.
