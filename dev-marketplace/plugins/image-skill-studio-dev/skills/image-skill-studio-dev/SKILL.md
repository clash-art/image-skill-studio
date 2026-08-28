---
name: image-skill-studio-dev
description: Open the live Image Skill Studio checkout (hot UI from the local project, not the GitHub-installed snapshot). Use when developing Image Skill Studio, iterating on the workbench, or the user asks for the dev / local / hot-reload Studio.
---

# Image Skill Studio (dev)

This plugin is the live working tree. Call `open_image_skill_studio_dev` to open it. Do not call `open_image_skill_studio`; that belongs to the GitHub-installed plugin.

Creative Skills, catalog, and user data still come from the project checkout and `~/.codex/image-skill-studio`. `$imagegen` is the preferred host Codex image skill when it is available; refer to it by name, never by filesystem path. Other image skills or generation methods are allowed when they fit better.

After a UI rebuild, reopen the App. After a server or tool change, start a new thread so Codex relaunches the live process.

## Complete a handoff from the App

Only after a real image exists, call `record_image_generation_dev` with the same Run ID and `status: "succeeded"`. If generation fails, do not call this tool and do not record a failed run. Register and install use `register_image_skill_dev` and `install_image_skill_dev`.
