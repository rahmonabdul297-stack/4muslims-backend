# Scheduled tasks

Vercel Cron invokes the protected endpoints configured in `vercel.json`:

- `GET /api/v1/cron/auto-post` runs daily at 08:00 UTC (09:00 WAT) and enqueues eligible users' jobs.
- `GET /api/v1/cron/storage-cleanup` runs daily at 02:00 UTC.

Set `CRON_SECRET` in the Vercel project environment. Vercel sends it as a bearer token in the `Authorization` header for cron invocations.

Video rendering is not run inside the serverless API. Run `src/workers/videoRender.worker.ts` as a persistent worker service with the same MongoDB and third-party credentials.
