# Image Skill Studio

A Codex plugin whose product surface is an MCP App: `ui://image-skill-studio/v1/workbench.html`. It hosts image-generation Skills, hands a prompt and optional reference images to the current Codex agent, collects the generated image under the selected Skill, and exports 1080 × 1440 Xiaohongshu comparison cards.

The localhost page is only a development preview of the same React component.

## Two registrations

Install **one** of these in a given Codex session. Both plugins expose `open_image_skill_studio`; leaving both enabled makes the agent guess which copy to open.

### Dev (live checkout)

Codex starts this repo's source MCP process. It does not run the copy in `~/.codex/plugins/cache`. UI rebuilds land in `public/widget.html`; reopen the App to see them. Server and tool changes need a new thread so the host relaunches the process.

```bash
npm install
npm run sync:dev-plugin
codex plugin marketplace add /Users/xiaoyang/Proj/image-skill-studio/dev-marketplace
codex plugin add image-skill-studio-dev@image-skill-studio-local
```

`npm run sync:dev-plugin` writes absolute paths into the wrapper's `.mcp.json` so the cached plugin still execs this working tree. Re-run it if you move the checkout, then `codex plugin add image-skill-studio-dev@image-skill-studio-local` again.

`npm run dev:plugin` only rebuilds the **stable** bundle (`runtime/server.mjs`). You do not need it for the live plugin.

### Stable (GitHub)

This is the published snapshot. Codex runs `node ./runtime/server.mjs` from the installed plugin cache.

```bash
codex plugin marketplace add hrhrng/image-skill-studio
codex plugin add image-skill-studio@image-skill-studio
```

The repo is private; GitHub auth must already work for `git clone`. After a release lands on `main`, `codex plugin marketplace upgrade image-skill-studio` then re-add the plugin.

Open a new Codex thread and ask to `Open Image Skill Studio` (stable) or `Open the live Image Skill Studio` (dev).

## Runtime contract

The GitHub plugin starts one process:

```text
node ./runtime/server.mjs
```

`npm run build:plugin` compiles the workbench (`web/` → `public/widget.html`) and then bundles `server/entry.mjs` so the HTML is inlined and `PACKAGE_ROOT` is the directory that contains `runtime/`. Skills, previews, and assets are resolved from that directory. The server does not read `PLUGIN_ROOT` or `cwd` to find itself.

The live plugin starts `scripts/dev-mcp.mjs` instead: same `createStudioServer`, HTML read from disk, catalog from this checkout.

User data (runs, registered Skills, copied artifacts) lives in `PLUGIN_DATA`, defaulting to `~/.codex/image-skill-studio`. Dev and stable share that directory.

## Develop

Requires Node.js 22.13 or newer. Work in `~/Proj/image-skill-studio`.

```bash
npm install
npm run build:plugin
npm test
npm run sync:dev-plugin
npm run dev:plugin    # optional: rebuild runtime/server.mjs for the GitHub plugin
```

`npm run dev` is the optional browser preview, not the Codex App.

## Layout

- `web/` + `components/`: MCP App UI. Built into `public/widget.html`, then inlined into `runtime/server.mjs` for the GitHub plugin.
- `server/`: MCP tools, catalog, run store. Entry is `server/entry.mjs`; Codex runs the bundle for stable, or `scripts/dev-mcp.mjs` for live.
- `skills/`: plugin-hosted Skills. `image-skill-studio` orchestrates the App; featured creative Skills ship beside it. Users can register more Skills into Studio and install Studio Skills into `~/.codex/skills`.
- `assets/`: curated examples and cold-start generated work.
- `.codex-plugin/plugin.json` and `.mcp.json`: GitHub plugin manifest and `node ./runtime/server.mjs`.
- `dev-marketplace/`: local-only catalog for `image-skill-studio-dev`. Not listed on GitHub.
