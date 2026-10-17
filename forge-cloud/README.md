# Forge Cloud

An independent, self-hosted Codex-style coding workspace. Cloudflare Workers runs the dashboard and agent, D1 stores tasks and events, NVIDIA supplies model inference, and GitHub supplies repositories, commits and pull requests.

## Implemented

- Password-protected personal workspace with signed HttpOnly sessions, login throttling, origin checks and server-side secrets.
- Owned-repository and branch selection; Code and read-only Ask modes.
- Durable queued tasks, background cron execution, per-task leases, cancellation, bounded inference retries, follow-up instructions and activity logs.
- Repository tree browsing and UTF-8 file reading; staged complete-file edits; atomic commits on isolated branches; pull requests.
- Credential-free Node 22 command execution on standard GitHub-hosted Actions runners for public repositories; actual command output is fed back to the agent.
- Sanitized GitHub-flavored Markdown in responses, conversations, and staged `.md` files (with a raw-source view): headings, lists, tables, links, task lists, and code blocks. Parser and sanitizer are bundled locally.
- Staged file inspection, GitHub checks, task search and status filtering; responsive layouts and keyboard shortcuts.
- Current NVIDIA-hosted models: GPT OSS 20B (default), Nemotron 3.5 Lightning, DeepSeek V4.1 Flash, GLM 5.3 Flash. GPT OSS and Nemotron tool calling were verified during deployment. A timeout can switch an alternate model to the default, with the change recorded in activity.

## Actual limits

This is a working personal coding workspace, not a complete reproduction of OpenAI's proprietary Codex infrastructure. It does **not** include an interactive terminal, persistent app preview, a browser agent, OAuth/multi-user tenancy, file deletion, binary edits or workflow-file modifications. Code mode can request up to 3 commands per task, with a 120-second command budget, 1 GB memory, 1 CPU, and a 128-process cap. Commands run in a separate container with no provider credentials, and their output is returned to the agent. The container has outbound networking for dependency installation; its filesystem edits are ephemeral. Public-repository standard GitHub Actions runners are used; private targets are rejected by both the Worker and workflow. Command text and logs are visible to repository readers. The Checks tab displays real command conclusions and checks configured by the target repository. No test pass is assumed. Browserless is reserved as a server-side credential but has no active feature. Firebase and Koyeb are not used and their resources were not changed.

A scheduled Worker advances active tasks once a minute when the browser is closed. The open task page also requests agent turns. The scheduler awaits each turn independently of browser connections; activity records distinguish cloud-scheduler execution from workspace requests. Interrupted turns recover after their lease expires. Scheduled delivery is eventual; free-tier limits and model outages can delay or stop work. A task has a 24-turn budget, a maximum of 20 staged files and 100 KB per file; context is capped at 260 KB. Up to three tasks are active at once. The workspace caps model calls at 80 per UTC day, including retries. Each instruction allows at most two transient inference retries, and up to five follow-ups can continue a task. This is not a monetary guarantee: keep provider billing disabled and monitor the account's aggregate free quotas. No paid plan is enabled by this project.

A cancellation prevents the next agent operation; an external GitHub operation already in progress can still finish. Retry preserves state. Review generated code in its PR before merging. Do not put credentials into prompts or repository source. API credentials never enter model messages, browser responses, or Git history.

## Development and deployment

Node 22+. Markdown dependencies are pinned in package-lock.json and bundled into the Worker; the browser needs no CDN.

```sh
npm ci
npm test
npm run build
```

Use a recent Wrangler CLI for local emulation or redeployment. `wrangler.jsonc` contains only resource identifiers, never credentials. Copy `.env.example` to ignored `.dev.vars` for local development, populate values privately, and initialize D1 using `schema.sql`. For a fresh account create a new database and replace the binding ID.

```sh
npx wrangler d1 execute forge-cloud-tasks-20261017 --file schema.sql --remote
npx wrangler secret put NVIDIA_API_KEY
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put ACCESS_PASSWORD
npx wrangler secret put BROWSERLESS_TOKEN
npx wrangler deploy
```

Configure GitHub `Contents: read/write`, `Pull requests: read/write`, and metadata access for the repositories you want to use. The command runner also requires Actions write/read permission on `Codex-Thing`, whose default branch must contain `.github/workflows/forge-runner.yml`. That workflow is included in this source. Repository Contents access alone is sufficient for tasks that do not execute commands. A repository with no commits must be initialized before tasks can run. Repo and branch listing currently returns the first 100 results.

The initial deployment uses a generated workspace password. Rotate it with `wrangler secret put ACCESS_PASSWORD`; this invalidates all existing sessions. Rotate any provider credentials previously pasted into chat, then update Worker secrets. Do not commit `.dev.vars` or service-account files.

Optional browser Markdown/security regression check (requires Python Playwright and Chromium):

```sh
python3 tests/markdown.browser.py
```

A live disconnect check submitted a read-only task, closed the submitting client, and observed only D1 records. Two scheduler-driven turns completed it in about 80 seconds; both turns are labeled in task activity. No browser step endpoint was called. Browser regression checks also verified Markdown formatting and removal of script, event-handler, and JavaScript-link payloads.

## Maintenance

D1 tables: `tasks`, `events`, and `usage`. Agent state can contain repository file contents; treat the database as private. History is retained until the owner removes it. Back up D1 before schema changes. Cron runs one bounded turn per active task per tick, and a five-minute lease permits recovery after an interrupted invocation. Model calls are counted before execution, including failed requests.
