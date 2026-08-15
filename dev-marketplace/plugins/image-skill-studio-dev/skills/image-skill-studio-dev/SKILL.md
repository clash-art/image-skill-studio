---
name: image-skill-studio-dev
description: Open the live Image Skill Studio checkout (hot UI from the local project, not the GitHub-installed snapshot). Use when developing Image Skill Studio, iterating on the workbench, or the user asks for the dev / local / hot-reload Studio.
---

# Image Skill Studio (dev)

This plugin is the live working tree. Call `open_image_skill_studio` on the `image-skill-studio-dev` MCP server. Do not open the GitHub-installed `image-skill-studio` plugin while this one is the intended target.

Creative Skills, catalog, and user data still come from the project checkout and `~/.codex/image-skill-studio`. `$imagegen` is the host Codex Skill only; refer to it by name, never by filesystem path.

After a UI rebuild, reopen the App. After a server or tool change, start a new thread so Codex relaunches the live process.
