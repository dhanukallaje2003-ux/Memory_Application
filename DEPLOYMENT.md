# Deployment Guide

This project is ready to deploy on Vercel with MongoDB Atlas.

## What This App Needs

- A GitHub repository for this project
- A Vercel account
- A MongoDB Atlas cluster
- Three production environment variables:

```env
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-host>/<database>?retryWrites=true&w=majority
JWT_SECRET=<strong-random-string>
JWT_REFRESH_SECRET=<another-strong-random-string>
```

Generate JWT secrets with:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Do not commit real database credentials or JWT secrets.

## Local Development

1. Install dependencies:

```sh
npm install
```

2. Create `.env.local` from `.env.example` and fill in your values.

3. Run the frontend and backend:

```sh
npm run dev:full
```

Frontend: `http://localhost:8080`
Backend: `http://localhost:3001`

## Deploy to Vercel

1. Push this project to GitHub.

2. In Vercel, create a new project and import the repository.

3. Use these project settings:

- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`

4. Add these Vercel environment variables in `Settings -> Environment Variables`:

- `MONGODB_URI`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`

5. Deploy.

## MongoDB Atlas Settings

In MongoDB Atlas, open `Network Access` and allow Vercel to connect. For a simple first deployment, you can use `0.0.0.0/0`. For a stricter production setup, configure tighter access rules later.

## Verification

After deployment:

- Open the Vercel URL.
- Register a new account.
- Log in.
- Add a memory.
- Add a mood.
- Export a PDF report.

If something fails, check Vercel deployment logs first, then MongoDB Atlas connection/network settings.
