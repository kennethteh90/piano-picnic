# Plan

Polish Piano Picnic and release it at `/v1`.

## Status

Complete. Version 1.0.0 is implemented at `/v1`. Tests, lint, the production audit, and the browser pass locally. Deploy still needs Cloudflare secrets.

## Tasks

1. [x] Add PLAN.md, PROGRESS.md, and BLOCKERS.md. Continue in the existing `piano-picnic` repository.
2. [x] Make Seedling, Explorer, and Superstar distinct, with hints that match each game and level. Cover the rules with unit tests.
3. [x] Add keyboard shortcuts for hear chord, hear notes, hint, and check, and ship the game at `/v1`.
4. [x] Add app version `1.0.0`, RELEASES changelog, first-party analytics, and error reporting.
5. [x] Keep CI on tests and lint, add an audit, and add CD that deploys on merge to `main`.
6. [x] Run tests, lint, audit, and build. Verify the `/v1` game in the browser.
