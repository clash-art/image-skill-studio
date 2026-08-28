import path from "node:path";

import sharp from "sharp";

const projectRoot = path.resolve(import.meta.dirname, "..");
const output = path.resolve(process.argv[2] || "/tmp/image-skill-studio-og.png");
const sources = [
  "public/previews/minimal-zine-demo.jpeg",
  "public/previews/imagegen-demo.png",
  "public/previews/classic-epic-demo.png",
].map((file) => path.join(projectRoot, file));

async function card(source, width, height) {
  const mask = Buffer.from(
    `<svg width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="30" fill="white"/></svg>`,
  );
  return sharp(source)
    .resize(width, height, { fit: "cover", position: "attention" })
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
}

const cards = await Promise.all(sources.map((source) => card(source, 250, 480)));
const background = Buffer.from(`
  <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="glow" cx="18%" cy="0%" r="95%">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="58%" stop-color="#f5f0e7"/>
        <stop offset="100%" stop-color="#e7dfd1"/>
      </radialGradient>
      <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="20" stdDeviation="24" flood-color="#403a31" flood-opacity=".22"/>
      </filter>
    </defs>
    <rect width="1200" height="630" fill="url(#glow)"/>
    <circle cx="104" cy="90" r="24" fill="#62b2fe"/>
    <path d="M92 90l9 9 17-20" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="148" y="100" fill="#222421" font-family="Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="3">CLASH.ART / STUDIO / IMAGE</text>
    <text x="74" y="235" fill="#202220" font-family="Georgia, serif" font-size="82" font-weight="700">Image Skill</text>
    <text x="74" y="320" fill="#202220" font-family="Georgia, serif" font-size="82" font-weight="700">Studio</text>
    <text x="78" y="382" fill="#666861" font-family="PingFang SC, Arial, sans-serif" font-size="28">发现可复用的图像创作方法</text>
    <rect x="76" y="445" width="128" height="44" rx="22" fill="#202220"/>
    <text x="100" y="475" fill="#fff" font-family="Arial, sans-serif" font-size="18" font-weight="700">POSTER</text>
    <rect x="218" y="445" width="146" height="44" rx="22" fill="#fff" stroke="#d4cdc1"/>
    <text x="246" y="475" fill="#202220" font-family="Arial, sans-serif" font-size="18" font-weight="700">COLLAGE</text>
    <rect x="378" y="445" width="156" height="44" rx="22" fill="#fff" stroke="#d4cdc1"/>
    <text x="407" y="475" fill="#202220" font-family="Arial, sans-serif" font-size="18" font-weight="700">IMAGE→IMAGE</text>
    <g filter="url(#shadow)">
      <rect x="650" y="75" width="250" height="480" rx="30" fill="#fff"/>
      <rect x="790" y="75" width="250" height="480" rx="30" fill="#fff"/>
      <rect x="930" y="75" width="250" height="480" rx="30" fill="#fff"/>
    </g>
  </svg>
`);

await sharp(background)
  .composite([
    { input: cards[0], left: 650, top: 75 },
    { input: cards[1], left: 790, top: 75 },
    { input: cards[2], left: 930, top: 75 },
  ])
  .png({ compressionLevel: 9 })
  .toFile(output);

console.log(output);
