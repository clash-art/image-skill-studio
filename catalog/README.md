# 运营槽位

`registry.json` 既是插件自带的离线种子，也是发布给所有用户的 feed。改完提交到 `main`，用户下次打开 App 就会看到，不需要重装插件。

Feed 上每个 Skill 最多展示 `exampleSlotLimit`（默认 10）个官方示例。生成记录是另一组槽位：只收录 agent 成功回写的真图，发起任务不占位。

排序由 star 数决定（没有 star 的自研 Skill 排在最后），代码里做，不用手动调数组顺序。

改完跑一遍：

```bash
npm run pin:skill-files   # 重新算 source.files（需要已登录的 gh）
npm run verify:registry   # 检查每个 pin 住的上游 URL 还在
npm test
```

只改 feed 不用重新 `npm run build:plugin`；改了 `server/` 或 `web/` 才需要。

## 三种 origin

| origin | Skill 内容来自 | 素材来自 |
| --- | --- | --- |
| `host` | Codex 自带的保留类型；当前 feed 未收录 | 仓库内相对路径 |
| `bundled` | 仓库里的 `skills/<id>` | 仓库内相对路径 |
| `remote` | 用户点用时按 `source.commit` 从原仓库拉取 | 上游仓库的 commit-pinned raw URL |

**只有许可证允许再分发的 Skill 才能用 `bundled`。** 其余一律 `remote`：我们只存元数据和链接，内容留在作者仓库里，许可证和署名跟着源头走。测试会拦住违规的 `bundled`。

## 增加一个收录（remote）

```json
{
  "id": "my-poster-skill",
  "origin": "remote",
  "displayName": "我的海报",
  "description": "一句话说明这个方法。",
  "category": "海报",
  "accent": "ochre",
  "stars": 128,
  "author": { "name": "someone", "url": "https://github.com/someone" },
  "license": {
    "spdx": "MIT",
    "name": "MIT License",
    "redistribute": true,
    "commercial": true
  },
  "source": {
    "repo": "someone/my-poster-skill",
    "commit": "完整 40 位 commit sha",
    "skillPath": "SKILL.md"
  },
  "capabilities": { "references": true, "maxReferences": 1, "aspectRatios": ["3:4"] },
  "cover": "examples/cover.png",
  "gallery": [{ "id": "shot-one", "image": "examples/shot-one.png" }]
}
```

几个容易踩的点：

- `id` 必须是该 Skill frontmatter 里的 `name`（kebab-case），因为 Codex 是按这个名字调用的。仓库名经常和它不一样。
- `commit` 必须是完整 SHA。pin 住 commit 才能把素材当成不可变内容永久缓存。
- `skillPath` 要指到 `SKILL.md`。像 `skills/<id>/SKILL.md` 这种子目录也可以，会自动只抓那个目录。
- `license` 里不写 `redistribute` / `commercial` 就默认是 `false`——没声明许可证等于保留所有权利。
- 作者标了私有的目录写进 `source.excludePaths`，按需下载时会跳过。看名字就知道是展示图的目录（比如 `生成示例`）也一并写进去，否则会白下几十 MB。
- 一个仓库有多个 Skill 就写多条，`source.skillPath` 各自指向自己的 `SKILL.md`。
- `source.files` 不用手写，跑 `npm run pin:skill-files` 生成。

## 为什么要 pin `source.files`

按需下载只走 `raw.githubusercontent.com`，不走 GitHub API——匿名调 API 每个 IP 每小时只有 60 次，真实用户很快就会撞到 403。所以文件清单提前算好写进 feed；因为 commit 已经 pin 住了，这份清单和 commit 一样是不可变的。

只抓 `SKILL.md`、参考资料和 `LICENSE`，不抓成品展示图（`examples/`、根目录下散落的图片、`assets/examples/` 这类都跳过）。所以大多数 Skill 一次下载只有几十 KB。

## 增加一个自研 Skill（bundled）

1. Skill 放到 `skills/<id>/SKILL.md`，`id` 与 frontmatter `name` 一致。
2. 封面和示例图放到 `assets/previews/` 或 `assets/examples/<skill-id>/`。
3. 在 `registry.json` 里加一条 `origin: "bundled"`，`cover` 和 `examples[].image` 写仓库内相对路径。

## 示例槽位与展示图

`examples` 是可以点进 Composer 的槽位，必须带 `prompt`；`gallery` 只用于展示，不带 `prompt`。

```json
{
  "id": "last-train",
  "prompt": "用户点这个槽位时填进 Composer 的提示词。",
  "aspectRatio": "3:4",
  "image": "assets/examples/classic-epic-movie-poster/last-train.png"
}
```

`prompt` 是 App 里展示和 remix 用的短文案。真正出图时 agent 仍会完整读该 Skill 的 `SKILL.md`。

remote Skill 一般没有我们自己写的 prompt，所以用 `gallery` 放作者仓库里的成品图；等你用它生成过自己的图，再补 `examples`。
