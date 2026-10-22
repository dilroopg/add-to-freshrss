/* Add to FreshRSS - options */

const DEFAULTS = {
  baseUrl: "",
  mode: "deeplink",
  user: "",
  apiPassword: "",
  category: "",
  notificationTarget: "settings"
};

const $ = (id) => document.getElementById(id);
const statusEl = $("status");

function setStatus(msg, isErr) {
  statusEl.textContent = msg;
  statusEl.className = isErr ? "err" : "ok";
  if (!isErr) setTimeout(() => { statusEl.textContent = ""; }, 4000);
}

function readForm() {
  return {
    baseUrl: $("baseUrl").value.trim().replace(/\/+$/, ""),
    mode: $("useApi").checked ? "api" : "deeplink",
    user: $("user").value.trim(),
    apiPassword: $("apiPassword").value,
    category: $("category").value.trim(),
    notificationTarget: $("notificationTarget").value === "feed" ? "feed" : "settings"
  };
}

async function load() {
  const cfg = await browser.storage.local.get(DEFAULTS);
  $("baseUrl").value = cfg.baseUrl || "";
  $("useApi").checked = cfg.mode === "api";
  $("user").value = cfg.user || "";
  $("apiPassword").value = cfg.apiPassword || "";
  $("category").value = cfg.category || "";
  $("notificationTarget").value = cfg.notificationTarget === "feed" ? "feed" : "settings";

  showGrant(cfg.baseUrl);   // "granted / not granted yet" for the stored address

  // diagnostic: what happened when the right-click menu was registered
  const st = await browser.storage.local.get({ menuState: "(nothing recorded yet)" });
  const el = $("diag");
  if (el) {
    el.textContent = "Menu status: " + st.menuState;
    el.style.color = String(st.menuState).startsWith("menu created OK") ? "#6ee7a0" : "#ffcf7a";
  }
}

/* ---------- nothing typed is ever thrown away ----------
 * This page can be closed at any moment (a permission prompt tears down a
 * popup, and switching tabs is enough), so every change goes straight to
 * storage instead of waiting for the Save button.
 */
let saveTimer = null;
function autosave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { browser.storage.local.set(readForm()); }, 150);
}
function autosaveNow() {
  clearTimeout(saveTimer);
  try { browser.storage.local.set(readForm()); } catch (e) { /* page is going away */ }
}
["baseUrl", "user", "apiPassword", "category", "notificationTarget"].forEach((id) => {
  $(id).addEventListener("input", autosave);
  $(id).addEventListener("change", autosave);
});
window.addEventListener("pagehide", autosaveNow);

/* ---------- permission ----------
 * Silent mode needs access to your FreshRSS origin.
 *
 * browser.permissions.request() must run in the SAME turn as the click: any
 * `await` before it - including a permissions.contains() "do I already have
 * it?" check - drops the user-input handler and Firefox answers
 *   "permissions.request may only be called from a user input handler".
 * So callers fire this (and the storage write) synchronously, then await both.
 */
function originFor(baseUrl) {
  try {
    return new URL(baseUrl).origin + "/*";
  } catch (e) {
    throw new Error("That doesn't look like a valid URL.");
  }
}

function ensureHostPermission(baseUrl) {
  const origin = originFor(baseUrl);                                   // sync
  const granted = browser.permissions.request({ origins: [origin] });   // this turn
  return granted.then((ok) => {
    if (!ok) throw new Error("Permission for " + origin + " was refused - silent mode needs it.");
  });
}

async function permissionGranted(baseUrl) {
  try {
    return await browser.permissions.contains({ origins: [originFor(baseUrl)] });
  } catch (e) {
    return true;   // can't tell; don't blame the permission
  }
}

/* ask as soon as silent mode is switched on, while we still have the click */
$("useApi").addEventListener("change", (e) => {
  autosave();
  const baseUrl = readForm().baseUrl;
  if (e.target.checked && baseUrl) ensureHostPermission(baseUrl).then(() => showGrant(baseUrl)).catch(() => showGrant(baseUrl));
});

/* A dedicated button whose FIRST statement is the request itself - no state
 * update, no storage write, nothing that could consume the user gesture first.
 * Everything else (Save, Test, ticking the box) also asks, but this is the one
 * place where nothing can get in the way, and it reports the outcome. */
$("grant").addEventListener("click", () => {
  const baseUrl = readForm().baseUrl;
  if (!baseUrl) { $("grantState").textContent = "Enter the address first."; $("grantState").style.color = "#ff8a8a"; return; }
  const perm = ensureHostPermission(baseUrl);                    // this same turn
  perm.then(() => showGrant(baseUrl))
      .catch((err) => {
        $("grantState").textContent = String(err && err.message ? err.message : err);
        $("grantState").style.color = "#ff8a8a";
      });
});

async function showGrant(baseUrl) {
  const el = $("grantState");
  if (!baseUrl) { el.textContent = ""; return; }
  const ok = await permissionGranted(baseUrl);
  el.textContent = ok ? "Access to " + originFor(baseUrl) + " : granted."
                      : "Access to " + originFor(baseUrl) + " : not granted yet - click the button above and choose Allow.";
  el.style.color = ok ? "#6ee7a0" : "#ffcf7a";
}

/* ---------- save ---------- */

$("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const cfg = readForm();

  if (!cfg.baseUrl) { setStatus("FreshRSS address is required.", true); return; }
  if (cfg.mode === "api" && (!cfg.user || !cfg.apiPassword)) {
    setStatus("Silent mode needs a username and API password.", true); return;
  }

  // Fire the store and the permission request in the same turn as the click,
  // then await both: awaiting the permission first used to throw away
  // everything that was typed when the request was refused or the prompt
  // closed the popup.
  const saving = browser.storage.local.set(cfg);
  const perm = cfg.mode === "api" ? ensureHostPermission(cfg.baseUrl) : Promise.resolve();

  try {
    await saving;
    await perm;
    setStatus("Saved.");
  } catch (err) {
    setStatus(String(err && err.message ? err.message : err), true);
  }
});

/* ---------- show / hide the API password ---------- */

$("pwToggle").addEventListener("click", () => {
  const input = $("apiPassword");
  const btn = $("pwToggle");
  const reveal = input.type === "password";
  input.type = reveal ? "text" : "password";
  btn.classList.toggle("revealed", reveal);
  const label = reveal ? "Hide password" : "Show password";
  btn.title = label;
  btn.setAttribute("aria-label", label);
  input.focus();
});

load();

/* ---------- test the API credentials ---------- */

$("test").addEventListener("click", async () => {
  const cfg = readForm();

  if (!cfg.baseUrl) { setStatus("Address required.", true); return; }
  if (!cfg.user || !cfg.apiPassword) { setStatus("Username and API password required.", true); return; }

  setStatus("Testing...", false);
  const saving = browser.storage.local.set(cfg);
  const perm = ensureHostPermission(cfg.baseUrl);

  try {
    await saving;
    await perm;
    const res = await fetch(cfg.baseUrl + "/api/greader.php/accounts/ClientLogin", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ Email: cfg.user, Passwd: cfg.apiPassword }).toString()
    });
    if (res.status === 401 || res.status === 403) {
      setStatus("Wrong username or API password.", true); return;
    }
    if (!res.ok) { setStatus("FreshRSS returned HTTP " + res.status, true); return; }
    const text = await res.text();
    if (/^Auth=.+/m.test(text)) {
      setStatus("Works - credentials accepted.");
    } else {
      setStatus("Reached FreshRSS but no token came back.", true);
    }
  } catch (err) {
    const msg = String(err && err.message ? err.message : err);
    if (/^Permission for |^That doesn't look like a valid URL/.test(msg)) {
      setStatus(msg, true);                                  // already specific
    } else if (/NetworkError|network request failed/i.test(msg) && !(await permissionGranted(cfg.baseUrl))) {
      setStatus("Firefox hasn't been given access to " + originFor(cfg.baseUrl) +
                " - hit Test again and choose Allow on the prompt.", true);
    } else {
      setStatus("Could not reach FreshRSS: " + msg, true);
    }
  }
});
