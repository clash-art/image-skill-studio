import assert from "node:assert/strict";
import test from "node:test";

import { applyStudioToolResult } from "../lib/studio-tool-result.mjs";

const current = {
  skills: [{ id: "poster" }],
  runs: [{ id: "run-1", status: "agent_running" }],
};

test("applyStudioToolResult merges a single recorded run into the snapshot", () => {
  const next = applyStudioToolResult(current, {
    run: { id: "run-1", status: "succeeded", artifacts: [{ id: "art-1" }] },
  });

  assert.equal(next.skills, current.skills);
  assert.equal(next.runs[0].status, "succeeded");
  assert.equal(next.runs[0].artifacts[0].id, "art-1");
  assert.equal(next.runs.length, 1);
});

test("applyStudioToolResult inserts a new run without dropping existing work", () => {
  const next = applyStudioToolResult(current, {
    run: { id: "run-2", status: "awaiting_agent" },
  });

  assert.deepEqual(next.runs.map((run) => run.id), ["run-2", "run-1"]);
});

test("applyStudioToolResult prefers a full runs array when the host returns one", () => {
  const next = applyStudioToolResult(current, {
    skills: [{ id: "poster" }, { id: "zine" }],
    runs: [{ id: "run-9", status: "succeeded" }],
  });

  assert.equal(next.skills.length, 2);
  assert.deepEqual(next.runs, [{ id: "run-9", status: "succeeded" }]);
});

test("applyStudioToolResult ignores tool results that are not studio snapshots", () => {
  assert.equal(applyStudioToolResult(current, { instruction: "do work" }), current);
  assert.equal(applyStudioToolResult(current, null), current);
});
