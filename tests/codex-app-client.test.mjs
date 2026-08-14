import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import test from "node:test";

import { CodexAppClient } from "../server/codex-app-client.mjs";

class FakeCodexProcess extends EventEmitter {
  constructor(onMessage) {
    super();
    this.stdin = new PassThrough();
    this.stdout = new PassThrough();
    this.stderr = new PassThrough();
    this.exitCode = null;
    this.signalCode = null;
    this.killed = false;

    let buffer = "";
    this.stdin.setEncoding("utf8");
    this.stdin.on("data", (chunk) => {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) {
        if (line.trim()) onMessage(JSON.parse(line), this);
      }
    });
  }

  send(message) {
    this.stdout.write(`${JSON.stringify(message)}\n`);
  }

  kill(signal = "SIGTERM") {
    if (this.exitCode !== null || this.signalCode !== null) return false;
    this.killed = true;
    this.signalCode = signal;
    this.emit("exit", null, signal);
    this.emit("close", null, signal);
    return true;
  }
}

function fakeAppServer(onMessage) {
  const calls = [];
  const child = new FakeCodexProcess((message, process) => {
    calls.push(message);
    onMessage(message, process);
  });
  const spawnCalls = [];
  const spawnImpl = (...args) => {
    spawnCalls.push(args);
    return child;
  };
  return { calls, child, spawnCalls, spawnImpl };
}

const initializeResult = {
  codexHome: "/tmp/.codex",
  platformFamily: "unix",
  platformOs: "macos",
  userAgent: "codex_cli_rs/0.144.3",
};

function threadStartResult(threadId = "thread-1") {
  return {
    approvalPolicy: "never",
    approvalsReviewer: "user",
    cwd: "/workspace",
    instructionSources: [],
    model: "gpt-5.6-sol",
    modelProvider: "openai",
    reasoningEffort: "medium",
    sandbox: {
      excludeSlashTmp: false,
      excludeTmpdirEnvVar: false,
      networkAccess: false,
      type: "workspaceWrite",
      writableRoots: [],
    },
    serviceTier: null,
    thread: {
      agentNickname: null,
      agentRole: null,
      cliVersion: "0.144.3",
      createdAt: 1_786_438_798,
      cwd: "/workspace",
      ephemeral: false,
      forkedFromId: null,
      gitInfo: null,
      id: threadId,
      modelProvider: "openai",
      name: null,
      parentThreadId: null,
      path: `/tmp/.codex/sessions/${threadId}.jsonl`,
      preview: "",
      recencyAt: null,
      sessionId: `session-${threadId}`,
      source: "appServer",
      status: { type: "idle" },
      threadSource: null,
      turns: [],
      updatedAt: 1_786_438_798,
    },
  };
}

function inProgressTurn(turnId = "turn-1") {
  return {
    completedAt: null,
    durationMs: null,
    error: null,
    id: turnId,
    items: [],
    itemsView: "full",
    startedAt: 1_786_438_798,
    status: "inProgress",
  };
}

test("starts the stdio app-server, initializes once, and lists skills", async () => {
  const server = fakeAppServer((message, child) => {
    if (message.method === "initialize") {
      child.send({ id: message.id, result: initializeResult });
    }
    if (message.method === "skills/list") {
      child.send({
        id: message.id,
        result: {
          data: [{
            cwd: "/workspace",
            errors: [],
            skills: [{
              dependencies: null,
              description: "Make paper posters",
              enabled: true,
              interface: null,
              name: "paper-poster",
              path: "/tmp/skills/paper-poster/SKILL.md",
              scope: "user",
              shortDescription: null,
            }],
          }],
        },
      });
    }
  });
  const client = new CodexAppClient({ spawnImpl: server.spawnImpl, requestTimeoutMs: 100 });

  const [firstInitialize, secondInitialize] = await Promise.all([client.start(), client.start()]);
  const entries = await client.listSkills({ cwd: "/workspace", forceReload: true });

  assert.deepEqual(firstInitialize, initializeResult);
  assert.deepEqual(secondInitialize, initializeResult);
  assert.deepEqual(server.spawnCalls, [[
    "codex",
    ["app-server", "--stdio"],
    { env: process.env, stdio: ["pipe", "pipe", "pipe"] },
  ]]);
  assert.deepEqual(server.calls.slice(0, 2), [
    {
      id: 1,
      method: "initialize",
      params: {
        clientInfo: {
          name: "image-skill-studio",
          title: "Image Skill Studio",
          version: "0.1.0",
        },
      },
    },
    { method: "initialized", params: {} },
  ]);
  assert.deepEqual(server.calls.at(-1), {
    id: 2,
    method: "skills/list",
    params: { cwds: ["/workspace"], forceReload: true },
  });
  assert.equal(entries[0].skills[0].name, "paper-poster");

  client.close();
});

test("surfaces JSON-RPC request errors with code and data", async () => {
  const server = fakeAppServer((message, child) => {
    if (message.method === "initialize") {
      child.send({ id: message.id, result: initializeResult });
    }
    if (message.method === "skills/list") {
      child.send({
        error: {
          code: -32602,
          data: { field: "cwds" },
          message: "invalid working directory",
        },
        id: message.id,
      });
    }
  });
  const client = new CodexAppClient({ requestTimeoutMs: 100, spawnImpl: server.spawnImpl });

  await assert.rejects(
    client.listSkills({ cwd: "/missing" }),
    (error) => {
      assert.equal(error.name, "CodexAppServerError");
      assert.equal(error.code, -32602);
      assert.deepEqual(error.data, { field: "cwds" });
      assert.match(error.message, /skills\/list.*invalid working directory/);
      return true;
    },
  );

  client.close();
});

test("starts a thread and turn with text, skill, and local image inputs, then reports the generated image", async () => {
  const imageItem = {
    id: "image-1",
    result: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB",
    revisedPrompt: "A quieter paper poster",
    savedPath: "/tmp/.codex/generated_images/thread-1/image-1.png",
    status: "completed",
    type: "imageGeneration",
  };
  const completedTurn = {
    completedAt: 1_786_438_800,
    durationMs: 2_000,
    error: null,
    id: "turn-1",
    items: [imageItem],
    itemsView: "full",
    startedAt: 1_786_438_798,
    status: "completed",
  };
  const server = fakeAppServer((message, child) => {
    if (message.method === "initialize") {
      child.send({ id: message.id, result: initializeResult });
    }
    if (message.method === "thread/start") {
      child.send({
        id: message.id,
        result: {
          approvalPolicy: "never",
          approvalsReviewer: "user",
          cwd: "/workspace",
          instructionSources: [],
          model: "gpt-5.6-sol",
          modelProvider: "openai",
          reasoningEffort: "medium",
          sandbox: {
            excludeSlashTmp: false,
            excludeTmpdirEnvVar: false,
            networkAccess: false,
            type: "workspaceWrite",
            writableRoots: [],
          },
          serviceTier: null,
          thread: {
            agentNickname: null,
            agentRole: null,
            cliVersion: "0.144.3",
            createdAt: 1_786_438_798,
            cwd: "/workspace",
            ephemeral: false,
            forkedFromId: null,
            gitInfo: null,
            id: "thread-1",
            modelProvider: "openai",
            name: null,
            parentThreadId: null,
            path: "/tmp/.codex/sessions/thread-1.jsonl",
            preview: "",
            recencyAt: null,
            sessionId: "session-1",
            source: "appServer",
            status: { type: "idle" },
            threadSource: null,
            turns: [],
            updatedAt: 1_786_438_798,
          },
        },
      });
    }
    if (message.method === "turn/start") {
      child.send({
        id: message.id,
        result: {
          turn: {
            completedAt: null,
            durationMs: null,
            error: null,
            id: "turn-1",
            items: [],
            itemsView: "full",
            startedAt: 1_786_438_798,
            status: "inProgress",
          },
        },
      });
      // Deliberately send notifications before the turn/start promise resumes.
      child.send({
        method: "item/completed",
        params: {
          completedAtMs: 1_786_438_800_000,
          item: imageItem,
          threadId: "thread-1",
          turnId: "turn-1",
        },
      });
      child.send({
        method: "turn/completed",
        params: { threadId: "thread-1", turn: completedTurn },
      });
    }
  });
  const callbacks = [];
  const events = [];
  const client = new CodexAppClient({
    generationTimeoutMs: 100,
    requestTimeoutMs: 100,
    spawnImpl: server.spawnImpl,
  });

  const result = await client.startImageGeneration({
    approvalPolicy: "never",
    cwd: "/workspace",
    localImage: { detail: "high", path: "/workspace/reference.png" },
    model: "gpt-5.6-sol",
    onEvent: (event) => events.push(event.method),
    onImageGeneration: (item, context) => callbacks.push({ context, item }),
    outputSchema: {
      type: "object",
      required: ["summary"],
      properties: { summary: { type: "string" } },
    },
    sandbox: "workspace-write",
    skill: { name: "paper-poster", path: "/tmp/skills/paper-poster/SKILL.md" },
    text: "Use $paper-poster to make a quiet studio poster.",
  });

  assert.deepEqual(server.calls.find((message) => message.method === "thread/start"), {
    id: 2,
    method: "thread/start",
    params: {
      approvalPolicy: "never",
      cwd: "/workspace",
      model: "gpt-5.6-sol",
      sandbox: "workspace-write",
    },
  });
  assert.deepEqual(server.calls.find((message) => message.method === "turn/start"), {
    id: 3,
    method: "turn/start",
    params: {
      input: [
        {
          text: "Use $paper-poster to make a quiet studio poster.",
          text_elements: [],
          type: "text",
        },
        {
          name: "paper-poster",
          path: "/tmp/skills/paper-poster/SKILL.md",
          type: "skill",
        },
        {
          detail: "high",
          path: "/workspace/reference.png",
          type: "localImage",
        },
      ],
      outputSchema: {
        type: "object",
        required: ["summary"],
        properties: { summary: { type: "string" } },
      },
      threadId: "thread-1",
    },
  });
  assert.deepEqual(result, {
    images: [imageItem],
    threadId: "thread-1",
    turn: completedTurn,
    turnId: "turn-1",
  });
  assert.deepEqual(callbacks, [{
    context: {
      completedAtMs: 1_786_438_800_000,
      threadId: "thread-1",
      turnId: "turn-1",
    },
    item: imageItem,
  }]);
  assert.deepEqual(events, ["item/completed", "turn/completed"]);

  client.close();
});

test("times out an unfinished generation and interrupts its turn", async () => {
  const server = fakeAppServer((message, child) => {
    if (message.method === "initialize") {
      child.send({ id: message.id, result: initializeResult });
    }
    if (message.method === "thread/start") {
      child.send({ id: message.id, result: threadStartResult("thread-timeout") });
    }
    if (message.method === "turn/start") {
      child.send({ id: message.id, result: { turn: inProgressTurn("turn-timeout") } });
    }
    if (message.method === "turn/interrupt") {
      child.send({ id: message.id, result: {} });
    }
  });
  const client = new CodexAppClient({
    generationTimeoutMs: 20,
    requestTimeoutMs: 100,
    spawnImpl: server.spawnImpl,
  });

  await assert.rejects(
    client.startImageGeneration({ cwd: "/workspace", text: "Generate an image" }),
    /image generation timed out after 20ms/,
  );
  assert.deepEqual(server.calls.find((message) => message.method === "turn/interrupt"), {
    id: 4,
    method: "turn/interrupt",
    params: { threadId: "thread-timeout", turnId: "turn-timeout" },
  });

  client.close();
});

test("rejects cleanly when turn/start fails before a generation can be awaited", async () => {
  const server = fakeAppServer((message, child) => {
    if (message.method === "initialize") {
      child.send({ id: message.id, result: initializeResult });
    }
    if (message.method === "thread/start") {
      child.send({ id: message.id, result: threadStartResult("thread-turn-error") });
    }
    if (message.method === "turn/start") {
      child.send({
        error: { code: -32000, message: "model unavailable" },
        id: message.id,
      });
    }
  });
  const client = new CodexAppClient({ requestTimeoutMs: 100, spawnImpl: server.spawnImpl });

  await assert.rejects(
    client.startImageGeneration({ cwd: "/workspace", text: "Generate an image" }),
    /turn\/start.*model unavailable/,
  );
  await new Promise((resolve) => setImmediate(resolve));

  client.close();
});

test("close terminates the child and rejects an active generation", async () => {
  let turnStarted;
  const reachedTurnStart = new Promise((resolve) => {
    turnStarted = resolve;
  });
  const server = fakeAppServer((message, child) => {
    if (message.method === "initialize") {
      child.send({ id: message.id, result: initializeResult });
    }
    if (message.method === "thread/start") {
      child.send({ id: message.id, result: threadStartResult("thread-close") });
    }
    if (message.method === "turn/start") {
      child.send({ id: message.id, result: { turn: inProgressTurn("turn-close") } });
      turnStarted();
    }
  });
  const client = new CodexAppClient({
    generationTimeoutMs: 1_000,
    requestTimeoutMs: 100,
    spawnImpl: server.spawnImpl,
  });

  const generation = client.startImageGeneration({ cwd: "/workspace", text: "Generate an image" });
  await reachedTurnStart;
  client.close();

  await assert.rejects(generation, /client closed/);
  assert.equal(server.child.killed, true);
  assert.equal(server.child.signalCode, "SIGTERM");
});
