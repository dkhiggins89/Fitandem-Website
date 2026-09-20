import { firebaseConfig, ownerEmail } from "./config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

const $ = (selector) => document.querySelector(selector);
const authPanel = $("#auth-panel");
const deniedPanel = $("#denied-panel");
const dashboard = $("#dashboard");
const authMessage = $("#auth-message");
const emailConfigured = ownerEmail && ownerEmail !== "owner@example.com";
const configReady = Object.values(firebaseConfig).every((value) => value && !value.startsWith("PASTE_"));

function showSignedOut(message = "") {
  authPanel.hidden = false;
  deniedPanel.hidden = true;
  dashboard.hidden = true;
  $("#user-bar").hidden = true;
  authMessage.textContent = message;
}

if (!configReady || !emailConfigured) {
  showSignedOut("Firebase setup is needed before sign-in. Add the web config and owner email in hq/config.js.");
  $("#sign-in").disabled = true;
} else {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  function updateAuthState(user) {
    if (!user) {
      showSignedOut();
      return;
    }
    if ((user.email || "").toLowerCase() !== ownerEmail.trim().toLowerCase()) {
      authPanel.hidden = true;
      dashboard.hidden = true;
      deniedPanel.hidden = false;
      $("#user-bar").hidden = true;
      $("#denied-email").textContent = `Signed in as ${user.email || "an account without an email address"}. Sign in with the configured owner account to continue.`;
      return;
    }
    authPanel.hidden = true;
    deniedPanel.hidden = true;
    dashboard.hidden = false;
    $("#user-bar").hidden = false;
    $("#user-email").textContent = user.email;
    renderDashboard();
  }

  $("#sign-in").addEventListener("click", async () => {
    authMessage.textContent = "Opening Google sign-in…";
    try {
      const credential = await signInWithPopup(auth, provider);
      updateAuthState(credential.user);
    } catch (error) {
      authMessage.textContent = error.message || "Google sign-in could not start. Please try again.";
    }
  });

  $("#sign-out").addEventListener("click", () => signOut(auth));
  $("#switch-account").addEventListener("click", async () => {
    await signOut(auth);
    showSignedOut();
  });

  onAuthStateChanged(auth, updateAuthState);
}

const tasks = [
  "Check social performance",
  "Check Play acquisitions",
  "Test smart Tandem invite flow",
  "Review 0.3.2 QA",
  "Creator outreach",
  "Prepare next short-form video"
];
const metrics = ["Users", "Tandem pairs", "Duo subscribers", "Play installs", "7-day active users"];
const initialContent = [
  { title: "Social 002", status: "Scheduled" },
  { title: "Social 003", status: "Idea" },
  { title: "7-Day Tandem Challenge", status: "Planned" }
];
const statuses = ["Idea", "Planned", "In progress", "Scheduled", "Published"];
const storageKey = "fitandem-hq-v1";

function readData() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || {};
  } catch {
    return {};
  }
}

function writeData(data) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(data));
  } catch {
    // The dashboard remains usable if this browser blocks local storage.
  }
}

function renderDashboard() {
  const data = readData();
  const completed = data.tasks || {};
  const checklist = $("#checklist");
  checklist.replaceChildren();
  tasks.forEach((task, index) => {
    const label = document.createElement("label");
    label.className = "task-row";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(completed[index]);
    checkbox.addEventListener("change", () => {
      const latest = readData();
      latest.tasks = { ...(latest.tasks || {}), [index]: checkbox.checked };
      writeData(latest);
      label.classList.toggle("is-done", checkbox.checked);
      updateTaskCount();
    });
    const text = document.createElement("span");
    text.textContent = task;
    label.classList.toggle("is-done", checkbox.checked);
    label.append(checkbox, text);
    checklist.append(label);
  });

  const growth = $("#growth-fields");
  growth.replaceChildren();
  metrics.forEach((metric, index) => {
    const label = document.createElement("label");
    label.className = "metric-field";
    const caption = document.createElement("span");
    caption.textContent = metric;
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.step = "1";
    input.inputMode = "numeric";
    input.value = data.metrics?.[index] ?? 0;
    input.setAttribute("aria-label", metric);
    input.addEventListener("input", () => {
      const latest = readData();
      const values = [...(latest.metrics || Array(5).fill(0))];
      values[index] = input.value === "" ? "" : Math.max(0, Number(input.value));
      latest.metrics = values;
      writeData(latest);
    });
    label.append(caption, input);
    growth.append(label);
  });

  const content = data.content || initialContent;
  const contentCards = $("#content-cards");
  contentCards.replaceChildren();
  content.forEach((item, index) => {
    const card = document.createElement("article");
    card.className = "content-card";
    const name = document.createElement("input");
    name.className = "content-name";
    name.value = item.title;
    name.setAttribute("aria-label", `Content card ${index + 1} title`);
    name.addEventListener("input", () => updateContent(index, { title: name.value }));
    const select = document.createElement("select");
    select.setAttribute("aria-label", `Status for ${item.title}`);
    statuses.forEach((status) => {
      const option = document.createElement("option");
      option.value = status;
      option.textContent = status;
      option.selected = item.status === status;
      select.append(option);
    });
    select.addEventListener("change", () => updateContent(index, { status: select.value }));
    card.append(name, select);
    contentCards.append(card);
  });

  function updateContent(index, patch) {
    const latest = readData();
    const items = latest.content || initialContent.map((item) => ({ ...item }));
    items[index] = { ...items[index], ...patch };
    latest.content = items;
    writeData(latest);
  }

  function updateTaskCount() {
    const done = checklist.querySelectorAll("input:checked").length;
    $("#task-count").textContent = `${done} / ${tasks.length}`;
  }
  updateTaskCount();

  const now = new Date();
  $("#today-date").textContent = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(now);
}

document.querySelectorAll(".copy-card").forEach((button) => {
  button.addEventListener("click", async () => {
    const message = $("#copy-message");
    try {
      await navigator.clipboard.writeText(button.dataset.copy);
      message.textContent = "Copied to clipboard.";
      button.classList.add("copied");
      button.querySelector("b").textContent = "Copied ✓";
      window.setTimeout(() => {
        button.classList.remove("copied");
        button.querySelector("b").textContent = "Copy";
      }, 1600);
    } catch {
      message.textContent = "Clipboard access is unavailable in this browser.";
    }
  });
});
