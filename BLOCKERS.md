# Blockers

## Resolved

- A new repository was not created. This workspace is already `https://github.com/kennethteh90/piano-picnic.git` on `main`, with history and CI. Work continues in this repo.

## Open

- CD on merge to `main` needs GitHub Actions secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. The workflow can be added before those secrets exist; a deploy will fail until they are set.
