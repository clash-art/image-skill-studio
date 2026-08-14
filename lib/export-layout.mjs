export const EXPORT_WIDTH = 1080;
export const EXPORT_HEIGHT = 1440;

const layouts = {
  reference_to_result: {
    canvas: { width: EXPORT_WIDTH, height: EXPORT_HEIGHT },
    title: { x: 72, y: 72, width: 936, height: 88 },
    reference: { x: 72, y: 184, width: 936, height: 480 },
    result: { x: 72, y: 792, width: 936, height: 480 },
    footer: { x: 72, y: 1320, width: 936, height: 48 },
  },
  prompt_to_result: {
    canvas: { width: EXPORT_WIDTH, height: EXPORT_HEIGHT },
    title: { x: 72, y: 72, width: 936, height: 88 },
    prompt: { x: 72, y: 184, width: 936, height: 360 },
    result: { x: 72, y: 596, width: 936, height: 676 },
    footer: { x: 72, y: 1320, width: 936, height: 48 },
  },
};

export function getExportLayout(template) {
  if (!layouts[template]) throw new Error(`Unknown export template: ${template}`);
  return structuredClone(layouts[template]);
}

export function containRect(sourceWidth, sourceHeight, target) {
  if (sourceWidth <= 0 || sourceHeight <= 0) throw new Error("Source dimensions must be positive");
  const scale = Math.min(target.width / sourceWidth, target.height / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return {
    x: target.x + (target.width - width) / 2,
    y: target.y + (target.height - height) / 2,
    width,
    height,
  };
}

export function wrapPrompt(prompt, { maxCharsPerLine = 18, maxLinesPerPage = 8 } = {}) {
  const characters = Array.from(String(prompt));
  const lines = [];
  for (let index = 0; index < characters.length; index += maxCharsPerLine) {
    lines.push(characters.slice(index, index + maxCharsPerLine).join(""));
  }
  const pages = [];
  for (let index = 0; index < lines.length; index += maxLinesPerPage) {
    pages.push(lines.slice(index, index + maxLinesPerPage));
  }
  return pages.length ? pages : [[""]];
}

export function buildExportFilename(skillName, runId, template, sequence = 1) {
  const safeSkill = String(skillName)
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "image-skill";
  const shortRun = String(runId).replace(/^run-/, "").slice(0, 3) || "run";
  const templateName = template === "reference_to_result" ? "reference-result" : "prompt-result";
  return `${safeSkill}_${shortRun}_${templateName}_${String(sequence).padStart(2, "0")}.png`;
}
