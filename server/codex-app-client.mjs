import { spawn as spawnProcess } from "node:child_process";

const DEFAULT_CLIENT_INFO = Object.freeze({
  name: "image-skill-studio",
  title: "Image Skill Studio",
  version: "0.1.0",
});

function withoutUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

function toArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

export class CodexAppServerError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = "CodexAppServerError";
    if (options.code !== undefined) this.code = options.code;
    if (options.data !== undefined) this.data = options.data;
  }
}

export class CodexAppClient {
  constructor({
    command = "codex",
    args = ["app-server", "--stdio"],
    env = process.env,
    generationTimeoutMs = 10 * 60_000,
    spawnImpl = spawnProcess,
    requestTimeoutMs = 15_000,
    clientInfo = DEFAULT_CLIENT_INFO,
  } = {}) {
    this.command = command;
    this.args = [...args];
    this.env = env;
    this.generationTimeoutMs = generationTimeoutMs;
    this.spawnImpl = spawnImpl;
    this.requestTimeoutMs = requestTimeoutMs;
    this.clientInfo = { ...clientInfo };

    this._child = null;
    this._closed = false;
    this._initialized = false;
    this._initializeResult = null;
    this._startPromise = null;
    this._nextRequestId = 1;
    this._pending = new Map();
    this._generationSessions = new Map();
    this._stdoutBuffer = "";
    this._stderrTail = "";
  }

  start() {
    if (this._closed) {
      return Promise.reject(new CodexAppServerError("Codex app-server client is closed"));
    }
    if (this._initialized) return Promise.resolve(this._initializeResult);
    if (this._startPromise) return this._startPromise;

    try {
      this._spawn();
    } catch (cause) {
      return Promise.reject(new CodexAppServerError(`Failed to spawn Codex app-server: ${cause.message}`, { cause }));
    }

    this._startPromise = this._request("initialize", { clientInfo: this.clientInfo })
      .then((result) => {
        this._notify("initialized", {});
        this._initialized = true;
        this._initializeResult = result;
        return result;
      });
    return this._startPromise;
  }

  async listSkills({ cwd, cwds, forceReload = false } = {}) {
    await this.start();
    const requestedCwds = cwds ?? (cwd ? [cwd] : []);
    const result = await this._request("skills/list", {
      cwds: requestedCwds,
      forceReload,
    });
    return result.data ?? [];
  }

  async startImageGeneration({
    approvalPolicy,
    cwd,
    localImage,
    localImages,
    model,
    onEvent,
    onImageGeneration,
    outputSchema,
    sandbox,
    skill,
    skills,
    text,
    timeoutMs = this.generationTimeoutMs,
  } = {}) {
    await this.start();
    if (typeof text !== "string" || !text.trim()) {
      throw new TypeError("startImageGeneration requires non-empty text");
    }

    const threadResult = await this._request("thread/start", withoutUndefined({
      approvalPolicy,
      cwd,
      model,
      sandbox,
    }));
    const threadId = threadResult?.thread?.id;
    if (!threadId) {
      throw new CodexAppServerError("Codex app-server thread/start response did not include thread.id");
    }

    const input = [{ type: "text", text, text_elements: [] }];
    for (const entry of [...toArray(skill), ...toArray(skills)]) {
      const name = entry?.name ?? entry?.id;
      const skillPath = entry?.path ?? entry?.skillPath;
      if (!name || !skillPath) {
        throw new TypeError("Each skill input requires name (or id) and path (or skillPath)");
      }
      input.push({ type: "skill", name, path: skillPath });
    }
    for (const entry of [...toArray(localImage), ...toArray(localImages)]) {
      const image = typeof entry === "string" ? { path: entry } : entry;
      if (!image?.path) throw new TypeError("Each local image input requires a path");
      input.push(withoutUndefined({ type: "localImage", path: image.path, detail: image.detail }));
    }

    const session = this._createGenerationSession({
      onEvent,
      onImageGeneration,
      threadId,
      timeoutMs,
    });
    try {
      const turnResult = await this._request("turn/start", withoutUndefined({
        input,
        outputSchema,
        threadId,
      }));
      const turnId = turnResult?.turn?.id;
      if (!turnId) {
        throw new CodexAppServerError("Codex app-server turn/start response did not include turn.id");
      }
      if (session.turnId && session.turnId !== turnId) {
        throw new CodexAppServerError(
          `Codex app-server returned turn ${turnId} after notifications for ${session.turnId}`,
        );
      }
      session.turnId = turnId;
      return await session.promise;
    } catch (error) {
      this._rejectGeneration(session, error);
      throw error;
    }
  }

  close() {
    if (this._closed) return;
    this._closed = true;
    this._rejectAll(new CodexAppServerError("Codex app-server client closed"));

    const child = this._child;
    if (!child) return;
    if (!child.stdin.destroyed && !child.stdin.writableEnded) child.stdin.end();
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
  }

  _spawn() {
    const child = this.spawnImpl(this.command, this.args, {
      env: this.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    this._child = child;
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => this._readStdout(chunk));
    child.stderr.on("data", (chunk) => {
      this._stderrTail = `${this._stderrTail}${chunk}`.slice(-8_192);
    });
    child.on("error", (cause) => {
      this._rejectAll(new CodexAppServerError(`Codex app-server process error: ${cause.message}`, { cause }));
    });
    child.on("exit", (code, signal) => {
      if (this._child === child) this._child = null;
      if (this._closed) return;
      const detail = code === null ? `signal ${signal}` : `code ${code}`;
      const stderr = this._stderrTail.trim();
      this._rejectAll(new CodexAppServerError(
        `Codex app-server exited unexpectedly with ${detail}${stderr ? `: ${stderr}` : ""}`,
      ));
    });
  }

  _request(method, params, timeoutMs = this.requestTimeoutMs) {
    const id = this._nextRequestId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._pending.delete(id);
        reject(new CodexAppServerError(
          `Codex app-server request "${method}" timed out after ${timeoutMs}ms`,
        ));
      }, timeoutMs);
      this._pending.set(id, { method, reject, resolve, timer });
      this._write({ id, method, params }, (cause) => {
        const pending = this._pending.get(id);
        if (!pending) return;
        clearTimeout(pending.timer);
        this._pending.delete(id);
        reject(new CodexAppServerError(`Failed to write Codex app-server request "${method}": ${cause.message}`, { cause }));
      });
    });
  }

  _notify(method, params) {
    this._write({ method, params });
  }

  _write(message, onError = () => {}) {
    const stdin = this._child?.stdin;
    if (!stdin || stdin.destroyed || stdin.writableEnded) {
      onError(new Error("app-server stdin is not writable"));
      return;
    }
    try {
      stdin.write(`${JSON.stringify(message)}\n`, (error) => {
        if (error) onError(error);
      });
    } catch (error) {
      onError(error);
    }
  }

  _readStdout(chunk) {
    this._stdoutBuffer += chunk;
    const lines = this._stdoutBuffer.split("\n");
    this._stdoutBuffer = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      let message;
      try {
        message = JSON.parse(line);
      } catch (cause) {
        this._rejectAll(new CodexAppServerError(`Invalid JSON from Codex app-server: ${cause.message}`, { cause }));
        continue;
      }
      this._handleMessage(message);
    }
  }

  _handleMessage(message) {
    if (message.method && message.id === undefined) {
      this._handleNotification(message);
      return;
    }
    if (message.id === undefined || (!Object.hasOwn(message, "result") && !Object.hasOwn(message, "error"))) return;
    const pending = this._pending.get(message.id);
    if (!pending) return;
    clearTimeout(pending.timer);
    this._pending.delete(message.id);
    if (message.error) {
      pending.reject(new CodexAppServerError(
        `Codex app-server request "${pending.method}" failed: ${message.error.message}`,
        { code: message.error.code, data: message.error.data },
      ));
      return;
    }
    pending.resolve(message.result);
  }

  _createGenerationSession({ onEvent, onImageGeneration, threadId, timeoutMs }) {
    let resolve;
    let reject;
    const promise = new Promise((resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    });
    // Notifications (or turn/start itself) can fail before startImageGeneration
    // reaches its await of this deferred promise.
    promise.catch(() => {});
    const session = {
      images: [],
      imageIds: new Set(),
      onEvent,
      onImageGeneration,
      promise,
      reject,
      resolve,
      settled: false,
      threadId,
      turnId: null,
    };
    session.timer = setTimeout(() => {
      const error = new CodexAppServerError(
        `Codex image generation timed out after ${timeoutMs}ms (thread ${threadId})`,
      );
      const turnId = session.turnId;
      this._rejectGeneration(session, error);
      if (turnId && this._child) {
        this._request("turn/interrupt", { threadId, turnId }).catch(() => {});
      }
    }, timeoutMs);
    this._generationSessions.set(threadId, session);
    return session;
  }

  _handleNotification(message) {
    const threadId = message.params?.threadId;
    const session = threadId ? this._generationSessions.get(threadId) : null;
    if (!session || session.settled) return;

    const notificationTurnId = message.params?.turnId ?? message.params?.turn?.id;
    if (session.turnId && notificationTurnId && notificationTurnId !== session.turnId) return;
    if (!session.turnId && notificationTurnId) session.turnId = notificationTurnId;

    try {
      session.onEvent?.(message);
    } catch (cause) {
      this._rejectGeneration(session, new CodexAppServerError(
        `Codex image generation event callback failed: ${cause.message}`,
        { cause },
      ));
      return;
    }

    if (message.method === "item/completed" && message.params?.item?.type === "imageGeneration") {
      this._recordImage(session, message.params.item);
      try {
        session.onImageGeneration?.(message.params.item, {
          completedAtMs: message.params.completedAtMs,
          threadId,
          turnId: message.params.turnId,
        });
      } catch (cause) {
        this._rejectGeneration(session, new CodexAppServerError(
          `Codex image generation callback failed: ${cause.message}`,
          { cause },
        ));
        return;
      }
    }

    if (message.method !== "turn/completed") return;
    const turn = message.params?.turn;
    for (const item of turn?.items ?? []) {
      if (item.type === "imageGeneration") this._recordImage(session, item);
    }
    if (turn?.status !== "completed") {
      const detail = turn?.error?.message ?? `turn ended with status ${turn?.status ?? "unknown"}`;
      this._rejectGeneration(session, new CodexAppServerError(
        `Codex image generation failed: ${detail}`,
      ));
      return;
    }
    this._resolveGeneration(session, turn);
  }

  _recordImage(session, item) {
    if (session.imageIds.has(item.id)) return;
    session.imageIds.add(item.id);
    session.images.push(item);
  }

  _resolveGeneration(session, turn) {
    if (session.settled) return;
    session.settled = true;
    clearTimeout(session.timer);
    if (this._generationSessions.get(session.threadId) === session) {
      this._generationSessions.delete(session.threadId);
    }
    session.resolve({
      images: session.images,
      threadId: session.threadId,
      turn,
      turnId: turn.id,
    });
  }

  _rejectGeneration(session, error) {
    if (session.settled) return;
    session.settled = true;
    clearTimeout(session.timer);
    if (this._generationSessions.get(session.threadId) === session) {
      this._generationSessions.delete(session.threadId);
    }
    session.reject(error);
  }

  _rejectPending(error) {
    for (const pending of this._pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this._pending.clear();
  }

  _rejectAll(error) {
    this._rejectPending(error);
    for (const session of [...this._generationSessions.values()]) {
      this._rejectGeneration(session, error);
    }
  }
}
