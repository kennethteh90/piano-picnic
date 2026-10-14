# Blockers

## Resolved

- A new repository was not created. This workspace is already `https://github.com/kennethteh90/piano-picnic.git` on `main`, with history and CI. Work continues in this repo.

## Open

- CD on merge to `main` needs GitHub Actions secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. `gh secret list` returned none. The workflow is in `.github/workflows/cd.yml` and will fail the credential check until those secrets are set. The local commits are not pushed.

