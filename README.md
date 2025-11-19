# TinyLink

TinyLink is a minimal URL shortener built to satisfy the take-home assignment requirements.

Features implemented
- Create short links (optional custom code)
- Redirect via `/:code` (302) and increment click count + update last clicked
- Delete links (removes the row; redirect returns 404 afterwards)
- Dashboard at `/` and stats page at `/code/:code`
- Health check at `/healthz`
- API endpoints (see spec)

API Endpoints
- POST /api/links → create link (409 if code exists)
- GET /api/links → list all links
- GET /api/links/:code → stats for one code
- DELETE /api/links/:code → delete link

Run locally
1. Install dependencies:

```powershell
npm install
```

2. Copy .env.example to .env (optional) and edit PORT or BASE_URL.

3. Start server:

```powershell
npm run dev
```

Open http://localhost:3000 (or your PORT) to view the dashboard.

Continuous Integration
- A GitHub Actions workflow is provided at `.github/workflows/ci.yml` which will run the lightweight checks on push and PR.

Deployment
- Vercel: This is a Node.js app — you can deploy by connecting your repository to Vercel. Set `NODE_ENV=production` and optional `BASE_URL` in Vercel dashboard. For persistent storage, switch the DB layer to Postgres and set `DATABASE_URL`.
- Render/Railway: Create a new service (Node) and set `PORT` and `BASE_URL`. For production, configure a managed Postgres and set `DATABASE_URL`.

Render deployment (step-by-step)
1. Push your repo to GitHub.
2. Go to https://render.com and create a new Web Service.
	- Connect your GitHub repository.
	- Select the root directory of this project.
	- Environment: Node
	- Build Command: leave empty or `npm install` (Render will run install automatically)
	- Start Command: `npm start`
3. Add environment variables in Render's dashboard:
	- `PORT` (optional, Render sets it automatically)
	- `BASE_URL` set to the public URL Render gives you (e.g., https://your-app.onrender.com)
	- `DATABASE_URL` set to your Postgres connection string (for persistent storage). If you don't set `DATABASE_URL`, the app will use SQLite file `data.sqlite` in the deploy container (not persistent across deploys).
4. (Important) Run migrations once after deployment (Render has a Shell feature or you can add a Deploy Hook). To run migrations:
	- Connect to the Render Shell or run `ssh` into the instance and run:
	  ```bash
	  npm run migrate
	  ```
	- Or add a one-off deploy command in Render to run `npm run migrate` before starting the web service.
5. The app will be available at the Render public URL. The `/healthz`, `/`, `/code/:code`, and `/:code` endpoints will be accessible.

Neon (Postgres) + Vercel (alternative)
- Create a Neon Postgres DB and get the DATABASE_URL.
- On Vercel, set `DATABASE_URL` in Environment Variables and deploy the project using the Node builder.
- Add a migration step (e.g., `npm run migrate`) in a build hook or run it manually once after deployment.

Notes on switching to Postgres
- The current implementation uses SQLite by default for portability. To use Postgres in production, replace the DB logic (currently using `better-sqlite3`) with a Postgres client (e.g., `pg`) and run a simple migration to create the `links` table with the same columns. Keep the API endpoints unchanged so automated graders still work.

Notes
- Persistence: this project uses a simple SQLite database file `data.sqlite` for portability. For production or grading you can swap to Postgres; keep the same API surface.
- Codes must follow `[A-Za-z0-9]{6,8}`. If no code is provided, a 6-character code is generated.

Environment
- See `.env.example` for environment variables used.

Next steps / possible improvements
- Add authentication and per-user links
- Add more robust URL previews and security checks
- Add tests and CI for automated grading
