# Security policy

## Supported versions

This is a single-version app; only the latest `main` branch receives security
fixes.

## Reporting a vulnerability

Please report vulnerabilities privately via GitHub's
**Security → Report a vulnerability** flow on this repository rather than
opening a public issue. Include a description, reproduction steps, and the
impact you observed. You can expect an initial response within a week.

## Scope notes

- The repo ships **no secrets**: `.openai/hosting.json` contains empty
  placeholders, real project IDs and bindings are injected by the hosting
  platform at deploy time, and `.env*` files are gitignored.
- User-supplied `return_to` values pass through
  `app/lib/return-path.ts`, which collapses anything that is not a
  same-origin relative path (and not a reserved auth route) to `/`. This
  sanitizer is fuzz-tested in `tests/fuzz/`.
- `npm audit` currently reports a small number of advisories inside the
  `drizzle-kit → esbuild` chain. drizzle-kit runs only as a local dev-time
  migration generator and is never bundled into the deployed worker.
