# Codex Control Center

A deployable starter for a browser dashboard with Firebase-only application networking. Firebase Cloud Functions dispatch requests to a Vercel function, which triggers GitHub Actions to run Codex CLI.

## Status and limitations

This is a starter, **not** a fully configured production service. It does not implement multi-user ChatGPT OAuth, guaranteed renewable subscription tokens, in-dashboard live Codex output, or accurate ChatGPT subscription usage reporting. The GitHub Actions runner uses a `CODEX_AUTH_JSON` secret; credential portability and service terms must be checked before using it. The starter requires manual environment configuration and may incur Firebase/GitHub/Vercel charges. GitHub repository linking uses a fine-grained personal access token, not GitHub OAuth.

## Architecture

Browser (single `public/index.html`) → Firebase Auth, Firestore and callable Cloud Functions → Vercel `api/dispatch.js` → GitHub Actions → GitHub branch.

The browser also loads Firebase's official SDK from `www.gstatic.com`, but does **not** directly call Vercel. GitHub links are navigation only.

## Firebase setup

1. Create a Firebase project and web app. Enable Authentication (Email/Password and optionally Google), Firestore and Cloud Functions.
2. Replace the placeholder `firebaseConfig` values in `public/index.html` with your Firebase web app configuration.
3. Install the Firebase CLI and `npm install` in `functions/`.
4. Set functions secrets:
   - `firebase functions:secrets:set WORKER_URL` — your Vercel URL including `/api/dispatch`.
   - `firebase functions:secrets:set WORKER_SHARED_SECRET` — long random shared secret.
   - `firebase functions:secrets:set TOKEN_ENCRYPTION_KEY` — cryptographically random 32-byte value encoded as base64 (for example, `openssl rand -base64 32`).
5. Deploy `firebase deploy --only hosting,functions,firestore:rules`. Cloud Functions may require billing-enabled Firebase.

## Vercel setup

Import this repository into Vercel, deploy as a backend project, and set:
- `WORKER_SHARED_SECRET` to exactly the same value configured in Firebase.
- `FIREBASE_SERVICE_ACCOUNT_JSON` to a secure Firebase service account JSON string granting narrow access to task documents. Keep this secret server-side.

Vercel does not execute Codex; it dispatches a workflow through GitHub. A Vercel deployment is not a background job environment.

## GitHub and Codex

Place `.github/workflows/codex-task.yml` in each repository you wish to run tasks against. This workflow can also target this repository. A GitHub Actions secret named `CODEX_AUTH_JSON` must be configured **for each target repository**. Do not commit authentication JSON into Git. Before setting it up, verify that use of a ChatGPT-based Codex credential in hosted Actions is supported and secure for your use case; this starter does not provide an officially verified subscription-authenticated hosted task service.

In the dashboard, users sign in and manually provide their own GitHub fine-grained access token scoped to the desired repositories, with Contents and Actions permissions sufficient to dispatch workflows. Tokens are encrypted server-side and GitHub API calls occur from backend functions, not from the HTML file. Workflows commit changes to a new `codex/` branch.

## Usage and logs

New tasks appear in Firestore; click **Sync status** to fetch GitHub Actions run status. Click **View GitHub Actions log** for full logs. Firestore events currently show coarse status messages, not token-by-token agent output. Usage counter counts dashboard-submitted tasks, not actual subscription allowance.

## Security improvements required before public use

Implement proper GitHub App/OAuth connection with revocable installation grants, app-check protection, per-user rate limiting, repository allowlists, stricter authorization on worker requests, auditing, limits on untrusted prompt execution, hardened task branch handling, and scoped service-account permissions. The starter currently lets each signed-in user dispatch actions against repositories writable by their provided token.

## Notes

Model choices are examples that may not be supported by the installed Codex CLI. The task prompt is transmitted as a GitHub Actions workflow dispatch input and may be visible to repository collaborators. Do not use it for secrets.
