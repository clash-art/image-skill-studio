---
name: image-skill-studio
description: Open and operate the Image Skill Studio MCP App. Use whenever the user wants a sidebar of image-generation Skills, asks to hand image work to Codex, generates from a prompt or reference image through a selected Skill, browses saved results, or exports Xiaohongshu comparison cards.
---

# Image Skill Studio

Use the plugin as a small orchestration layer around the user's installed image-generation Skills. Preserve the selected Skill's creative method; this Skill only governs handoff and result collection.

## Open the workbench

Call `open_image_skill_studio` when the user asks to open, show, browse, or use the image Skill workbench. Its `text/html;profile=mcp-app` resource is the product surface: Feed handles discovery and recent results, while each Skill page handles generation, prompt-backed examples, remixing, and that Skill's saved results.

## Complete a handoff from the App

An App-generated message contains an Image Skill Studio Run ID, the selected Skill, its exact path/hash, the prompt, ratio, and any reference images.

1. Read the selected Skill's exact `SKILL.md` path completely.
2. Apply that Skill's method to the prompt and attached references.
3. Use the system `imagegen` capability to generate exactly one final image at the requested ratio.
4. Keep the work inside the image task. Do not edit unrelated project files.
5. Call `record_image_generation` with the same Run ID. Prefer the real absolute `savedPath` returned by ImageGen; use the image file parameter when the host exposes only a file object. Record `failed` with the actual error if no image was produced.

The saved results are evidence-backed: never report success or invent a file until an actual image artifact exists.

## Reference images

Treat message image blocks in the same order as the references listed in the run. Respect each role (`subject`, `style`, `composition`, or `reference`). If a reference cannot be read, record a clear failure instead of silently switching to text-only generation.

## Exports

The MCP App renders Xiaohongshu templates deterministically at 1080 × 1440. Do not ask ImageGen to typeset the export card; return the clean generated artifact and let the App compose prompt-to-result or reference-to-result layouts.
