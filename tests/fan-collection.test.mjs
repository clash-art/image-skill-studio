import assert from "node:assert/strict";
import test from "node:test";

import { fanPlacement, groupRecentRunsBySkill } from "../lib/fan-collection.mjs";

const skillA = { id: "a", displayName: "A" };
const skillB = { id: "b", displayName: "B" };
const run = (id, skill) => ({ id, snapshot: { skill: { id: skill } } });

test("recent runs become one newest-first collection per Skill with a four-card cap", () => {
  const groups = groupRecentRunsBySkill(
    [skillA, skillB],
    [run("a-5", "a"), run("b-1", "b"), run("a-4", "a"), run("a-3", "a"), run("a-2", "a"), run("a-1", "a")],
  );

  assert.deepEqual(groups.map((group) => group.skill.id), ["a", "b"]);
  assert.equal(groups[0].total, 5);
  assert.deepEqual(groups[0].runs.map((entry) => entry.id), ["a-2", "a-3", "a-4", "a-5"]);
  assert.equal(groups[1].total, 1);
});

test("fan placements are symmetric and keep the newest card visually in front", () => {
  assert.deepEqual([0, 1, 2, 3].map((index) => fanPlacement(index, 4)), [
    { x: -26, y: 12, rotation: -12, zIndex: 1 },
    { x: -9, y: 3, rotation: -4, zIndex: 2 },
    { x: 9, y: 3, rotation: 4, zIndex: 3 },
    { x: 26, y: 12, rotation: 12, zIndex: 4 },
  ]);
  assert.deepEqual(fanPlacement(0, 1), { x: 0, y: 0, rotation: 0, zIndex: 1 });
});
