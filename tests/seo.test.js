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
