import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(import.meta.dirname, "..");
export const DEV_PLUGIN_ROOT = path.join(
  REPO_ROOT,
  "dev-marketplace",
  "plugins",
  "image-skill-studio-dev",
);

export function createDevMcpConfig(repoRoot = REPO_ROOT) {
  return {
    mcpServers: {
      "image-skill-studio-dev": {
        command: "node",
        args: [path.join(repoRoot, "scripts", "dev-mcp.mjs")],
        cwd: repoRoot,
      },
    },
  };
}

export async function syncDevPlugin(repoRoot = REPO_ROOT) {
  const pluginRoot = path.join(repoRoot, "dev-marketplace", "plugins", "image-skill-studio-dev");
  await mkdir(pluginRoot, { recursive: true });
  const mcpPath = path.join(pluginRoot, ".mcp.json");
  await writeFile(mcpPath, `${JSON.stringify(createDevMcpConfig(repoRoot), null, 2)}\n`);
  return mcpPath;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mcpPath = await syncDevPlugin();
  console.error(`wrote ${mcpPath}`);
}
