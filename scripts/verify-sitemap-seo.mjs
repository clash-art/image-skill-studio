#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";

const baseUrl = (process.argv[2] || "http://127.0.0.1:4173").replace(/\/$/, "");

async function fetchText(path) {
  const response = await fetch(`${baseUrl}${path}`);
  return { response, text: await response.text() };
}

function extractCanonical(html) {
  const match = html.match(/rel="canonical" href="([^"]+)"/i);
  return match?.[1] ?? "";
}

async function main() {
  const { response: sitemapResponse, text: sitemapXml } = await fetchText("/sitemap.xml");
  assert.equal(sitemapResponse.status, 200, "sitemap must return 200");
  const urls = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.ok(urls.length > 0, "sitemap must list URLs");

  const failures = [];
  for (const url of urls) {
    const pathname = new URL(url).pathname;
    const localPath = pathname || "/";
    const { response, text } = await fetchText(localPath);
    const canonical = extractCanonical(text);
    const row = { url, status: response.status, canonical };
    if (response.status !== 200) failures.push({ ...row, reason: "non-200 status" });
    else if (pathname.length > 1 && pathname.endsWith("/")) failures.push({ ...row, reason: "path uses trailing slash" });
    else if (canonical !== url) failures.push({ ...row, reason: "canonical mismatch" });
    else process.stdout.write(`OK ${response.status} ${url} canonical=${canonical}\n`);
  }

  if (failures.length) {
    console.error("\nSitemap SEO verification failed:\n", JSON.stringify(failures, null, 2));
    process.exit(1);
  }
}

const invokedDirectly = process.argv[1]?.endsWith("verify-sitemap-seo.mjs");
if (invokedDirectly) {
  const autoStart = process.env.VERIFY_SITEMAP_AUTOSTART === "1";
  if (autoStart) {
    const server = spawn("npm", ["run", "start"], { stdio: "inherit", env: process.env });
    await new Promise((resolve) => setTimeout(resolve, 8000));
    try {
      await main();
    } finally {
      server.kill("SIGTERM");
      await once(server, "exit");
    }
  } else {
    await main();
  }
}

export { main as verifySitemapSeo };
