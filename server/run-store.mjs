import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

function immutableCopy(value) {
  return JSON.parse(JSON.stringify(value));
}

export class RunStore {
  constructor(dataRoot) {
    this.dataRoot = path.resolve(dataRoot);
    this.runs = new Map();
    this.clientRequests = new Map();
    this.loaded = false;
  }

  get storePath() {
    return path.join(this.dataRoot, "runs.json");
  }

  async load() {
    if (this.loaded) return;
    await mkdir(this.dataRoot, { recursive: true });
    try {
      const records = JSON.parse(await readFile(this.storePath, "utf8"));
      for (const run of Array.isArray(records) ? records : []) {
        this.runs.set(run.id, run);
        this.clientRequests.set(run.clientRequestId, run.id);
      }
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    this.loaded = true;
  }

  async persist() {
    await mkdir(this.dataRoot, { recursive: true });
    await writeFile(this.storePath, `${JSON.stringify([...this.runs.values()], null, 2)}\n`);
  }

  async list() {
    await this.load();
    return immutableCopy(
      [...this.runs.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    );
  }

  async seedIfEmpty(records) {
    await this.load();
    if (this.runs.size > 0 || !records.length) return [];

    const seeds = immutableCopy(records);
    for (const run of seeds) {
      this.runs.set(run.id, run);
      this.clientRequests.set(run.clientRequestId, run.id);
    }
    await this.persist();
    return immutableCopy(seeds);
  }

  async get(id) {
    await this.load();
    const run = this.runs.get(id);
    return run ? immutableCopy(run) : null;
  }

  async create({ clientRequestId, snapshot }) {
    await this.load();
    const existingId = this.clientRequests.get(clientRequestId);
    if (existingId) return this.get(existingId);

    const now = new Date().toISOString();
    const run = {
      id: `run-${randomUUID()}`,
      clientRequestId,
      status: "awaiting_agent",
      createdAt: now,
      updatedAt: now,
      snapshot: immutableCopy(snapshot),
      events: [
        { type: "prepared", label: "指令已准备", at: now },
      ],
      artifacts: [],
      error: null,
    };
    this.runs.set(run.id, run);
    this.clientRequests.set(clientRequestId, run.id);
    await this.persist();
    return immutableCopy(run);
  }

  async appendEvent(id, event) {
    await this.load();
    const run = this.runs.get(id);
    if (!run) throw new Error(`Unknown run: ${id}`);
    const nextEvent = { ...immutableCopy(event), at: event.at || new Date().toISOString() };
    run.events.push(nextEvent);
    run.updatedAt = nextEvent.at;
    if (event.status) run.status = event.status;
    await this.persist();
    return immutableCopy(run);
  }

  async complete(id, { status, artifacts = [], error = null, summary = null }) {
    if (!["succeeded", "failed", "cancelled"].includes(status)) {
      throw new Error(`Invalid terminal status: ${status}`);
    }
    if (status === "succeeded" && !artifacts.length) {
      status = "failed";
      error = error || "Image generation did not return an artifact";
    }
    await this.load();
    const run = this.runs.get(id);
    if (!run) throw new Error(`Unknown run: ${id}`);
    const now = new Date().toISOString();
    run.status = status;
    run.updatedAt = now;
    run.artifacts = immutableCopy(artifacts);
    run.error = error;
    run.summary = summary;
    run.events.push({
      type: status,
      label: status === "succeeded" ? "生成完成" : status === "cancelled" ? "已取消" : "生成失败",
      at: now,
    });
    await this.persist();
    return immutableCopy(run);
  }
}
