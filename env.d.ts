// Cloudflare Workers runtime types (Fetcher, D1Database, cloudflare:workers, ...).
/// <reference types="@cloudflare/workers-types" />

// Bindings this app expects from the hosting platform. Declared optional so the
// app still typechecks (and runs locally) before real bindings are injected.
declare namespace Cloudflare {
  interface Env {
    ASSETS?: Fetcher;
    DB?: D1Database;
  }
}
