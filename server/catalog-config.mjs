import os from "node:os";
import path from "node:path";

import { COLD_START_RUN_SEEDS } from "../lib/cold-start-run-seeds.mjs";

export const DEFAULT_RUN_SEEDS = COLD_START_RUN_SEEDS.map((seed) => ({
  ...seed,
  artifactPath: path.resolve(import.meta.dirname, "..", seed.assetPath),
}));

export const DEFAULT_CATALOG_ENTRIES = [
  {
    id: "imagegen",
    displayName: "Image Gen",
    description: "通用文生图、参考图生成与编辑。",
    path: path.join(os.homedir(), ".codex/skills/.system/imagegen"),
    previewPath: path.resolve(import.meta.dirname, "../assets/previews/imagegen-demo.png"),
    examples: [
      {
        id: "cobalt-sculpture",
        prompt: "奶油色纸张背景上，一件钴蓝色半透明雕塑与一颗珊瑚红小球构成安静的编辑静物，柔和长影，大量留白。",
        aspectRatio: "3:4",
        previewPath: path.resolve(import.meta.dirname, "../assets/previews/imagegen-demo.png"),
      },
      {
        id: "quiet-orbit",
        prompt: "象牙白陶瓷卫星环绕一颗朱红柿子，淡蓝纸面，克制的编辑静物，柔和自然光与精确留白。",
        aspectRatio: "3:4",
        previewPath: path.resolve(import.meta.dirname, "../assets/examples/imagegen/quiet-orbit.png"),
      },
      {
        id: "glass-koi",
        prompt: "一尾透明手工玻璃锦鲤跃出深蓝水面，琥珀色鱼鳍被侧光点亮，极简深色编辑摄影，大量安静留白。",
        aspectRatio: "3:4",
        previewPath: path.resolve(import.meta.dirname, "../assets/examples/imagegen/glass-koi.png"),
      },
      {
        id: "coral-door",
        prompt: "无边盐原中央竖立一扇珊瑚红的独立门，门后只有淡青天空与一道细长影子，超现实极简编辑摄影。",
        aspectRatio: "3:4",
        previewPath: path.resolve(import.meta.dirname, "../assets/examples/imagegen/coral-door.png"),
      },
    ],
    category: "通用",
    accent: "cobalt",
    capabilities: { references: true, maxReferences: 3, aspectRatios: ["3:4", "1:1", "16:9"] },
  },
  {
    id: "classic-epic-movie-poster",
    displayName: "经典史诗电影海报",
    description: "把影片概念或参考图重绘成 1930s–1970s 手绘院线海报。",
    path: path.join(os.homedir(), ".codex/skills/classic-epic-movie-poster"),
    previewPath: path.resolve(import.meta.dirname, "../assets/previews/classic-epic-demo.png"),
    examples: [
      {
        id: "desert-epic",
        prompt: "浩瀚橙色沙海中，一位白袍旅人占据画面中心，远处人物群像与云层构成 1960 年代手绘史诗院线海报。",
        aspectRatio: "3:4",
        previewPath: path.resolve(import.meta.dirname, "../assets/previews/classic-epic-demo.png"),
      },
      {
        id: "last-train",
        prompt: "最后一班夜车穿过被洪水淹没的红色山谷，孤独列车长提着灯站在前景，经典手绘院线海报。",
        aspectRatio: "3:4",
        previewPath: path.resolve(import.meta.dirname, "../assets/examples/classic-epic-movie-poster/last-train.png"),
      },
      {
        id: "glass-orchard",
        prompt: "荒漠里一棵巨大的玻璃果树成为纪念碑，一名红围巾探险者仰望，远处双翼机留下足迹，经典手绘史诗院线海报。",
        aspectRatio: "3:4",
        previewPath: path.resolve(import.meta.dirname, "../assets/examples/classic-epic-movie-poster/glass-orchard.png"),
      },
      {
        id: "white-signal",
        prompt: "极地冰原上，一座红黑无线电塔向橙色天空发出白色同心信号，破损飞机与破冰船构成冒险叙事，经典手绘院线海报。",
        aspectRatio: "3:4",
        previewPath: path.resolve(import.meta.dirname, "../assets/examples/classic-epic-movie-poster/white-signal.png"),
      },
    ],
    category: "海报",
    accent: "ochre",
    capabilities: { references: true, maxReferences: 3, aspectRatios: ["3:4", "2:3", "9:16"] },
  },
  {
    id: "gc-minimal-zine-poster-v0-1",
    displayName: "Minimal Zine Poster",
    description: "把一句话、物件或情绪做成诗意纸张拼贴海报。",
    path: path.join(os.homedir(), ".codex/skills/gc-minimal-zine-poster-v0-1"),
    previewPath: path.resolve(import.meta.dirname, "../assets/previews/minimal-zine-demo.jpeg"),
    examples: [
      {
        id: "two-silences",
        prompt: "同一轮月，两种沉默：左侧是留有脚印的月壤，右侧是月光下的海面，做成低饱和纸张拼贴杂志海报。",
        aspectRatio: "3:4",
        previewPath: path.resolve(import.meta.dirname, "../assets/previews/minimal-zine-demo.jpeg"),
      },
      {
        id: "tidal-memory",
        prompt: "潮水退去后，石头仍记得月光。冷灰与褪色蓝的纸张拼贴，克制留白，诗意独立杂志海报。",
        aspectRatio: "3:4",
        previewPath: path.resolve(import.meta.dirname, "../assets/examples/gc-minimal-zine-poster-v0-1/tidal-memory.png"),
      },
      {
        id: "unsent-summer",
        prompt: "一封没有寄出的夏天：旧信封残片与一枝鲜亮柠檬黄小花，漂浮在大片暖象牙纸张留白中，安静的独立杂志海报。",
        aspectRatio: "3:4",
        previewPath: path.resolve(import.meta.dirname, "../assets/examples/gc-minimal-zine-poster-v0-1/unsent-summer.png"),
      },
      {
        id: "afternoon-platform",
        prompt: "下午四点的空站台：一张褪色车票、一小块饱和番茄红与模糊站台编号构成微小视觉簇，老纸张扫描质感与巨大留白。",
        aspectRatio: "3:4",
        previewPath: path.resolve(import.meta.dirname, "../assets/examples/gc-minimal-zine-poster-v0-1/afternoon-platform.png"),
      },
    ],
    category: "杂志",
    accent: "cobalt",
    capabilities: { references: true, maxReferences: 2, aspectRatios: ["3:4", "1:1", "9:16"] },
  },
  {
    id: "baoyu-infographic",
    displayName: "专业信息图",
    description: "从内容中选择合适布局与视觉风格，生成可发布的信息图。",
    path: path.join(os.homedir(), ".agents/skills/baoyu-infographic"),
    previewPath: path.resolve(import.meta.dirname, "../assets/previews/infographic-demo.png"),
    examples: [
      {
        id: "idea-to-image",
        prompt: "用少量大图形讲清从灵感火花、模块化构图到完成图像的三阶段流程，奶油纸张、钴蓝与珊瑚红。",
        aspectRatio: "3:4",
        previewPath: path.resolve(import.meta.dirname, "../assets/previews/infographic-demo.png"),
      },
      {
        id: "seed-to-city",
        prompt: "一颗种子长成树，再变成有树荫的社区；三阶段纵向信息图，清晰箭头、纸张质感、极少文字。",
        aspectRatio: "3:4",
        previewPath: path.resolve(import.meta.dirname, "../assets/examples/baoyu-infographic/seed-to-city.png"),
      },
      {
        id: "rain-garden-anatomy",
        prompt: "用一个中央剖面讲清雨水花园如何接住街道路面径流，并依次通过植物、土壤、砂层与砾石净化下渗；深蓝技术图纸风格。",
        aspectRatio: "3:4",
        previewPath: path.resolve(import.meta.dirname, "../assets/examples/baoyu-infographic/rain-garden-anatomy.png"),
      },
      {
        id: "moon-phases-cycle",
        prompt: "围绕中央地球准确排列八个月相，并以右侧太阳决定明暗方向；古典天文学图版、羊皮纸、靛蓝与古金色。",
        aspectRatio: "3:4",
        previewPath: path.resolve(import.meta.dirname, "../assets/examples/baoyu-infographic/moon-phases-cycle.png"),
      },
    ],
    category: "信息图",
    accent: "forest",
    capabilities: { references: true, maxReferences: 3, aspectRatios: ["3:4", "1:1", "16:9"] },
  },
];
