# Image Skill Studio

Image Skill Studio is a local Codex Plugin whose primary interface is an MCP App sidebar. It curates image-generation Skills, hands a prompt and optional reference images to the current Codex agent, collects the generated image under the selected Skill, and exports deterministic 1080 × 1440 Xiaohongshu comparison cards.

## Product shape

- `Feed`: recent generated work first, followed by an image-led Skill feed.
- `Skill`: a continuous image feed: curated examples, a bottom-center Codex Agent that docks into the composer, then the user's real generated work.
- Motion: every visible collection image owns a stable card and media identity, so the first four items reset into their exact detail-feed positions.
- Handoff: the MCP App uses `ui/message`; Codex follows the selected Skill, calls ImageGen, then records the saved artifact with `record_image_generation`.
- Results: generated files are copied into Plugin data and exposed back to the App as MCP image resources.
- Export: prompt → image and reference → image templates are rendered locally to PNG, without asking ImageGen to draw UI text.

The localhost page is only a development preview of the same React component. The shipped product surface is `ui://image-skill-studio/v1/workbench.html`.

## Develop

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
npm test
```

Build the self-contained MCP App and server runtime:

```bash
npm run build:plugin
```

Build everything, including the browser preview:

```bash
npm run build
```

## Install locally

From `~/Proj/image-skill-studio`:

```bash
codex plugin marketplace add .
codex plugin add image-skill-studio@image-skill-studio-dev
```

The workbench HTML is embedded in `runtime/server.mjs`. Codex may copy the plugin into a versioned cache and set `PLUGIN_ROOT` to a stripped `0.1.0` path; the server ignores that, serves the embedded App, and resolves Skills from the directory next to the running server.

Reload Codex or start a new task, then ask to `Open Image Skill Studio`.

## Key files

- `.codex-plugin/plugin.json`: Plugin manifest.
- `.mcp.json`: bundled MCP server entry.
- `server/studio-server.mjs`: tools, App resource, curated examples, and artifact resources.
- `assets/runs`: independent ImageGen cold-start work, kept separate from curated Skill examples.
- `web/widget.tsx`: standards-first MCP Apps bridge with Codex compatibility fallback.
- `components/image-skill-studio.tsx`: Feed and Skill routes.
- `skills/`: plugin-hosted Skills. `image-skill-studio` orchestrates the App; featured creative Skills ship beside it. Users can register more Skills into Studio and install Studio Skills into `~/.codex/skills`.
- `lib/studio-skill-registry.mjs`: validation, registration, and install-to-Codex copy rules.
- `server/codex-app-client.mjs`: optional direct Codex app-server client for non-recursive hosts.

## Verification

`npm test` covers prompt snapshots, the MCP App resource contract, `ui/message`-ready widget output, saved-image resources, Skill discovery, Xiaohongshu layout math, Codex app-server protocol handling, and production builds.
