import assert from "node:assert/strict";
import test from "node:test";

async function loadAsyncPool() {
  try {
    return await import("../lib/async-pool.mjs");
  } catch {
    return {};
  }
}

test("media resource hydration caps concurrency without dropping items", async () => {
  const { mapWithConcurrency } = await loadAsyncPool();

  assert.equal(
    typeof mapWithConcurrency,
    "function",
    "expected a bounded-concurrency media resource queue",
  );

  const items = Array.from({ length: 160 }, (_, index) => index);
  const visited = [];
  let active = 0;
  let maxActive = 0;

  await mapWithConcurrency(items, 6, async (item) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setImmediate(resolve));
    visited.push(item);
    active -= 1;
  });

  assert.equal(maxActive, 6);
  assert.deepEqual(visited.toSorted((left, right) => left - right), items);
});
