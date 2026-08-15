# Image Skill Studio

A local Codex plugin whose product surface is an MCP App: `ui://image-skill-studio/v1/workbench.html`. It hosts image-generation Skills, hands a prompt and optional reference images to the current Codex agent, collects the generated image under the selected Skill, and exports 1080 × 1440 Xiaohongshu comparison cards.

The localhost page is only a development preview of the same React component.

## Runtime contract

Codex starts one process:

```text
node ./runtime/server.mjs
```

That file is the plugin. `npm run build:plugin` compiles the workbench (`web/` → `public/widget.html`) and then bundles `server/entry.mjs` so the HTML is inlined and `PACKAGE_ROOT` is the directory that contains `runtime/`. Skills, previews, and assets are resolved from that directory. The server does not read `PLUGIN_ROOT` or `cwd` to find itself.

User data (runs, registered Skills, copied artifacts) lives in `PLUGIN_DATA`, defaulting to `~/.codex/image-skill-studio`.

## Develop

Requires Node.js 22.13 or newer. Work in `~/Proj/image-skill-studio`.

```bash
npm install
npm run build:plugin
npm test
npm run dev:plugin    # rebuild runtime/server.mjs on source changes
```

`npm run dev` is the optional browser preview, not the Codex App.

## Install

```bash
codex plugin marketplace add /Users/xiaoyang/Proj/image-skill-studio
codex plugin add image-skill-studio@image-skill-studio-dev
```

Open a new Codex thread and ask to `Open Image Skill Studio`. After a server rebuild, reopen the App or start a new thread so Codex relaunches `runtime/server.mjs`.

## Layout

- `web/` + `components/`: MCP App UI. Built into `public/widget.html`, then inlined into `runtime/server.mjs`.
- `server/`: MCP tools, catalog, run store. Entry is `server/entry.mjs`; Codex runs the bundle.
- `skills/`: plugin-hosted Skills. `image-skill-studio` orchestrates the App; featured creative Skills ship beside it. Users can register more Skills into Studio and install Studio Skills into `~/.codex/skills`.
- `assets/`: curated examples and cold-start generated work.
- `.codex-plugin/plugin.json` and `.mcp.json`: plugin manifest and the stdio command above.
