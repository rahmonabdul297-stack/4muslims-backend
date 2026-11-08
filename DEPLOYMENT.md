# Production deployment

This repository uses two runtimes that share the same source and MongoDB:

- **Vercel** runs the stateless Express API and its short cron-trigger endpoints.
- **A persistent Node worker** runs Agenda, FFmpeg video rendering, auto-post publishing, and storage cleanup.

Do not run the worker from the Vercel function or use Vercel's filesystem for persistent media. The worker uses local temporary files only while processing a job; completed media is stored in Cloudinary.

## Deploy the API to Vercel

1. Import the repository into Vercel with the repository root as the project root.
2. Add the API environment variables listed below in the Vercel project settings. Add them to Production and Preview only where those environments should have access.
3. Deploy. `vercel.json` builds `src/app.ts` as the Express function and rewrites all paths to it.
4. Verify `https://<deployment-domain>/health` returns `200`.
5. Vercel Cron calls the two protected endpoints configured in `vercel.json`. Cron schedules are UTC and are available on production deployments. Configure `CRON_SECRET` in Vercel so cron invocations carry the corresponding bearer token.

The health endpoint intentionally does not require MongoDB. API routes connect to MongoDB through request middleware and reuse the warm process connection.

## Run the background worker

The worker must be kept running by a service that supports long-lived Node processes. The included Dockerfile can be used on Render, Railway, Fly.io, or another container host:

1. Create a worker/background service from this repository and use the repository root as its build context.
2. Build with `Dockerfile` and provide the same MongoDB and Cloudinary environment variables as the API, plus the credentials required for Quran content and social publishing.
3. Start the container; its default command is `npm run worker`.
4. Keep at least one worker instance running. It polls Agenda jobs stored in MongoDB.

For a non-Docker Node service, use Node 22, install from `package-lock.json`, and set the start command to `npm run worker`.

For local development, run `npm run dev` for the API and `npm run dev:worker` in a second terminal if you need to process queued jobs.

The API's `/api/v1/videos/triggerautopost` and Vercel cron endpoints enqueue Agenda jobs. They return after queueing; the persistent worker performs rendering, uploads, and publishing.

## Environment variables

Copy `.env.example` as a reference only; never commit real secrets. Variables used by both runtimes:

- Required: `LIVE_MONGODB_URI`, `CLOUD_NAME`, `CLOUD_API_KEY`, `CLOUD_API_SECRET`
- Worker features: `RENDER_TIMEOUT_MS`, `QURAN_AUDIO_BITRATE`
- For publishing, configure OAuth credentials and redirect URIs for the enabled providers: Google, Facebook, TikTok, and YouTube
- For enabled integrations, configure `PAYSTACK_SECRET_KEY`, the email variables, and Twilio variables as needed

Vercel API variables:

- Required for authentication: `JWT_USER_SECRET`, `REFRESH_TOKEN_SECRET`
- Required for scheduled requests: `CRON_SECRET`
- CORS: `FRONTEND_URL`, and optionally comma-separated `FRONTEND_URLS`

Set `FRONTEND_URL` to the exact production origin, without a path or trailing slash. Keep `CRON_SECRET` and provider credentials private and never expose them as frontend `VITE_*` variables.

## Upload constraints

Vercel Functions have request-size, execution-time, and temporary-storage limits. Do not send large video uploads through the Vercel API. For large admin media, upload directly to Cloudinary using a server-generated signed upload or use a separate upload service. The included temporary-directory handling uses the runtime's temporary directory and does not provide persistent storage.
