# Forge Cloud

An independent, self-hosted Codex-style coding workspace. Cloudflare Workers runs the dashboard and agent, D1 stores tasks and events, NVIDIA supplies model inference, and GitHub supplies repositories, commits and pull requests.

## Implemented

- Password-protected personal workspace with signed HttpOnly sessions, login throttling, origin checks and server-side secrets.
- Owned-repository and branch selection; Code and read-only Ask modes.
- Durable queued tasks, background cron execution, per-task leases, cancellation, retries and activity logs.
- Repository tree browsing and UTF-8 file reading; staged complete-file edits; atomic commits on isolated branches; pull requests.
- Staged file inspection, GitHub checks, task search and status filtering; responsive layouts and keyboard shortcuts.
- Current NVIDIA models: Nemotron 3.5 Lightning, DeepSeek V4.1 Flash, GLM 5.3 Flash. Nemotron tool calling was verified during deployment.

## Actual limits

This is a working personal coding workspace, not a complete reproduction of OpenAI's proprietary Codex infrastructure. It does **not** include shell execution, an interactive terminal, live app preview, a browser agent, automatic test execution, OAuth/multi-user tenancy, file deletion, binary edits or workflow-file modifications. The Checks tab reads checks configured by the target repository. It does not manufacture test results. Browserless is reserved as a server-side credential but has no active feature. Firebase and Koyeb are not used and their resources were not changed.

A scheduled Worker advances active tasks once a minute when the browser is closed. The open task page also requests agent turns. Scheduled delivery is eventual; free-tier limits and model outages can delay or stop work. A task has a 24-turn budget, a maximum of 20 staged files and 100 KB per file; context is capped at 260 KB. Up to three tasks are active at once. The workspace caps model calls at 80 per UTC day. This is not a monetary guarantee: keep provider billing disabled and monitor the account's aggregate free quotas. No paid plan is enabled by this project.

A cancellation prevents the next agent operation; an external GitHub operation already in progress can still finish. Retry preserves state. Review generated code in its PR before merging. Do not put credentials into prompts or repository source. API credentials never enter model messages, browser responses, or Git history.

## Development and deployment

Node 22+; no application dependencies.

```sh
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

Configure GitHub `Contents: read/write`, `Pull requests: read/write`, and metadata access for the repositories you want to use. Workflow permissions are unnecessary for this version. A repository with no commits must be initialized before tasks can run. Repo and branch listing currently returns the first 100 results.

The initial deployment uses a generated workspace password. Rotate it with `wrangler secret put ACCESS_PASSWORD`; this invalidates all existing sessions. Rotate any provider credentials previously pasted into chat, then update Worker secrets. Do not commit `.dev.vars` or service-account files.

## Maintenance

D1 tables: `tasks`, `events`, and `usage`. Agent state can contain repository file contents; treat the database as private. History is retained until the owner removes it. Back up D1 before schema changes. Cron runs one bounded turn per active task per tick, and a three-minute lease permits recovery after an interrupted invocation. Model calls are counted before execution, including failed requests.
