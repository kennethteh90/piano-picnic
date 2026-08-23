# Contributing

Thanks for wanting to improve Piano Picnic! This is a small, friendly
codebase — the whole game lives in a handful of files.

## Setup

```bash
npm install
npm run dev     # start the dev server
npm test        # typecheck + lint + unit + fuzz + integration
```

Requires Node.js `>=22.13.0` (Node 24 recommended).

## Before opening a PR

- `npm test` passes (CI runs exactly this).
- New pure logic lands in `app/lib/*`, React-free and covered by tests.
  Keep these modules free of React/DOM imports so they stay testable under
  plain `node --test`.
- UI copy stays aimed at young children; keep tone warm and simple.
- Accessibility regressions are treated as bugs: keyboard-operable controls,
  `aria-pressed` on toggles, `aria-live` feedback.

## Conventions

- Plain TypeScript with erasable-only syntax in `app/lib/` (no enums,
  namespaces, or parameter properties) so Node's type stripping can run it.
- Prefer behavioral assertions (import the module, call the function) over
  source-text regex assertions.
- Audio samples must remain CC0-licensed; do not commit binary audio into the
  repo — presets reference remote CC0 libraries by URL.

## Reporting bugs

Open a GitHub issue with steps to reproduce and, if possible, the browser and
device. Security issues: see [SECURITY.md](SECURITY.md).
