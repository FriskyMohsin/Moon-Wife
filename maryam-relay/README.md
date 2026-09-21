# Maryam Cloud Run Relay Gateway

Standalone, secure Cloud Run Relay Gateway service for connecting Maryam Cloud Application with Mohsin's Local Tool Runner on Windows. Completely bypasses AI Studio preview cookie redirects (`302 /__cookie_check.html`).

---

## Service Endpoints

- `GET /health` : Public health check returning `{"status": "ok", "service": "maryam-relay"}`. No secrets exposed.
- `POST /api/runner/relay/poll` : Polling endpoint for Local Runner on Windows. Returns `204` when queue is empty or `200` with next `QUEUED` task.
- `POST /api/runner/relay/response` : Result submission endpoint for Local Runner. Validates `taskId` and handles duplicate submissions idempotently.
- `POST /api/runner/relay/task` : Task enqueue endpoint called by Maryam Cloud app.
- `POST /api/runner/relay/task/:taskId/await` : Long-poll await endpoint for task completion.
- `GET /api/runner/relay/status` : Status query endpoint.

---

## Security Features

1. **Machine Authentication**: Mandatory `x-runner-token` header verification using constant-time comparison (`crypto.timingSafeEqual`).
2. **Tool Allowlisting**: Bounded task queue strictly limited to approved browser, file, computer, OmniRoute, and dev tools. Generic shell execution is disabled.
3. **Task Expiration**: Stale tasks automatically expire (`expiresAt`) and are skipped.
4. **Idempotency**: Prevents duplicate task execution or double completion handling.
5. **No Secret Logging**: Sensitive tokens, headers, and keys are strictly omitted from server logs.

---

## Deployment Instructions to Google Cloud Run

Execute the following command in terminal to deploy the relay service to Google Cloud Run:

```bash
cd maryam-relay

gcloud run deploy maryam-relay \
  --source . \
  --platform managed \
  --region europe-west2 \
  --allow-unauthenticated \
  --set-env-vars RUNNER_TOKEN="YOUR_SECURE_RUNNER_TOKEN"
```

After deployment, copy the generated Cloud Run URL (e.g. `https://maryam-relay-12345-ew.a.run.app`).

---

## Integration Setup

1. **On Maryam Cloud App**:
   Set environment variable:
   `MARYAM_RELAY_URL=https://maryam-relay-12345-ew.a.run.app`
   `MARYAM_RUNNER_TOKEN=YOUR_SECURE_RUNNER_TOKEN`

2. **On Windows Laptop (Local Runner)**:
   Pass `--relay` flag or set environment variable:
   ```cmd
   set MARYAM_RELAY_URL=https://maryam-relay-12345-ew.a.run.app
   start-runner.bat
   ```
   Or launch directly:
   ```cmd
   start-runner.bat --relay https://maryam-relay-12345-ew.a.run.app
   ```
