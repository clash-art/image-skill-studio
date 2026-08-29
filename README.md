# Awesome Image Skill [![Awesome](https://awesome.re/badge-flat2.svg)](https://github.com/sindresorhus/awesome)

> A curated list of Codex image-generation Skills — plus a workbench that installs and runs them.

Codex Skills turn a photo or a sentence into a finished image with a specific visual language: torn-paper zine posters, CRT interface caricatures, travel sticker cards, fictional vinyl sleeves. This list collects the best of them, ranked by GitHub stars.

The list is also a machine-readable feed. The bundled [Image Skill Studio](#the-workbench) plugin reads it, shows every Skill with its examples, and fetches a Skill from its author's repository the moment you use it — so the catalogue grows without anyone reinstalling anything.

## Contents

- [Skills](#skills)
- [Install](#install)
- [The workbench](#the-workbench)
- [How the registry works](#how-the-registry-works)
- [Adding a Skill](#adding-a-skill)
- [Licence and attribution](#licence-and-attribution)
- [Develop](#develop)

## Skills

Ranked by stars. Licence labels are the author's own terms, not ours — read [Licence and attribution](#licence-and-attribution) before you use a Skill commercially.

| Licence label | Meaning |
| --- | --- |
| `MIT` | Permissive. Reuse and modify freely, with attribution. |
| `Non-commercial` | The author allows personal use only. |
| `No licence` | No licence file upstream, so all rights are reserved by default. |

- **[gc-minimal-zine-poster](https://github.com/LiamGvchi/gc-minimal-zine-poster)** — Quiet minimal zine posters: big negative space, a small editorial collage, one clear colour accent. `⭐ 6.2k` `MIT`
- **[photo-abstract-editorial](https://github.com/ZzzLc0405/photo-abstract-editorial)** — Keeps your photo untouched and pairs it with an abstract memory panel derived from its own tones and spacing. `⭐ 3.8k` `Non-commercial`
- **[gathered-scenes-zine-skill](https://github.com/Zeejay0/gathered-scenes-zine-skill)** — Two Skills in one repo. *Gathered Scenes* anchors real photography inside a hand-torn paper collage; *Scene Distillation* throws the photograph away and keeps only its emotion. `⭐ 3.6k` `Non-commercial`
- **[photo-revival](https://github.com/dacnay816y62-hub/photo-revival)** — Redraws everyday snapshots as poetic hand-drawn illustrations on white paper with tiny handwritten captions. `⭐ 416` `MIT`
- **[tait-crt-interface-skill](https://github.com/TaiT-tt/tait-crt-interface-skill)** — Portraits re-authored as 1980s bitmap caricatures under early Macintosh windows, with barrel-curved CRT edges. `⭐ 362` `No licence`
- **[ip_illustration_for_yourself](https://github.com/EverettFish/ip_illustration_for_yourself)** — Builds one reusable personal IP character and keeps it consistent across article illustrations and infographics. `⭐ 175` `No licence`
- **[surreal-pop-collage](https://github.com/2998980-hue/surreal-pop-collage)** — Desaturates your subject into a reality anchor, replaces the world with flat colour fields, and adds exactly one impossible giant object. `⭐ 171` `MIT`
- **[heytea-style](https://github.com/Hchen1218/heytea-style)** — HEYTEA-flavoured doodle posters: real object anchors, black-line micro workers, optional crooked childlike lettering. `⭐ 147` `No licence`
- **[travel-memory-sticker-card](https://github.com/carolinaaafy/travel-memory-sticker-card)** — Turns a travel photo into a collectible card with six journaling-sticker motifs and three English keywords. `⭐ 138` `No licence`
- **[reality-restaged](https://github.com/traveler0621/reality-restaged)** — Keeps documentary people and gestures intact while rebuilding the world around them as a saturated cinematic stage. `⭐ 77` `No licence`
- **[travel-memory-card-duo](https://github.com/carolinaaafy/travel-memory-card-duo)** — The card, plus a separate transparent-background PNG of the same six die-cut stickers. `⭐ 60` `No licence`
- **[vinyl-image-generator](https://github.com/liigoQi/vinyl-image-generator)** — Turns a memory into a complete fictional record: front and back sleeve, vinyl side A and side B. `⭐ 13` `MIT`
- **[scene-to-art-lab](https://github.com/N1kO724/scene-to-art-lab)** — Reinterprets a photo as a 3:4 art poster in one committed medium: watercolour, screenprint, ink-wash, or relief print. `⭐ 3` `Non-commercial`

One more Skill ships inside the workbench itself: `classic-epic-movie-poster`.

## Install

Image Skill Studio installs as a Codex plugin. You do not need to clone this repository or install Node.js.

See the public installation guide at [clash.art/studio/image/plugin](https://clash.art/studio/image/plugin), or run the commands below.

1. Add the plugin marketplace:

```bash
codex plugin marketplace add hrhrng/awesome-image-skill
```

2. Install Image Skill Studio:

```bash
codex plugin add image-skill-studio@image-skill-studio
```

3. Start a new Codex task and ask:

```text
Open Image Skill Studio
```

Codex installs the committed plugin bundle and opens the Studio as an interactive MCP App. Skills marked as remote are downloaded from their pinned upstream commit only when you first use them.

## The workbench

Image Skill Studio is a Codex plugin whose product surface is an MCP App. It shows the list above as an image feed, hands a prompt and optional reference images to the current Codex agent, collects the generated image under the Skill that made it, and exports 1080 × 1440 Xiaohongshu comparison cards.

See [Install](#install) for the two commands and the prompt that opens it.

## How the registry works

Codex plugins do not auto-update. `codex plugin marketplace upgrade` is a manual command, and installs are pinned into a versioned cache directory. If the catalogue lived only inside the plugin, every new Skill would require every user to run two commands and restart a thread.

So the catalogue is split into four layers by how often each one changes.

| Layer | Lives in | Refreshes |
| --- | --- | --- |
| Plugin runtime | the installed plugin | only when the code changes |
| Skill feed | `catalog/registry.json`, served over HTTPS | on open, in the background |
| Cover and example images | content-addressed disk cache | once, then never again |
| Skill content | the author's repo, at a pinned commit | when you first use the Skill |

The feed is cached with an ETag and served stale-while-revalidate: opening the app renders the cached feed immediately and revalidates behind it, so the UI never waits on a request and keeps working offline. Media and Skill files are pinned to a commit, which makes them immutable — a cache hit is always correct, and an update is simply a different URL. Everything lives under `~/.codex/image-skill-studio/cache`, bounded by a least-recently-used budget.

The plugin ships a seed copy of the feed, so a first launch with no network still shows a complete workbench.

Fetching a Skill uses only `raw.githubusercontent.com`, never the GitHub API, because the anonymous API allows just 60 requests an hour per IP and would fail in normal use. The feed pins each Skill's file list instead, which is safe precisely because the commit is pinned too. A fetch takes `SKILL.md`, its reference material, and its `LICENSE` — not the showcase galleries, which is what keeps a fetch in the tens of kilobytes for most Skills.

Two escape hatches: `IMAGE_SKILL_STUDIO_FEED_URL` points the plugin at a different feed, and `IMAGE_SKILL_STUDIO_OFFLINE=1` pins it to the bundled seed.

```bash
npm run pin:skill-files   # refresh the pinned file lists (needs an authenticated gh)
npm run verify:registry   # confirm every pinned URL still resolves
```

## Adding a Skill

Add one entry to `catalog/registry.json`. Nothing is copied into this repo, so an upstream Skill needs no licence negotiation to be *listed*.

```json
{
  "id": "my-poster-skill",
  "origin": "remote",
  "displayName": "My Poster Skill",
  "description": "One sentence on what this method does.",
  "category": "海报",
  "stars": 128,
  "author": { "name": "someone", "url": "https://github.com/someone" },
  "license": { "spdx": "MIT", "name": "MIT License", "redistribute": true, "commercial": true },
  "source": {
    "repo": "someone/my-poster-skill",
    "commit": "<full 40-character commit sha>",
    "skillPath": "SKILL.md"
  },
  "capabilities": { "references": true, "maxReferences": 1, "aspectRatios": ["3:4"] },
  "cover": "examples/cover.png",
  "gallery": [{ "id": "shot-one", "image": "examples/shot-one.png" }]
}
```

- `id` must be the kebab-case `name` from the Skill's own frontmatter, because that is what Codex invokes.
- `commit` must be a full SHA. Pinning is what makes caching safe.
- `cover` and `gallery` paths are relative to the upstream repo and become commit-pinned raw URLs.
- `examples` are promptable slots and need a `prompt`; `gallery` items are display-only.
- Set `source.excludePaths` for directories the author marked private, or for showcase galleries that a directory name gives away.

Then run `npm run pin:skill-files` to fill in `source.files`, and `npm run verify:registry && npm test`. See `catalog/README.md` for the operational slot rules.

## Licence and attribution

This repository is MIT licensed, and that covers the workbench and the list — **not** the Skills.

Every Skill stays under its author's own terms. Only Skills whose licence permits redistribution are ever vendored into the plugin; everything else is fetched from the author's repository at the pinned commit when you ask for it, so the licence, the `LICENSE` file, and the attribution travel with the source instead of being copied away from it.

Of the thirteen listed repositories, four are MIT, six carry no licence file at all — which means all rights are reserved by default — and three restrict use to personal, non-commercial purposes. One of those three explicitly forbids bundling its Skill into another Skill package, which is precisely the arrangement this repository avoids. The workbench shows each Skill's licence before it fetches anything, and `npm test` fails if a Skill without redistribution rights is ever vendored into `skills/`.

If you are an author on this list and want your Skill presented differently or removed, open an issue.

## Develop

Requires Node.js 22.13 or newer.

```bash
npm install
npm run build:plugin
npm test
npm run verify:registry
```

`npm run dev` is an optional browser preview of the same React component, not the Codex App.

### Live checkout

Both registrations can stay enabled at once. The live plugin uses `*_dev` tool names so it does not collide with the published one. Ask to `Open the live Image Skill Studio` for this checkout.

```bash
npm run sync:dev-plugin
codex plugin marketplace add /Users/xiaoyang/Proj/image-skill-studio/dev-marketplace
codex plugin add image-skill-studio-dev@image-skill-studio-local
```

`npm run sync:dev-plugin` writes absolute paths into the wrapper's `.mcp.json` so the cached plugin still execs this working tree. Re-run it if you move the checkout. UI rebuilds land in `public/widget.html`; reopen the App to see them. Server and tool changes need a new thread so the host relaunches the process.

### Publishing

`npm run build:plugin` compiles the workbench into `public/widget.html` and bundles `server/entry.mjs` into `runtime/server.mjs` with the HTML inlined. Commit both. Feed-only changes still need a commit to `catalog/registry.json` on `main`, but no rebuild and no reinstall.

### Layout

- `catalog/registry.json` — the Skill feed. Ships as the offline seed and is served as the live feed.
- `lib/skill-registry.mjs` — feed schema, ranking, and commit-pinned URL building.
- `lib/registry-cache.mjs` — ETag document cache and content-addressed media cache.
- `lib/skill-fetch.mjs` — on-demand fetch of an upstream Skill at a pinned commit.
- `server/registry-source.mjs` — ties the seed, the cached feed, and on-demand fetching together.
- `server/studio-server.mjs` — MCP tools, app resource, and lazily resolved media resources.
- `web/` and `components/` — the MCP App UI.
- `skills/` — the Skills that ship inside the plugin.
- `assets/` — covers and example images for the bundled Skills.
