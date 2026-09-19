"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "invite.js"), "utf8");
const token = "A".repeat(43);

function loadInvitePage(pathname, search) {
  const elements = {
    "invite-title": {textContent: ""},
    "invite-message": {textContent: ""},
    "invite-play-link": {href: "", hidden: false},
    "invite-fallback-link": {href: ""},
  };
  const fallback = {innerHTML: ""};
  const privacy = {hidden: false};
  const document = {
    getElementById(id) {
      return elements[id];
    },
    querySelector(selector) {
      if (selector === ".invite-fallback") return fallback;
      if (selector === ".invite-privacy") return privacy;
      throw new Error(`Unexpected selector: ${selector}`);
    },
  };
  vm.runInNewContext(source, {
    document,
    URL,
    URLSearchParams,
    window: {location: {pathname, search}},
  });
  return {elements, fallback, privacy};
}

const valid = loadInvitePage("/invite/", `?token=${token}`);
const playUrl = new URL(valid.elements["invite-play-link"].href);
assert.equal(playUrl.origin, "https://play.google.com");
assert.equal(playUrl.searchParams.get("id"), "uk.co.dkhiggins.fitandem");
assert.equal(new URLSearchParams(playUrl.searchParams.get("referrer")).get("token"), token);
assert.equal(valid.elements["invite-play-link"].hidden, false);

for (const [pathname, search] of [
  ["/invite/", ""],
  ["/invite/", "?token=short"],
  ["/invite/", `?token=${token}&token=${token}`],
  [`/invite/${token}`, ""],
]) {
  const invalid = loadInvitePage(pathname, search);
  assert.equal(invalid.elements["invite-play-link"].hidden, true);
  assert.match(invalid.elements["invite-title"].textContent, /not valid/i);
}

const notFound = fs.readFileSync(path.join(__dirname, "..", "404.html"), "utf8");
assert.doesNotMatch(notFound, /invite\.js/);
assert.match(notFound, /Page not found/);

console.log("PASS invite landing query, Play referrer and normal 404 behavior");
