# Scheduled tasks

See the root [deployment guide](../../../DEPLOYMENT.md) for the Vercel queue processor and environment setup.

Vercel Cron invokes the protected endpoints configured in `vercel.json`:

- `GET /api/v1/cron/auto-post` runs daily at 08:00 UTC (09:00 WAT) and enqueues eligible users' jobs.
- `GET /api/v1/cron/storage-cleanup` queues a cleanup job daily at 02:00 UTC.

Set `CRON_SECRET` in the Vercel project environment. Vercel sends it as a bearer token in the `Authorization` header for cron invocations.

Hobby cron is limited to once daily. The GitHub Actions workflow calls `/process-jobs` every five minutes to process one queued job per invocation; configure the workflow's `VERCEL_API_URL` variable and `CRON_SECRET` secret in GitHub.
