# Forge Cloud

A personal Codex-style cloud coding workspace. The browser communicates only with Firebase Authentication and Firestore. A scheduled Cloudflare Worker processes durable commands, calls NVIDIA and GitHub, and publishes safe task views back to Firestore. D1 retains private agent context, task leases and a durable Firebase outbox.

## What works

- Firebase email/password sign-in for the dedicated workspace owner. The existing workspace password is unchanged.
- Repository and branch selection; Code and read-only Ask modes; durable tasks, cancellation, retries, follow-ups, activity, staged file previews and GitHub pull requests.
- A Thinking panel showing reasoning text supplied by the selected model, plus explicit public progress summaries and tool activity. Some models do not provide reasoning text; that absence is not replaced with fabricated thoughts.
- NVIDIA SSE streams are consumed server-side. Bounded progress snapshots reach the page through Firestore listeners; the browser never opens a model or Worker stream.
- Sanitized GitHub-flavored Markdown in responses, conversations and `.md` file previews, with raw-source views.
- Credential-free Node 22 command execution for public repositories through standard GitHub Actions runners. Real command output returns to the agent and Checks tab.
- Continued execution after the browser closes. Browser timers and page visibility are not responsible for execution.

## Network and data boundary

The frontend bundles Firebase, Marked and DOMPurify; it does not load runtime CDNs. Apart from the initial document, application requests go to:

- `identitytoolkit.googleapis.com` and `securetoken.googleapis.com` for Firebase Auth.
- `firestore.googleapis.com` for commands, cached repository metadata, task state, events and files.

The page's Content Security Policy permits only those hosts for connections, excluding same-origin Worker API requests. GitHub links remain ordinary user-initiated navigation. NVIDIA, GitHub, service-account and Browserless credentials never enter frontend code or Firestore views. Koyeb is not used. No Firebase Functions, Cloud Tasks, paid Cloud Scheduler, Blaze upgrade, or paid compute plan is provisioned.

Firestore uses `forgeCloud/forge-cloud-owner-v1/`:

- `commands/{id}`: owner-created immutable commands, processed by the backend. Clients cannot set their result or processing state.
- `views/{id}`: backend-owned configuration, repositories and branch caches.
- `tasks/{id}` with `events` and `files` subcollections: backend-owned safe task views and model/progress output.

System instructions, tool-response context and full working state remain in D1 and are excluded from Firebase views. `firebase_outbox` coalesces pending view updates and deletes them only after Firestore acknowledges a commit. The supplied Firestore rules preserve the pre-existing Dots app rules while adding this separate owner-only namespace.

## Execution and limits

The Worker cron runs every minute. It processes a small batch of Firebase commands and one eligible task turn per tick. Task leases recover interrupted work after five minutes, and command leases prevent concurrent dispatch. Creation uses the command ID as the task ID so replay cannot duplicate a task. Work continues without a browser connection; a new command or branch lookup can wait until the next scheduler tick.

Limits remain 3 active tasks, 24 turns per instruction, 5 follow-ups, 20 staged files, 100 KB per file, 260 KB context and 80 model calls per UTC day including retries. Transient inference failures receive at most two automatic retries. Large thinking output is bounded, and at most a few intermediate snapshots are published per model call to control free-tier usage.

Commands run in a separate Node 22 container with no provider credentials: up to 3 commands per task, 120 seconds each, 1 GB memory, 1 CPU and 128 processes. Container changes are ephemeral; persistent edits use the file-staging tools. Both runner and backend reject private-repository execution. Command text and logs are visible to readers of the public control repository.

This is not complete proprietary Codex feature parity: persistent app previews, interactive terminals, browser automation, multi-user OAuth, binary edits, file deletion and workflow-file edits are not implemented. Browserless is reserved but inactive. Free quotas apply across the entire Firebase/Cloudflare/provider account; failures stop work rather than enabling a paid plan. Review generated code before merging.

## Development

Node 22+:

```sh
npm ci
npm test
npm run build
```

`server/firebase-client.js` is bundled into the page. `server/firebase.js` implements the server-only Firebase adapter and durable outbox. `worker.js` owns task execution and the internal command handler. `scripts/build.mjs` bundles the Worker and embeds the page.

Optional Markdown browser regression check (Python Playwright and Chromium):

```sh
python3 tests/markdown.browser.py
```

Live Firebase authorization checks read the workspace password from a prompt or stdin; they never save it:

```sh
python3 tests/firebase.live.py
```

## Deployed configuration

- Site: https://forge-codex-cloud.crazyonetwo12345.workers.dev
- Firebase project: `dots-300de`, existing native Firestore database on its free tier.
- Dedicated Firebase Auth user: `forge-cloud-owner-v1`, email `forge-owner@dots-300de.firebaseapp.com`.
- Cloudflare Worker: `forge-codex-cloud`; D1 binding `DB` is configured in `wrangler.jsonc`.
- Public GitHub command runner: `.github/workflows/forge-runner.yml` on `connorgentile113-png/Codex-Thing`'s default branch.

Required Worker secrets: `FIREBASE_SERVICE_ACCOUNT_JSON`, `FIREBASE_OWNER_UID`, `NVIDIA_API_KEY`, `GITHUB_TOKEN`, and `ACCESS_PASSWORD` (internal compatibility API signing). `BROWSERLESS_TOKEN` is reserved. `GITHUB_OWNER` is a plain runtime variable. Service-account JSON must never be committed or placed in a client environment variable. The Firebase web API key is a public project identifier; authorization is enforced by Auth and Firestore rules.

Initialize/append D1 schema using `schema.sql`, configure Worker secrets, then deploy with Wrangler. Apply `firestore.rules` through Firebase's supported rules deployment, preserving unrelated existing rules. The dedicated Auth account and existing email/password sign-in were configured using server credentials; Firebase Functions are unnecessary. For a different project or owner, update the public SDK configuration, server project constants, owner UID, and matching rules together.

App login now uses Firebase Auth. Change its password through Firebase Authentication; changing the Worker's compatibility `ACCESS_PASSWORD` does not change Firebase sign-in. Keep a separately stored copy of the runtime service-account key and rotate provider credentials through the Worker secret controls.

## Verification

The deployed frontend was observed contacting only Firebase Auth and Firestore during login, repository reads and task submission. A submitted Firebase command was acknowledged, the browser was closed, and the cloud scheduler completed the task with stored thinking/progress records. Live rules checks verified owner access and rejected anonymous access, cross-workspace reads, view tampering, and step/session/provider command injection. Node tests cover task safety, credential/context exclusion from views, command budgets, packaging and the Firebase value encoding used by task views. Markdown and malicious-HTML checks run in a real browser.
