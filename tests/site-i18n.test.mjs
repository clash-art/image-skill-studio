import assert from "node:assert/strict";
import test from "node:test";

import { buildSitemapEntries } from "../lib/sitemap-entries.mjs";
import {
  absoluteSiteUrl,
  hasDisallowedTrailingSlash,
  localizedPath,
  metadataAlternates,
} from "../lib/site-i18n.mjs";

test("localized paths never use trailing slashes except root", () => {
  assert.equal(localizedPath("en", "/"), "/");
  assert.equal(localizedPath("zh", "/"), "/zh");
  assert.equal(localizedPath("zh", "/studio/image"), "/zh/studio/image");
  assert.equal(localizedPath("en", "/studio/image/skills"), "/studio/image/skills");
});

test("canonical alternates match localized absolute URLs without trailing slash", () => {
  const alternates = metadataAlternates("zh", "/studio/image");
  assert.equal(alternates.canonical, "https://clash.art/zh/studio/image");
  assert.equal(alternates.languages.en, "https://clash.art/studio/image");
  assert.equal(alternates.languages["zh-Hans"], "https://clash.art/zh/studio/image");
  assert.equal(hasDisallowedTrailingSlash(String(alternates.canonical)), false);
});

test("sitemap entries align canonical paths with public URLs", () => {
  const entries = buildSitemapEntries();
  assert.equal(entries.length, 38);
  for (const entry of entries) {
    assert.equal(hasDisallowedTrailingSlash(entry.url), false);
    const pathname = new URL(entry.url).pathname;
    if (pathname !== "/") {
      assert.ok(!pathname.endsWith("/"), `trailing slash in ${entry.url}`);
    }
    const locale = pathname === "/zh" || pathname.startsWith("/zh/") ? "zh" : "en";
    const sitePath =
      locale === "zh"
        ? pathname === "/zh"
          ? "/"
          : pathname.replace(/^\/zh/, "")
        : pathname;
    assert.equal(entry.url, absoluteSiteUrl(locale, sitePath));
    assert.equal(entry.alternates?.languages?.en, absoluteSiteUrl("en", sitePath));
    assert.equal(entry.alternates?.languages?.["zh-Hans"], absoluteSiteUrl("zh", sitePath));
  }
});
