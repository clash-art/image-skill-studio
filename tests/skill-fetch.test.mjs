import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  DEFAULT_EXCLUDED_DIRECTORIES,
  fetchUpstreamSkill,
  pinnedFilesAsTree,
  selectSkillFiles,
  SKILL_FETCH_LIMITS,
  upstreamSkillDir,
  upstreamTreeUrl,
} from "../lib/skill-fetch.mjs";

const COMMIT = "55a2ce1875f485268ebef5eeb6f1450f2fbb02cc";

function blob(filePath, size = 1024) {
  return { path: filePath, type: "blob", size };
}

async function tempRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), "skill-fetch-"));
  test.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

function skillFixture({ source: sourceOverrides, ...overrides } = {}) {
  return {
    id: "scenes-gathered-zine-v1-3",
    ...overrides,
    source: {
      repo: "Zeejay0/gathered-scenes-zine-skill",
      commit: COMMIT,
      skillPath: "skills/scenes-gathered-zine-v1-3/SKILL.md",
      directory: "skills/scenes-gathered-zine-v1-3",
      excludePaths: [],
      ...sourceOverrides,
    },
  };
}

test("the tree URL asks GitHub for the pinned commit", () => {
  assert.equal(
    upstreamTreeUrl({ repo: "owner/repo", commit: COMMIT }),
    `https://api.github.com/repos/owner/repo/git/trees/${COMMIT}?recursive=1`,
  );
});

test("a root-level Skill collects its references and drops showcase directories", () => {
  const { files, skipped } = selectSkillFiles([
    blob("SKILL.md", 4000),
    blob("README.md", 2000),
    blob("LICENSE", 1000),
    blob("references/art-modes.md", 3000),
    blob("agents/openai.yaml", 500),
    blob("examples/01_moon_gate.png", 2_400_000),
    blob("pay/AliPay.jpg", 170_000),
    blob("evals/case.md", 900),
  ]);

  const paths = files.map((file) => file.path);
  assert.ok(paths.includes("SKILL.md"));
  assert.ok(paths.includes("references/art-modes.md"));
  assert.ok(paths.includes("agents/openai.yaml"));
  assert.equal(paths[0], "SKILL.md", "SKILL.md is always taken first");
  for (const excluded of ["examples/01_moon_gate.png", "pay/AliPay.jpg", "evals/case.md"]) {
    assert.ok(!paths.includes(excluded), `${excluded} must not be fetched`);
  }
  assert.equal(skipped.length, 0, "excluded directories are filtered, not reported as skipped");
});

test("a Skill nested in a monorepo is scoped to its own directory", () => {
  const { files } = selectSkillFiles(
    [
      blob("skills/scenes-gathered-zine-v1-3/SKILL.md", 8000),
      blob("skills/scenes-gathered-zine-v1-3/references/palette.md", 1200),
      blob("skills/scene-distillation-zine-v1-3/SKILL.md", 9000),
      blob("README.md", 500),
    ],
    { directory: "skills/scenes-gathered-zine-v1-3" },
  );

  assert.deepEqual(files.map((file) => file.path).sort(), ["SKILL.md", "references/palette.md"]);
  assert.equal(
    files.find((file) => file.path === "SKILL.md").sourcePath,
    "skills/scenes-gathered-zine-v1-3/SKILL.md",
    "the upstream path is kept for downloading",
  );
});

test("directories the author marked private are never fetched", () => {
  const { files } = selectSkillFiles(
    [
      blob("SKILL.md", 4000),
      blob("assets/palette.png", 9000),
      blob("assets/examples/after-doodle.jpg", 125_000),
      blob("private-assets/reference-cutouts/contact_sheet_all.png", 231_000),
    ],
    { excludePaths: ["private-assets"] },
  );

  const paths = files.map((file) => file.path);
  assert.ok(paths.includes("assets/palette.png"), "real reference assets are still fetched");
  assert.ok(
    !paths.includes("assets/examples/after-doodle.jpg"),
    "a nested showcase directory is skipped just like a top-level one",
  );
  assert.ok(!paths.some((entry) => entry.startsWith("private-assets/")));
  assert.ok(DEFAULT_EXCLUDED_DIRECTORIES.includes("private-assets"));
});

test("loose images beside SKILL.md are treated as showcase, images in subdirectories are not", () => {
  const { files } = selectSkillFiles([
    blob("SKILL.md", 4000),
    blob("banner.png", 1_700_000),
    blob("18E61BD8-1EB4-49A7-814C-6696A52B32CC.png", 3_100_000),
    blob("README.md", 800),
    blob("references/style/style_ref_01.png", 875_000),
  ]);

  assert.deepEqual(files.map((file) => file.path).sort(), [
    "README.md",
    "SKILL.md",
    "references/style/style_ref_01.png",
  ]);
});

test("unsafe paths and unknown file types are refused", () => {
  const { files } = selectSkillFiles([
    blob("SKILL.md", 100),
    blob("../escape.md", 100),
    blob("nested/../../escape.md", 100),
    blob("install.sh", 100),
    blob("payload.bin", 100),
    blob("notes.txt", 100),
  ]);

  assert.deepEqual(files.map((file) => file.path).sort(), ["SKILL.md", "notes.txt"]);
});

test("a tree without SKILL.md at the pinned path is an error", () => {
  assert.throws(() => selectSkillFiles([blob("README.md", 100)]), /does not contain SKILL\.md/);
  assert.throws(
    () => selectSkillFiles([blob("skills/other/SKILL.md", 100)], { directory: "skills/wanted" }),
    /does not contain SKILL\.md/,
  );
});

test("an oversized SKILL.md fails loudly instead of being silently skipped", () => {
  assert.throws(
    () => selectSkillFiles([blob("SKILL.md", SKILL_FETCH_LIMITS.maxSkillMdBytes + 1)]),
    /larger than/,
  );
});

test("oversized reference files are skipped with a reason", () => {
  const { files, skipped } = selectSkillFiles([
    blob("SKILL.md", 4000),
    blob("references/huge.png", SKILL_FETCH_LIMITS.maxFileBytes + 1),
    blob("references/small.png", 5000),
  ]);

  assert.deepEqual(files.map((file) => file.path).sort(), ["SKILL.md", "references/small.png"]);
  assert.deepEqual(skipped, [
    { path: "references/huge.png", size: SKILL_FETCH_LIMITS.maxFileBytes + 1, reason: "file-too-large" },
  ]);
});

test("a tight budget still yields a runnable Skill", () => {
  const limits = { ...SKILL_FETCH_LIMITS, maxTotalBytes: 10_000 };
  const { files, skipped, totalBytes } = selectSkillFiles(
    [
      blob("SKILL.md", 6000),
      blob("references/tiny.md", 1000),
      blob("references/big.png", 900_000),
    ],
    { limits },
  );

  assert.deepEqual(files.map((file) => file.path), ["SKILL.md", "references/tiny.md"]);
  assert.ok(totalBytes <= limits.maxTotalBytes);
  assert.equal(skipped[0].reason, "total-size-budget");
});

test("the file count budget is enforced", () => {
  const limits = { ...SKILL_FETCH_LIMITS, maxFiles: 3 };
  const tree = [blob("SKILL.md", 100), ...Array.from({ length: 10 }, (_, n) => blob(`references/r${n}.md`, 100))];
  const { files, skipped } = selectSkillFiles(tree, { limits });

  assert.equal(files.length, 3);
  assert.equal(files[0].path, "SKILL.md");
  assert.ok(skipped.every((entry) => entry.reason === "file-count-budget"));
});

test("fetching writes the Skill into a commit-pinned cache directory", async () => {
  const root = await tempRoot();
  const requests = [];
  const fetchImpl = async (url) => {
    requests.push(url);
    if (url.startsWith("https://api.github.com/")) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          truncated: false,
          tree: [
            blob("skills/scenes-gathered-zine-v1-3/SKILL.md", 40),
            blob("skills/scenes-gathered-zine-v1-3/references/palette.md", 20),
          ],
        }),
      };
    }
    const body = url.endsWith("SKILL.md")
      ? "---\nname: scenes-gathered-zine-v1-3\ndescription: Zine.\n---\n"
      : "# palette\n";
    const bytes = Buffer.from(body);
    return { ok: true, status: 200, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
  };

  const skill = skillFixture();
  const result = await fetchUpstreamSkill({ skill, cacheRoot: root, fetchImpl });

  assert.equal(result.ok, true);
  assert.equal(result.state, "downloaded");
  assert.equal(result.files, 2);
  assert.equal(result.directory, upstreamSkillDir(root, { id: skill.id, commit: COMMIT }));
  assert.match(result.attribution.url, /^https:\/\/github\.com\/Zeejay0\/gathered-scenes-zine-skill\/blob\//);

  const skillMd = await readFile(path.join(result.directory, "SKILL.md"), "utf8");
  assert.match(skillMd, /name: scenes-gathered-zine-v1-3/);
  assert.ok((await stat(path.join(result.directory, "references/palette.md"))).isFile());

  const again = await fetchUpstreamSkill({ skill, cacheRoot: root, fetchImpl });
  assert.equal(again.state, "hit");
  assert.equal(requests.length, 3, "a pinned commit is only downloaded once");
});

test("a pinned file list re-expands to upstream paths", () => {
  assert.deepEqual(
    pinnedFilesAsTree([{ path: "SKILL.md", size: 40 }, { path: "references/a.md", size: 10 }], "skills/nested"),
    [
      { type: "blob", path: "skills/nested/SKILL.md", size: 40 },
      { type: "blob", path: "skills/nested/references/a.md", size: 10 },
    ],
  );
  assert.deepEqual(pinnedFilesAsTree([{ path: "SKILL.md", size: 40 }]), [
    { type: "blob", path: "SKILL.md", size: 40 },
  ]);
});

test("a pinned file list downloads without calling the rate-limited GitHub API", async () => {
  const root = await tempRoot();
  const log = [];
  const skill = skillFixture({
    source: {
      files: [{ path: "SKILL.md", size: 40 }, { path: "references/palette.md", size: 8 }],
    },
  });

  const result = await fetchUpstreamSkill({
    skill,
    cacheRoot: root,
    fetchImpl: async (url) => {
      log.push(url);
      const bytes = Buffer.from(url.endsWith("SKILL.md") ? "---\nname: x\ndescription: y\n---\n" : "# p\n");
      return { ok: true, status: 200, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.files, 2);
  assert.ok(!log.some((url) => url.startsWith("https://api.github.com/")), "the API must not be contacted");
  assert.ok((await stat(path.join(result.directory, "references/palette.md"))).isFile());
});

test("a rate-limited API listing explains how to avoid the limit", async () => {
  const root = await tempRoot();
  const result = await fetchUpstreamSkill({
    skill: skillFixture(),
    cacheRoot: root,
    fetchImpl: async () => ({ ok: false, status: 403 }),
  });

  assert.equal(result.ok, false);
  assert.match(result.message, /限流/);
  assert.match(result.message, /source\.files/);
});

test("a truncated or failed upstream listing reports a reason and writes nothing", async () => {
  const root = await tempRoot();
  const skill = skillFixture();

  const truncated = await fetchUpstreamSkill({
    skill,
    cacheRoot: root,
    fetchImpl: async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ truncated: true, tree: [] }) }),
  });
  assert.equal(truncated.ok, false);
  assert.match(truncated.message, /文件列表过大/);

  const notFound = await fetchUpstreamSkill({
    skill,
    cacheRoot: root,
    fetchImpl: async () => ({ ok: false, status: 404 }),
  });
  assert.equal(notFound.ok, false);
  assert.match(notFound.message, /HTTP 404/);

  const offline = await fetchUpstreamSkill({
    skill,
    cacheRoot: root,
    fetchImpl: async () => {
      throw new Error("ENOTFOUND");
    },
  });
  assert.equal(offline.ok, false);
  assert.match(offline.message, /无法连接上游仓库/);

  await assert.rejects(() => stat(upstreamSkillDir(root, { id: skill.id, commit: COMMIT })));
});

test("a partial download never leaves a half-written Skill behind", async () => {
  const root = await tempRoot();
  const skill = skillFixture();
  const result = await fetchUpstreamSkill({
    skill,
    cacheRoot: root,
    fetchImpl: async (url) => {
      if (url.startsWith("https://api.github.com/")) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            truncated: false,
            tree: [
              blob("skills/scenes-gathered-zine-v1-3/SKILL.md", 40),
              blob("skills/scenes-gathered-zine-v1-3/references/palette.md", 20),
            ],
          }),
        };
      }
      if (url.endsWith("palette.md")) return { ok: false, status: 500 };
      const bytes = Buffer.from("---\nname: x\ndescription: y\n---\n");
      return { ok: true, status: 200, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
    },
  });

  assert.equal(result.ok, false);
  const destination = upstreamSkillDir(root, { id: skill.id, commit: COMMIT });
  await assert.rejects(() => stat(destination), "the target directory must not exist");
  await assert.rejects(() => stat(`${destination}.partial`), "staging must be cleaned up");
});

test("a Skill with no upstream source can not be fetched", async () => {
  const root = await tempRoot();
  const result = await fetchUpstreamSkill({ skill: { id: "local-only" }, cacheRoot: root, fetchImpl: async () => ({}) });
  assert.equal(result.ok, false);
  assert.match(result.message, /没有可下载的上游来源/);
});
