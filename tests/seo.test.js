"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function structuredData(html) {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((match) => JSON.parse(match[1]));
}

test("homepage exposes complete indexable metadata and app schema", () => {
  const html = read("index.html");
  assert.match(html, /<title>Fitness Accountability App for Two \| Fitandem<\/title>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/fitandem\.com\/">/);
  assert.match(html, /name="robots" content="index, follow,/);
  assert.match(html, /<link rel="manifest" href="site\.webmanifest">/);

  const graph = structuredData(html)[0]["@graph"];
  const application = graph.find((item) => Array.isArray(item["@type"]) && item["@type"].includes("SoftwareApplication"));
  assert.ok(application, "SoftwareApplication schema is present");
  assert.equal(application.offers.price, "0");
  assert.equal(application.offers.priceCurrency, "GBP");
  assert.ok(graph.some((item) => item["@type"] === "WebSite"), "WebSite schema is present");
  assert.ok(graph.some((item) => item["@type"] === "Organization"), "Organization schema is present");
});

test("indexable secondary pages use their final trailing-slash canonicals", () => {
  for (const page of ["privacy", "delete-account"]) {
    const html = read(`${page}/index.html`);
    assert.match(html, new RegExp(`<link rel="canonical" href="https://fitandem\\.com/${page}/">`));
    assert.match(html, /name="robots" content="index, follow,/);
    assert.ok(structuredData(html).length > 0, `${page} has structured data`);
  }
});

test("sitemap, robots and manifest are internally consistent", () => {
  const sitemap = read("sitemap.xml");
  const robots = read("robots.txt");
  const manifest = JSON.parse(read("site.webmanifest"));

  assert.match(robots, /Sitemap: https:\/\/fitandem\.com\/sitemap\.xml/);
  assert.match(sitemap, /<loc>https:\/\/fitandem\.com\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/fitandem\.com\/privacy\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/fitandem\.com\/delete-account\/<\/loc>/);
  assert.doesNotMatch(sitemap, /\/invite\//);
  assert.doesNotMatch(sitemap, /\/android\//);
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.lang, "en-GB");
});

const landingPages = ["fitness-accountability-app", "workout-partner-app", "shared-fitness-streaks"];

test("SEO landing pages exist, are indexable and carry complete metadata", () => {
  const sitemap = read("sitemap.xml");
  const seenTitles = new Map();
  const seenDescriptions = new Map();

  for (const page of landingPages) {
    const filePath = `${page}/index.html`;
    assert.ok(fs.existsSync(path.join(root, filePath)), `${filePath} exists`);
    const html = read(filePath);
    const canonicalUrl = `https://fitandem.com/${page}/`;

    const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [])[1];
    assert.ok(title && title.trim().length > 0, `${page} has a non-empty <title>`);
    assert.ok(!seenTitles.has(title), `${page} title is unique (also used by ${seenTitles.get(title)})`);
    seenTitles.set(title, page);

    const description = (html.match(/name="description" content="([^"]*)"/) || [])[1];
    assert.ok(description && description.trim().length > 0, `${page} has a non-empty meta description`);
    assert.ok(!seenDescriptions.has(description), `${page} description is unique (also used by ${seenDescriptions.get(description)})`);
    seenDescriptions.set(description, page);

    assert.match(html, /name="robots" content="index, follow,/, `${page} allows indexing`);
    assert.doesNotMatch(html, /name="robots" content="noindex/, `${page} is not noindexed`);

    assert.match(
      html,
      new RegExp(`<link rel="canonical" href="${canonicalUrl.replace(/\//g, "\\/")}">`),
      `${page} canonical points to ${canonicalUrl}`
    );

    const h1Matches = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)];
    assert.equal(h1Matches.length, 1, `${page} has exactly one H1`);
    assert.ok(h1Matches[0][1].replace(/<[^>]+>/g, "").trim().length > 0, `${page} H1 is non-empty`);

    const graphs = structuredData(html);
    assert.ok(graphs.length > 0, `${page} has JSON-LD`);
    for (const graph of graphs) {
      assert.ok(Array.isArray(graph["@graph"]), `${page} JSON-LD has a @graph array`);
    }

    assert.match(html, /href="https:\/\/fitandem\.com\/android"/, `${page} has an Android download CTA`);

    const localAssetRefs = [...html.matchAll(/(?:src|href)="(\.\.\/[^"]+)"/g)].map((m) => m[1]);
    assert.ok(localAssetRefs.length > 0, `${page} references local assets`);
    for (const ref of localAssetRefs) {
      const cleanRef = ref.split("?")[0].split("#")[0];
      const resolved = path.join(root, page, cleanRef);
      assert.ok(fs.existsSync(resolved), `${page} asset reference resolves: ${ref}`);
    }

    assert.match(sitemap, new RegExp(`<loc>${canonicalUrl.replace(/\//g, "\\/")}</loc>`), `${page} is listed in sitemap.xml`);
  }
});

const blogPages = [
  "blog",
  "blog/how-to-stay-accountable-with-a-workout-partner",
  "blog/why-10-minutes-of-movement-still-counts",
  "blog/how-shared-fitness-streaks-help-you-stay-consistent"
];

test("blog pages have distinct indexable metadata, valid schema and working local links", () => {
  const sitemap = read("sitemap.xml");
  const titles = new Set();
  const descriptions = new Set();

  for (const page of blogPages) {
    const file = `${page}/index.html`;
    assert.ok(fs.existsSync(path.join(root, file)), `${file} exists`);
    const html = read(file);
    const url = `https://fitandem.com/${page}/`;
    const title = (html.match(/<title>([^<]+)<\/title>/) || [])[1];
    const description = (html.match(/<meta name="description" content="([^"]+)"/) || [])[1];

    assert.ok(title && !titles.has(title), `${page} has a unique title`);
    assert.ok(description && !descriptions.has(description), `${page} has a unique description`);
    titles.add(title);
    descriptions.add(description);
    assert.match(html, /<html lang="en-GB">/);
    assert.match(html, /name="robots" content="index, follow,/);
    assert.ok(html.includes(`<link rel="canonical" href="${url}">`), `${page} canonical is correct`);
    assert.ok(html.includes(`<meta property="og:url" content="${url}">`), `${page} OG URL is correct`);
    assert.match(html, /<meta name="twitter:card" content="summary_large_image">/);
    assert.equal([...html.matchAll(/<h1\b/g)].length, 1, `${page} has one H1`);
    assert.doesNotMatch(html, /—/, `${page} avoids em dashes`);

    const data = structuredData(html);
    assert.equal(data.length, 1, `${page} has one JSON-LD script`);
    const graph = data[0]["@graph"];
    assert.ok(Array.isArray(graph), `${page} schema graph parses`);
    assert.ok(graph.some((entry) => entry["@type"] === (page === "blog" ? "Blog" : "BlogPosting")), `${page} has the right schema type`);
    if (page !== "blog") {
      const article = graph.find((entry) => entry["@type"] === "BlogPosting");
      assert.equal(article.mainEntityOfPage["@id"], url);
      assert.equal(article.inLanguage, "en-GB");
      assert.ok(graph.some((entry) => entry["@type"] === "BreadcrumbList"), `${page} has breadcrumb schema`);
    }

    const references = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((match) => match[1]);
    for (const ref of references) {
      if (ref.startsWith("#") || ref.startsWith("mailto:") || /^https?:\/\//.test(ref)) continue;
      const clean = ref.split(/[?#]/)[0];
      const resolved = clean.startsWith("/") ? path.join(root, clean) : path.resolve(root, page, clean);
      const target = clean.endsWith("/") || !path.extname(clean) ? path.join(resolved, "index.html") : resolved;
      assert.ok(fs.existsSync(target), `${page} local reference resolves: ${ref}`);
    }

    assert.match(sitemap, new RegExp(`<loc>${url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</loc>\\s*<lastmod>2026-09-23</lastmod>`), `${page} appears in sitemap with launch date`);
  }
});
