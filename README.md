# Piano Picnic 🎹

A playful first music game for little musicians. Kids learn home and
companion chords, find notes on the staff, and train their ears — backed by a
real sampled upright piano.

## Games

- **Learn** — meet five key families, hear each chord whole or note by note,
  then build it yourself.
- **Find a note** — read one note on the treble staff and tap the matching key.
- **See a chord** — read all three notes of a chord and build it.
- **Hear a chord** — listen and rebuild the chord from sound alone (with
  progressive hints).

Three challenge levels: *Seedling* keeps note names visible and deals rounds in
order; *Explorer* hides names and shuffles the deck; *Superstar* reshuffles
between every full pass so nothing repeats back-to-back.

## Quick start

Requires Node.js `>=22.13.0` (Node 24 recommended).

```bash
npm install
npm run dev      # local dev server
npm test         # typecheck + lint + unit + fuzz + integration tests
npm run build    # production build into dist/
```

The app is built with [vinext](https://github.com/cloudflare/vinext)
(Next.js-style React Server Components on Vite) and deploys to Cloudflare
Workers. Piano sounds come from the [smplr](https://github.com/danigb/smplr)
sampler loading CC0 samples at runtime — no audio files ship with this repo.

## Project layout

| Path | Purpose |
| --- | --- |
| `app/page.tsx` | The game UI (client component). |
| `app/lib/music-theory.ts` | Chord data, keyboards, shuffling, note helpers — pure and unit-tested. |
| `app/lib/staff-geometry.ts` | Staff/notehead pixel geometry. |
| `app/lib/upright-piano-preset.ts` | smplr sampler preset for the upright piano. |
| `app/lib/return-path.ts` | Safe same-origin `return_to` validation. |
| `app/chatgpt-auth.ts` | Optional Sign in with ChatGPT helpers. |
| `worker/index.ts` | Cloudflare Worker entry (routing + image optimization). |
| `db/`, `drizzle/` | Optional Drizzle ORM + migrations for Cloudflare D1. |
| `examples/d1/` | Opt-in D1 example surface. |
| `tests/` | Unit, fuzz (property-based), and integration tests. |

## Testing

```bash
npm run test:unit         # pure logic: chords, staff geometry, sample coverage
npm run test:fuzz         # property-based fuzzing via fast-check
npm run test:integration  # builds, then exercises the real Worker output
```

Integration tests import the built server bundle from `dist/server/index.js`
and call its Worker `fetch` handler directly, asserting on rendered HTML,
status codes, and metadata. Fuzz tests generate hundreds of hostile inputs per
run for the shuffle logic and the return-path sanitizer.

CI runs the full suite on every push and pull request
(`.github/workflows/ci.yml`).

## Deploying to ChatGPT Sites

`.openai/hosting.json` declares optional Sites bindings (`d1`, `r2`). The
platform injects the project ID and real binding values at deploy time; this
repo intentionally ships them empty.

- Set `"d1": "DB"` to enable the D1 binding used by `db/index.ts`.
- `vite.config.ts` simulates declared bindings for local development.
- Generate Drizzle migrations after schema changes with `npm run db:generate`.

### Sign in with ChatGPT (optional)

Signed-in visitors arrive with `oai-authenticated-user-id` /
`oai-authenticated-user-email` headers. Import the helpers from
`app/chatgpt-auth.ts`:

- `getChatGPTUser()` — optional signed-in UI.
- `requireChatGPTUser(returnTo)` — redirect anonymous visitors to sign-in.
- `chatGPTSignInPath(returnTo)` / `chatGPTSignOutPath(returnTo)` — safe links;
  the `return_to` value is validated to be a same-origin relative path.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`,
the OAuth cookies, and identity header injection. Do not implement app routes
for those reserved paths. Mark protected pages with
`export const dynamic = "force-dynamic"`. SIWC establishes identity only — use
server-side membership checks for authorization.

Routes that never call the helpers remain anonymous-compatible.

## Attribution

- Piano samples: **"Upright Piano, Yamaha"** from the
  [Versilian Community Sample Library](https://versilian-studios.com/vcsl/) by
  Versilian Studios, licensed [CC0](https://creativecommons.org/publicdomain/zero/1.0/),
  served as ogg/m4a by the
  [smpldsnds mirror](https://github.com/smpldsnds/sgossner-vcsl).
- Sampler: [smplr](https://github.com/danigb/smplr) (MIT).
- Framework: [vinext](https://github.com/cloudflare/vinext),
  [Vite](https://vite.dev), [React](https://react.dev), Tailwind CSS 4.

## License

[MIT](LICENSE). The bundled game code is MIT; piano samples remain under their
upstream CC0 terms.
