# Progress

## 2026-10-14

- Read the game UI, music-theory helpers, tests, and CI workflow.
- Decided the existing GitHub repo `kennethteh90/piano-picnic` is the project repo, so setup continues here.
- Current difficulty behavior is not distinct: Explorer and Superstar both hide names, and both reshuffle after a full pass (`difficulty !== "seedling"`). Hints exist only in Hear a chord, and Seedling Hear starts with a note already revealed.
- Planned three separate axes: deal order, on-screen names and piano labels, and hint strength. Shortcuts will be C (hear chord), N (hear notes), H (hint), and Enter (check).

- Added pure difficulty, hint, and shortcut modules. `npm run test:unit` and `tsc --noEmit` passed. Committed as `feat(game): separate difficulty levels and category hints`.
- Moved the game to `/v1` and redirected `/` with status 308. `npm test` passed, including the integration build. Committed as `feat(game): release the polished piano game at /v1`.
- Added version 1.0.0, RELEASES.md, `/api/analytics`, `/api/errors`, and CI/CD workflows. `npm test` and `npm run audit` passed. The error log redacts emails. Committed as `feat(release): add version 1.0.0, analytics, and deploy workflow`.
- Decided the audit gate is `npm audit --omit=dev`. A full audit still reports high advisories in the dev toolchain (vinext, wrangler, eslint, drizzle-kit). Forcing those fixes would downgrade the toolchain.
- Browser check against `http://localhost:3000/` with headless Chrome: `/` lands on `/v1`; Seedling, Explorer, and Superstar show different rules; Superstar hides key labels; Hear, See, Find a note, and Learn practice hints match the level; Enter checks an empty answer and a correct C; H is ignored until practice; `/api/analytics` is requested; no unexpected page errors. Mobile width 390 still shows the level summary and the three level buttons.

