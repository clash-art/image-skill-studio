import assert from "node:assert/strict";
import test from "node:test";

import { createCodexGenerationRunner } from "../server/generation-runner.mjs";

test("createCodexGenerationRunner collects ImageGen artifacts without waiting for record_image_generation", async () => {
  const events = [];
  const started = [];
  const runner = createCodexGenerationRunner({
    clientFactory() {
      return {
        async startImageGeneration(input) {
          started.push(input);
          return {
            images: [{
              id: "image-1",
              savedPath: "/tmp/.codex/generated_images/image-1.png",
              result: "iVBORw0KGgo=",
            }],
            threadId: "thread-1",
            turnId: "turn-1",
          };
        },
        close() {},
      };
    },
  });

  const result = await runner({
    run: { id: "run-1" },
    skill: { id: "paper-poster", skillPath: "/tmp/skills/paper-poster/SKILL.md", contentHash: "abc" },
    prompt: "A quiet studio",
    aspectRatio: "3:4",
    references: [{ path: "/tmp/ref.png", role: "style" }],
    onEvent: (event) => events.push(event),
  });

  assert.equal(result.status, "succeeded");
  assert.equal(result.artifacts[0].savedPath, "/tmp/.codex/generated_images/image-1.png");
  assert.equal(started[0].skill.name, "paper-poster");
  assert.equal(started[0].localImages[0].path, "/tmp/ref.png");
  assert.equal(events[0].status, "imagegen_running");
});

test("createCodexGenerationRunner fails closed when Codex returns no image", async () => {
  const runner = createCodexGenerationRunner({
    clientFactory() {
      return {
        async startImageGeneration() {
          return { images: [], threadId: "thread-1", turnId: "turn-1" };
        },
        close() {},
      };
    },
  });

  const result = await runner({
    run: { id: "run-2" },
    skill: { id: "paper-poster", skillPath: "/tmp/skills/paper-poster/SKILL.md" },
    prompt: "A quiet studio",
    aspectRatio: "3:4",
    references: [],
    onEvent: () => {},
  });

  assert.equal(result.status, "failed");
  assert.match(result.error, /artifact|产物|图片/);
});
