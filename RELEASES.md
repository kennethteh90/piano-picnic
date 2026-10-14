# Releases

## 1.0.0 — /v1

Released 2026-10-14.

- Seedling, Explorer, and Superstar now differ in deal order, on-screen names, piano labels, and how much a hint may reveal.
- Hints follow the game: Find a note, See a chord, Hear a chord, and Learn practice each get a clue that matches the level.
- Keyboard shortcuts: `C` hear chord, `N` hear notes, `H` hint, `Enter` check.
- The game is served at `/v1`. `/` redirects there.
- Version 1.0.0 is shown in the app and tracked here.
- First-party analytics and error reports record game events and sanitized failures. No cookies, accounts, or personal data.
- CI runs tests, lint, and a production-dependency audit. CD deploys to Cloudflare Workers after a successful push to `main`.
