import assert from "node:assert/strict";
import test from "node:test";

// Integration tests: build output is loaded once and exercised through its
// real Worker entry point.
async function render(path = "/", headers = {}) {
  const workerUrl = new URL("../../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html", ...headers } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the Piano Picnic learning game", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Piano Picnic — A first music game<\/title>/i);
  assert.match(html, /Meet/);
  assert.match(html, /C major/);
  assert.match(html, /Find a note/);
  assert.match(html, /See a chord/);
  assert.match(html, /Hear a chord/);
  assert.match(html, /Upright piano/);
  assert.match(html, /Play whole chord/);
  assert.match(html, /Notes one by one/);
  assert.match(html, /Home chord/);
  assert.match(html, /Companion/);
  assert.match(html, /G7/);
  assert.match(html, /B♭, Ti♭/);
  assert.match(html, /Do/);
  assert.match(html, /Tap the piano keys to answer/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
});

test("keeps deployment-specific origins out of rendered markup", async () => {
  const html = await (await render()).text();
  assert.doesNotMatch(html, /raja73|chatgpt\.site/, "rendered HTML must not embed a personal deploy URL");
});

test("builds absolute social-card URLs from the request host", async () => {
  const html = await (
    await render("/", { "x-forwarded-host": "example.org", "x-forwarded-proto": "https" })
  ).text();
  assert.match(html, /<meta property="og:image" content="https:\/\/example\.org\/og\.png"/);
});

test("unknown pages return a plain 404", async () => {
  const response = await render("/definitely-not-a-page");
  assert.equal(response.status, 404);
});

test("image optimization endpoint rejects requests without parameters", async () => {
  const response = await render("/_vinext/image");
  assert.equal(response.status, 400);
});
