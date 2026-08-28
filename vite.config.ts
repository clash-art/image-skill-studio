import { createReadStream, stat } from "node:fs";
import { extname, resolve, sep } from "node:path";

import { cloudflare } from "@cloudflare/vite-plugin";
import vinext from "vinext";
import { defineConfig } from "vite";

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const catalogAssetRoot = resolve(process.cwd(), "assets");
const catalogAssetPrefix = "/studio-assets/";
const assetContentTypes: Record<string, string> = {
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

function studioCatalogAssets() {
  const serve = (req: { method?: string; url?: string }, res: { statusCode: number; setHeader(name: string, value: string): void; end(body?: string): void }, next: () => void) => {
    const requestUrl = new URL(req.url || "/", "http://localhost");
    if (!requestUrl.pathname.startsWith(catalogAssetPrefix)) return next();

    const relativePath = decodeURIComponent(requestUrl.pathname.slice(catalogAssetPrefix.length));
    const filePath = resolve(catalogAssetRoot, relativePath);
    if (!filePath.startsWith(`${catalogAssetRoot}${sep}`)) {
      res.statusCode = 403;
      res.end("Forbidden");
      return;
    }

    stat(filePath, (error, info) => {
      if (error || !info.isFile()) {
        res.statusCode = 404;
        res.end("Not found");
        return;
      }
      res.setHeader("Content-Type", assetContentTypes[extname(filePath).toLowerCase()] || "application/octet-stream");
      res.setHeader("Cache-Control", "no-store");
      if (req.method === "HEAD") {
        res.end();
        return;
      }
      createReadStream(filePath).pipe(res as NodeJS.WritableStream);
    });
  };

  return {
    name: "image-skill-studio-catalog-assets",
    configureServer(server: { middlewares: { use(handler: typeof serve): void } }) {
      server.middlewares.use(serve);
    },
    configurePreviewServer(server: { middlewares: { use(handler: typeof serve): void } }) {
      server.middlewares.use(serve);
    },
  };
}

export default defineConfig(() => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  return {
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: [
      studioCatalogAssets(),
      vinext(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
      }),
    ],
  };
});
