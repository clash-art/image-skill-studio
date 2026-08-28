import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, utimes } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  DEFAULT_DOCUMENT_MAX_AGE_MS,
  MAX_MEDIA_BYTES,
  RegistryCache,
} from "../lib/registry-cache.mjs";

const FEED_URL = "https://example.test/v1/registry.json";
const MEDIA_URL = "https://raw.githubusercontent.com/owner/repo/0123456789abcdef0123456789abcdef01234567/生成示例/经典a.png";

async function tempRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), "registry-cache-"));
  test.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

function jsonResponse(value, { etag, status = 200 } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => (name.toLowerCase() === "etag" ? etag ?? null : null) },
    text: async () => JSON.stringify(value),
  };
}

function notModified(etag) {
  return { ok: false, status: 304, headers: { get: () => etag }, text: async () => "" };
}

function binaryResponse(bytes, { contentType = "image/png", status = 200 } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name) => {
        const key = name.toLowerCase();
        if (key === "content-type") return contentType;
        if (key === "content-length") return String(bytes.length);
        return null;
      },
    },
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  };
}

function recorder(handler) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, headers: init?.headers || {} });
    return handler(url, init, calls.length);
  };
  return { calls, fetchImpl };
}

test("a cold start downloads the feed and serves it from disk afterwards", async () => {
  const root = await tempRoot();
  const { calls, fetchImpl } = recorder(() => jsonResponse({ version: 1 }, { etag: 'W/"v1"' }));
  const cache = new RegistryCache({ root, fetchImpl });

  const cold = await cache.loadDocument({ url: FEED_URL, key: "feed" });
  assert.equal(cold.state, "cold");
  assert.deepEqual(cold.value, { version: 1 });
  assert.equal(calls.length, 1);

  const warm = await cache.loadDocument({ url: FEED_URL, key: "feed" });
  assert.equal(warm.state, "fresh");
  assert.deepEqual(warm.value, { version: 1 });
  assert.equal(calls.length, 1, "a fresh cache must not touch the network");
});

test("a stale feed is served instantly while it revalidates in the background", async () => {
  const root = await tempRoot();
  let clock = 1_000_000;
  const { calls, fetchImpl } = recorder((url, init, call) =>
    call === 1 ? jsonResponse({ generation: 1 }, { etag: '"one"' }) : jsonResponse({ generation: 2 }, { etag: '"two"' }),
  );
  const cache = new RegistryCache({ root, fetchImpl, now: () => clock });

  await cache.loadDocument({ url: FEED_URL, key: "feed" });
  clock += DEFAULT_DOCUMENT_MAX_AGE_MS + 1;

  const updates = [];
  const stale = await cache.loadDocument({ url: FEED_URL, key: "feed", onUpdate: (value) => updates.push(value) });
  assert.equal(stale.state, "stale");
  assert.deepEqual(stale.value, { generation: 1 }, "the app renders the cached feed without waiting");

  const settled = await stale.revalidation;
  assert.equal(settled.state, "updated");
  assert.deepEqual(updates, [{ generation: 2 }]);
  assert.equal(calls[1].headers["if-none-match"], '"one"');

  const next = await cache.loadDocument({ url: FEED_URL, key: "feed" });
  assert.deepEqual(next.value, { generation: 2 });
});

test("an unchanged feed answers 304 and stops re-downloading", async () => {
  const root = await tempRoot();
  let clock = 5_000;
  const { calls, fetchImpl } = recorder((url, init, call) =>
    call === 1 ? jsonResponse({ generation: 1 }, { etag: '"same"' }) : notModified('"same"'),
  );
  const cache = new RegistryCache({ root, fetchImpl, now: () => clock });

  await cache.loadDocument({ url: FEED_URL, key: "feed" });
  clock += DEFAULT_DOCUMENT_MAX_AGE_MS + 1;

  const revalidated = await cache.refreshDocument({ url: FEED_URL, key: "feed" });
  assert.equal(revalidated.state, "revalidated");
  assert.deepEqual(revalidated.value, { generation: 1 });
  assert.equal(calls.length, 2);

  const afterTouch = await cache.loadDocument({ url: FEED_URL, key: "feed" });
  assert.equal(afterTouch.state, "fresh", "a 304 must refresh the freshness window");
  assert.equal(calls.length, 2);
});

test("the cached feed survives an offline launch", async () => {
  const root = await tempRoot();
  let clock = 0;
  let online = true;
  const cache = new RegistryCache({
    root,
    now: () => clock,
    fetchImpl: async () => {
      if (!online) throw new Error("getaddrinfo ENOTFOUND");
      return jsonResponse({ generation: 1 }, { etag: '"one"' });
    },
  });

  await cache.loadDocument({ url: FEED_URL, key: "feed" });
  online = false;
  clock += DEFAULT_DOCUMENT_MAX_AGE_MS + 1;

  const offline = await cache.refreshDocument({ url: FEED_URL, key: "feed" });
  assert.equal(offline.state, "stale");
  assert.deepEqual(offline.value, { generation: 1 });
  assert.match(offline.error.message, /ENOTFOUND/);
});

test("a first launch with no network and no cache degrades instead of throwing", async () => {
  const root = await tempRoot();
  const cache = new RegistryCache({
    root,
    fetchImpl: async () => {
      throw new Error("offline");
    },
  });
  const result = await cache.loadDocument({ url: FEED_URL, key: "feed" });
  assert.equal(result.state, "offline");
  assert.equal(result.value, null);
});

test("a corrupt or oversized response never replaces a good cache", async () => {
  const root = await tempRoot();
  let clock = 0;
  let mode = "good";
  const cache = new RegistryCache({
    root,
    now: () => clock,
    fetchImpl: async () => {
      if (mode === "good") return jsonResponse({ generation: 1 }, { etag: '"one"' });
      if (mode === "corrupt") {
        return { ok: true, status: 200, headers: { get: () => null }, text: async () => "{ not json" };
      }
      return jsonResponse({ generation: 9 }, { status: 500 });
    },
  });

  await cache.loadDocument({ url: FEED_URL, key: "feed" });
  clock += DEFAULT_DOCUMENT_MAX_AGE_MS + 1;

  mode = "corrupt";
  const corrupt = await cache.refreshDocument({ url: FEED_URL, key: "feed" });
  assert.equal(corrupt.state, "stale");
  assert.deepEqual(corrupt.value, { generation: 1 });

  mode = "error";
  const failed = await cache.refreshDocument({ url: FEED_URL, key: "feed" });
  assert.equal(failed.state, "stale");
  assert.deepEqual(failed.value, { generation: 1 });

  const envelope = JSON.parse(await readFile(cache.documentPath("feed"), "utf8"));
  assert.deepEqual(envelope.value, { generation: 1 });
});

test("commit-pinned media is downloaded once and then reused without a request", async () => {
  const root = await tempRoot();
  const bytes = Buffer.alloc(2048, 7);
  const { calls, fetchImpl } = recorder(() => binaryResponse(bytes));
  const cache = new RegistryCache({ root, fetchImpl });

  const first = await cache.fetchMedia(MEDIA_URL);
  assert.equal(first.state, "downloaded");
  assert.equal(first.bytes, 2048);
  assert.equal(path.extname(first.file), ".png");

  const second = await cache.fetchMedia(MEDIA_URL);
  assert.equal(second.state, "hit");
  assert.equal(second.file, first.file);
  assert.equal(calls.length, 1, "immutable media must never be revalidated");
});

test("media cache paths are content-addressed and collision-free", async () => {
  const root = await tempRoot();
  const cache = new RegistryCache({ root });
  const other = MEDIA_URL.replace("经典a.png", "经典b.png");
  assert.notEqual(cache.mediaPath(MEDIA_URL), cache.mediaPath(other));
  assert.equal(cache.mediaPath(MEDIA_URL), cache.mediaPath(MEDIA_URL));
  assert.ok(cache.mediaPath(MEDIA_URL).startsWith(path.join(root, "media")));
});

test("oversized, empty, and failed media are rejected without writing a file", async () => {
  const root = await tempRoot();
  const cases = [
    { name: "declared-too-large", response: () => binaryResponse(Buffer.alloc(8), { contentType: "image/png" }), lie: true },
    { name: "empty", response: () => binaryResponse(Buffer.alloc(0)) },
    { name: "http-error", response: () => ({ ok: false, status: 404, headers: { get: () => null } }) },
  ];

  for (const scenario of cases) {
    const cache = new RegistryCache({
      root,
      fetchImpl: async () => {
        const response = scenario.response();
        if (scenario.lie) {
          response.headers = { get: (name) => (name.toLowerCase() === "content-length" ? String(MAX_MEDIA_BYTES + 1) : "image/png") };
        }
        return response;
      },
    });
    const url = `${MEDIA_URL}?case=${scenario.name}`;
    const result = await cache.fetchMedia(url);
    assert.equal(result.file, null, `${scenario.name} must not produce a file`);
    assert.equal(result.state, "error");
    await assert.rejects(() => stat(cache.mediaPath(url)));
  }
});

test("pruning drops the least recently used media and keeps the budget", async () => {
  const root = await tempRoot();
  const bytes = Buffer.alloc(1024, 3);
  const cache = new RegistryCache({ root, fetchImpl: async () => binaryResponse(bytes) });

  const files = [];
  for (let index = 0; index < 5; index += 1) {
    const result = await cache.fetchMedia(`${MEDIA_URL}?n=${index}`);
    files.push(result.file);
    // Oldest access first, so pruning order is deterministic.
    const when = new Date(1_700_000_000_000 + index * 60_000);
    await utimes(result.file, when, when);
  }

  const pruned = await cache.pruneMedia(2048);
  assert.equal(pruned.removed, 3);
  assert.ok(pruned.bytes <= 2048);
  await assert.rejects(() => stat(files[0]), "the least recently used file goes first");
  assert.ok((await stat(files[4])).isFile(), "the most recently used file survives");

  const noop = await cache.pruneMedia(1024 * 1024);
  assert.equal(noop.removed, 0);
});
