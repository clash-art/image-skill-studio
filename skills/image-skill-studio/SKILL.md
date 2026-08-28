---
name: image-skill-studio
description: Open and operate the Image Skill Studio MCP App. Use whenever the user wants a sidebar of image-generation Skills, asks to hand image work to Codex, generates from a prompt or reference image through a selected Skill, browses saved results, or exports Xiaohongshu comparison cards.
---

# Image Skill Studio

Use the plugin as a small orchestration layer around Image Skill Studio's hosted image-generation Skills. Preserve the selected Skill's creative method; this Skill only governs handoff, result collection, and Skill library management.

Creative Skills live beside this file under the plugin `skills/` directory, or in the Studio data directory after a user registers them. Do not assume they already exist in `~/.codex/skills`. `$imagegen` is the host Codex Skill only; refer to it by name, never by filesystem path, and never copy it into the user's skills directory.

## Open the workbench

Call `open_image_skill_studio` when the user asks to open, show, browse, or use the image Skill workbench. Its `text/html;profile=mcp-app` resource is the product surface: Feed handles discovery and recent results, while each Skill page handles generation, prompt-backed examples, remixing, and that Skill's saved results.

## Register and install Skills

- `register_image_skill` copies a validated local Skill into Studio. The source must be an absolute path to a Skill directory or `SKILL.md` with kebab-case `name` and a `description`. Reserved names (`imagegen`, `image-skill-studio`) and bundled Studio Skills cannot be overwritten.
- `install_image_skill` copies a Studio-hosted Skill into the user's built-in Codex skills directory (`$CODEX_HOME/skills` or `~/.codex/skills`). Never install into `.system`, and never install `$imagegen`.

## Complete a handoff from the App

An App-generated message contains an Image Skill Studio Run ID, the selected Skill, its exact path/hash, the prompt, ratio, and any reference images.

1. Read the selected Skill's exact `SKILL.md` path completely.
2. Apply that Skill's method to the prompt and attached references.
3. Produce one final raster image at the requested ratio. Prefer `$imagegen` and its default built-in `image_gen` tool when that skill is available. Do not use the ImageGen CLI fallback. If `$imagegen` is unavailable, or another image skill, tool, or method is a better fit, use that instead.
4. Keep the work inside the image task. Do not edit unrelated project files.
5. Only after a real image exists, call `record_image_generation` with the same Run ID and `status: "succeeded"`. Prefer the real absolute `savedPath` returned by the image tool; use the image file parameter when the host exposes only a file object. If generation fails, do not call this tool and do not record a failed run.

The saved results are evidence-backed: never report success or invent a file until an actual image artifact exists.

## Reference images

Treat message image blocks in the same order as the references listed in the run. Respect each role (`subject`, `style`, `composition`, or `reference`). If a reference cannot be read, stop and tell the user; do not silently switch to text-only generation, and do not record a failed run.

## Exports

The MCP App renders Xiaohongshu templates deterministically at 1080 × 1440. Do not ask ImageGen to typeset the export card; return the clean generated artifact and let the App compose prompt-to-result or reference-to-result layouts.
