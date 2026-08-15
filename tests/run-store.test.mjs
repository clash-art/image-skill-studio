import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { RunStore } from "../server/run-store.mjs";

test("RunStore creates one immutable run per client request id", async () => {
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), "image-studio-runs-"));
  const store = new RunStore(dataRoot);
  const snapshot = {
    skill: { id: "poster", contentHash: "hash-1" },
    prompt: "Original prompt",
    references: [],
    aspectRatio: "3:4",
  };

  const first = await store.create({ clientRequestId: "client-1", snapshot });
  snapshot.prompt = "Mutated outside";
  const duplicate = await store.create({ clientRequestId: "client-1", snapshot });

  assert.equal(first.id, duplicate.id);
  assert.equal(duplicate.snapshot.prompt, "Original prompt");
  assert.equal(duplicate.status, "awaiting_agent");
});

test("RunStore records real events and terminal outcome", async () => {
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), "image-studio-runs-"));
  const store = new RunStore(dataRoot);
  const run = await store.create({
    clientRequestId: "client-2",
    snapshot: { skill: { id: "poster" }, prompt: "Prompt", references: [], aspectRatio: "3:4" },
  });

  await store.appendEvent(run.id, { type: "agent_dispatched", label: "已发送给 Codex" });
  const completed = await store.complete(run.id, {
    status: "failed",
    error: "Image generation did not return an artifact",
  });

  assert.equal(completed.status, "failed");
  assert.equal(completed.events.at(-1).type, "failed");
  assert.match(completed.error, /artifact/);
});

test("RunStore expires in-flight runs that never receive a record callback", async () => {
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), "image-studio-expire-"));
  const store = new RunStore(dataRoot);
  const fresh = await store.create({
    clientRequestId: "fresh",
    snapshot: { skill: { id: "poster" }, prompt: "Fresh", references: [], aspectRatio: "3:4" },
  });
  const stale = await store.create({
    clientRequestId: "stale",
    snapshot: { skill: { id: "poster" }, prompt: "Stale", references: [], aspectRatio: "3:4" },
  });
  await store.appendEvent(stale.id, {
    type: "handoff",
    label: "已 hand off",
    status: "agent_running",
    at: "2026-08-15T00:00:00.000Z",
  });

  const expired = await store.expireStale({
    now: Date.parse("2026-08-15T00:20:00.000Z"),
    timeoutMs: 10 * 60_000,
  });

  assert.equal(expired.length, 1);
  assert.equal(expired[0].id, stale.id);
  assert.equal(expired[0].status, "failed");
  assert.match(expired[0].error, /时限|timeout|回写/i);
  assert.equal((await store.get(fresh.id)).status, "awaiting_agent");
  assert.equal((await store.get(stale.id)).status, "failed");
});
