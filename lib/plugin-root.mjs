import { existsSync } from "node:fs";
import path from "node:path";

function isPluginRoot(root) {
  return existsSync(path.join(root, "public", "widget.html"))
    || existsSync(path.join(root, "skills", "image-skill-studio", "SKILL.md"))
    || existsSync(path.join(root, "runtime", "server.mjs"));
}

export function resolvePluginRoot({
  envRoot = process.env.PLUGIN_ROOT,
  cwd = process.cwd(),
  moduleRoot,
} = {}) {
  const candidates = [moduleRoot, cwd, envRoot]
    .filter(Boolean)
    .map((root) => path.resolve(root));

  return candidates.find(isPluginRoot) || candidates[0] || path.resolve(cwd);
}
