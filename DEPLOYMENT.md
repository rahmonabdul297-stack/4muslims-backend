# Vercel deployment

The Express API, queue storage, and job execution all run as Vercel Functions. MongoDB stores queued jobs durably. A function invocation claims one job, performs it, then records completion or schedules a bounded retry. No persistent worker host is required.

## Deploy the API

1. Import the repository into Vercel with the repository root as the project root.
2. Select Node.js 22.x.
3. Configure the environment variables listed below.
4. Deploy and verify `https://<deployment-domain>/health` returns `200`.

The function is configured for a maximum duration of 300 seconds. A video job must complete within that limit and fit Vercel's memory and bundle limits. This architecture is best effort for short renders; it does not make Vercel an unlimited FFmpeg worker. A timeout is recovered through the job lease/retry mechanism, but a render that repeatedly exceeds the limit will end in a failed job.

## Process queued jobs

Vercel Hobby cron jobs can run only once per day, so the repository includes a free GitHub Actions scheduler at `.github/workflows/process-vercel-jobs.yml` to call the Vercel processor endpoint every five minutes. GitHub scheduled workflows are best effort and can be delayed.

In the GitHub repository settings, add:

- **Variable** `VERCEL_API_URL`: the base production URL, e.g. `https://your-project.vercel.app` (no trailing slash).
- **Secret** `CRON_SECRET`: exactly the same random secret configured in Vercel.

The workflow processes one queued job per call. You can manually run it from GitHub Actions with **Run workflow**. The protected endpoint can also be called directly:

```text
GET https://<deployment-domain>/api/v1/cron/process-jobs
Authorization: Bearer <CRON_SECRET>
```

Job enqueue endpoints return a job ID. Check queue job state using:

```text
GET https://<deployment-domain>/api/v1/cron/jobs/<job-id>
Authorization: Bearer <CRON_SECRET>
```

The daily Vercel Cron endpoint `/api/v1/cron/auto-post` enqueues one auto-post job per eligible user. `/api/v1/cron/storage-cleanup` enqueues cleanup. The GitHub workflow processes those jobs. User-triggered custom video and auto-post endpoints also enqueue work.

## Environment variables

Configure these in Vercel. Add each external integration's credentials only if that feature is enabled:

- Database and media: `LIVE_MONGODB_URI`, `CLOUD_NAME`, `CLOUD_API_KEY`, `CLOUD_API_SECRET`
- Auth and cron: `JWT_USER_SECRET`, `REFRESH_TOKEN_SECRET`, `CRON_SECRET`
- CORS: `FRONTEND_URL`, optional comma-separated `FRONTEND_URLS`
- Email: `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`
- Google OAuth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- Facebook OAuth: `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `FACEBOOK_REDIRECT_URI`
- TikTok OAuth: `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_REDIRECT_URI`
- YouTube OAuth: `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REDIRECT_URI`
- Payment and SMS: `PAYSTACK_SECRET_KEY`, `TWILIO_ACC_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NO`
- Optional rendering: `RENDER_TIMEOUT_MS`, `QURAN_AUDIO_BITRATE`

Set `FRONTEND_URL` to an exact origin (scheme and hostname, no path or trailing slash). Never expose secrets as frontend `VITE_*` variables or commit them to Git.

## Operational limits

- One job is processed per invocation; the queue uses an atomic MongoDB claim and one global processor lease to avoid concurrent FFmpeg executions.
- Jobs retry up to three attempts with backoff. Check job state and Vercel Function logs to diagnose failures.
- GitHub Actions' five-minute schedule is not an exact SLA. For lower latency, use the manual workflow dispatch or call the protected processor endpoint.
- Upload large source videos directly to Cloudinary rather than proxying them through a Vercel function.
- Do not use the development-only `npm run worker:local` concurrently with production queue processing.
