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

test("sends the home page to the v1 release", async () => {
  const response = await render();
  assert.equal(response.status, 308);
  assert.match(response.headers.get("location") ?? "", /\/v1$/);
});

test("renders the Piano Picnic learning game", async () => {
  const response = await render("/v1");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Piano Picnic — A first music game<\/title>/i);
  assert.match(html, /Meet/);
  assert.match(html, /C major/);
  assert.match(html, /Find a note/);
  assert.match(html, /See a chord/);
  assert.match(html, /Hear a chord/);
  assert.match(html, /Name it/);
  assert.match(html, /Sheet reader/);
  assert.doesNotMatch(html, /Scan &amp; play|Scan & play/);
  assert.match(html, /Upright/);
  assert.match(html, /Grand/);
  assert.match(html, /Organ/);
  assert.match(html, /Play whole chord/);
  assert.match(html, /Notes one by one/);
  assert.match(html, /Home chord/);
  assert.match(html, /Companion/);
  assert.match(html, /G7/);
  assert.match(html, /B♭, Ti♭/);
  assert.match(html, /Do/);
  assert.match(html, /Tap the piano keys to answer/);
  assert.match(html, /While you answer/);
  assert.match(html, /Hear chord/);
  assert.match(html, /Hear notes/);
  assert.doesNotMatch(html, /H Hint/);
  assert.doesNotMatch(html, /Enter Check/);
  assert.match(html, /Seedling/);
  assert.match(html, /Explorer/);
  assert.match(html, /Superstar/);
  assert.match(html, /Names stay on the screen/);
  assert.match(html, /1\.0\.0/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
});

test("renders the sheet reader at its own route", async () => {
  const response = await render("/v1/scan");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Read the music/);
  assert.match(html, /Upload pages/);
  assert.match(html, /← Games/);
  assert.match(html, /Treble keys light up/);
});

test("keeps deployment-specific origins out of rendered markup", async () => {
  const html = await (await render("/v1")).text();
  assert.doesNotMatch(html, /raja73|chatgpt\.site/, "rendered HTML must not embed a personal deploy URL");
});

test("builds absolute social-card URLs from the request host", async () => {
  const html = await (
    await render("/v1", { "x-forwarded-host": "example.org", "x-forwarded-proto": "https" })
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

async function post(path, body, extraHeaders = {}) {
  const workerUrl = new URL("../../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-post`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", ...extraHeaders },
      body,
    }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("analytics accepts a game event and rejects anything else", async () => {
  const accepted = await post("/api/analytics", JSON.stringify({
    event: "page_view",
    mode: "learn",
    difficulty: "seedling",
    path: "/v1",
    email: "kid@example.com",
  }));
  assert.equal(accepted.status, 204);

  const rejected = await post("/api/analytics", JSON.stringify({ event: "keystroke" }));
  assert.equal(rejected.status, 400);

  const malformed = await post("/api/analytics", "{");
  assert.equal(malformed.status, 400);

  const get = await render("/api/analytics");
  assert.equal(get.status, 405);
});

test("error reports accept a sanitized failure and reject an empty message", async () => {
  const accepted = await post("/api/errors", JSON.stringify({
    message: "piano failed for kid@example.com",
    source: "window",
    path: "/v1",
  }));
  assert.equal(accepted.status, 204);

  const rejected = await post("/api/errors", JSON.stringify({ message: " ", source: "window", path: "/v1" }));
  assert.equal(rejected.status, 400);
});
