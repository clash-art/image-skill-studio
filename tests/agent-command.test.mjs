import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  buildCodexInvocation,
  buildGenerationPrompt,
  validateGenerationRequest,
} from "../lib/agent-command.mjs";

const skill = {
  id: "paper-poster",
  displayName: "Paper Poster",
  skillPath: "/tmp/skills/paper-poster/SKILL.md",
  contentHash: "abc123def456",
  availability: "ready",
  capabilities: { references: true, maxReferences: 3, aspectRatios: ["3:4", "1:1"] },
};

test("validateGenerationRequest rejects blank prompts before dispatch", () => {
  const result = validateGenerationRequest({ skill, prompt: "   ", references: [], aspectRatio: "3:4" });
  assert.deepEqual(result, { ok: false, field: "prompt", message: "先写下你想生成的画面。" });
});

test("validateGenerationRequest localizes rejection messages", () => {
  const result = validateGenerationRequest({
    skill,
    prompt: "   ",
    references: [],
    aspectRatio: "3:4",
    locale: "en",
  });
  assert.deepEqual(result, { ok: false, field: "prompt", message: "Write the scene you want to generate." });
});

test("validateGenerationRequest rejects unsupported reference images", () => {
  const noReferenceSkill = {
    ...skill,
    capabilities: { ...skill.capabilities, references: false, maxReferences: 0 },
  };
  const result = validateGenerationRequest({
    skill: noReferenceSkill,
    prompt: "A quiet studio",
    references: [{ path: "/tmp/ref.png" }],
    aspectRatio: "3:4",
  });
  assert.equal(result.ok, false);
  assert.equal(result.field, "references");
});

test("buildGenerationPrompt binds the exact skill snapshot and artifact contract", () => {
  const prompt = buildGenerationPrompt({
    runId: "run-42",
    skill,
    prompt: "A quiet studio",
    aspectRatio: "3:4",
    artifactDir: "/tmp/run-42/artifacts",
    references: [{ path: "/tmp/run-42/reference-0.png", role: "style" }],
  });

  assert.match(prompt, /\$paper-poster/);
  assert.match(prompt, /abc123def456/);
  assert.match(prompt, /\$imagegen/);
  assert.match(prompt, /image_gen/);
  assert.doesNotMatch(prompt, /\.system\/imagegen\/SKILL\.md/);
  assert.match(prompt, /A quiet studio/);
  assert.match(prompt, /3:4/);
  assert.match(prompt, /reference-0\.png/);
  assert.match(prompt, /\/tmp\/run-42\/artifacts/);
  assert.match(prompt, /不要使用 CLI/);
  assert.match(prompt, /其他生图 Skill、工具或手段/);
  assert.doesNotMatch(prompt, /出图必须/);
  assert.doesNotMatch(prompt, /不要用其他生图工具代替/);
  assert.doesNotMatch(prompt, /必须同时使用两个 Skill/);
});

test("MCP App handoff instructions record only successful images", () => {
  const prompt = buildGenerationPrompt({
    runId: "run-42",
    skill,
    prompt: "A quiet studio",
    aspectRatio: "3:4",
    artifactDir: "/tmp/run-42/artifacts",
    transport: "mcp-app",
  });

  assert.match(prompt, /record_image_generation/);
  assert.match(prompt, /\$imagegen/);
  assert.match(prompt, /生成失败时不要调用这个工具/);
  assert.match(prompt, /其他生图 Skill、工具或手段/);
  assert.doesNotMatch(prompt, /记录 failed/);
  assert.doesNotMatch(prompt, /出图必须/);
});

test("MCP App handoff instructions can name the live record tool", () => {
  const prompt = buildGenerationPrompt({
    runId: "run-42",
    skill,
    prompt: "A quiet studio",
    aspectRatio: "3:4",
    artifactDir: "/tmp/run-42/artifacts",
    transport: "mcp-app",
    recordToolName: "record_image_generation_dev",
  });

  assert.match(prompt, /record_image_generation_dev/);
  assert.doesNotMatch(prompt, /本插件的 record_image_generation，/);
});

test("MCP App handoff instructions follow the Studio locale", () => {
  const prompt = buildGenerationPrompt({
    runId: "run-42",
    skill,
    prompt: "A quiet studio",
    aspectRatio: "3:4",
    artifactDir: "/tmp/run-42/artifacts",
    transport: "mcp-app",
    locale: "en",
  });

  assert.match(prompt, /You are completing one Image Skill Studio image generation task/);
  assert.match(prompt, /Creative method: use the `\$paper-poster` skill/);
  assert.match(prompt, /Scene: A quiet studio/);
  assert.match(prompt, /References:/);
  assert.match(prompt, /another image skill, tool, or method/);
  assert.match(prompt, /Do not modify project source code/);
  assert.doesNotMatch(prompt, /画面要求/);
  assert.doesNotMatch(prompt, /出图必须/);
  assert.doesNotMatch(prompt, /must use two skills/i);
});

test("ImageGen-only runs mention $imagegen without requiring it as the only renderer", () => {
  const prompt = buildGenerationPrompt({
    runId: "run-7",
    skill: {
      id: "imagegen",
      skillPath: "/Users/me/.codex/skills/.system/imagegen/SKILL.md",
      contentHash: "imghash12ab",
    },
    prompt: "A cobalt still life",
    aspectRatio: "3:4",
    artifactDir: "/tmp/run-7/artifacts",
    transport: "mcp-app",
  });

  assert.equal((prompt.match(/\$imagegen/g) || []).length >= 1, true);
  assert.doesNotMatch(prompt, /\.system\/imagegen\/SKILL\.md/);
  assert.doesNotMatch(prompt, /imghash12ab/);
  assert.doesNotMatch(prompt, /必须同时使用两个 Skill/);
  assert.doesNotMatch(prompt, /创作方法：/);
  assert.match(prompt, /内置 image_gen/);
  assert.match(prompt, /不要使用 CLI/);
  assert.match(prompt, /其他生图 Skill、工具或手段/);
  assert.doesNotMatch(prompt, /出图必须/);
});

test("buildCodexInvocation attaches every immutable reference without shell interpolation", () => {
  const invocation = buildCodexInvocation({
    projectRoot: "/tmp/project with spaces",
    prompt: "Generate `this` and $(never execute)",
    references: [
      { path: "/tmp/project with spaces/runs/r1/reference 0.png" },
      { path: "/tmp/project with spaces/runs/r1/reference 1.jpg" },
    ],
    outputSchemaPath: "/tmp/project with spaces/runs/r1/output-schema.json",
    finalMessagePath: "/tmp/project with spaces/runs/r1/final.json",
  });

  assert.equal(invocation.command, "codex");
  assert.equal(invocation.stdin, "Generate `this` and $(never execute)");
  assert.deepEqual(
    invocation.args.filter((value) => /reference/.test(value)),
    [
      "/tmp/project with spaces/runs/r1/reference 0.png",
      "/tmp/project with spaces/runs/r1/reference 1.jpg",
    ],
  );
  assert.equal(invocation.args.at(-1), "-");
  assert.equal(invocation.args.includes(invocation.stdin), false);
  assert.equal(path.isAbsolute(invocation.cwd), true);
});
