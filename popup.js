/* Add to FreshRSS - popup
 *
 * Paste a link (or several, one per line) and add them without leaving the
 * page. The actual adding is delegated to the background page via a message:
 * a popup is torn down the moment it loses focus or a permission prompt
 * appears, so any await inside the popup can silently never finish. The
 * background survives, so the add completes even if this window has closed.
 */

const $ = (id) => document.getElementById(id);
const statusEl = $("status");

function setStatus(msg, isErr) {
  statusEl.textContent = msg;
  statusEl.className = isErr ? "err" : "ok";
}

/* one per line, ignore blanks; trim and drop duplicates while keeping order */
function parseUrls(text) {
  const seen = new Set();
  const out = [];
  for (const raw of String(text || "").split(/\r?\n/)) {
    const u = raw.trim();
    if (!u || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

/* ---------- add ---------- */

async function add() {
  const urls = parseUrls($("urls").value);

  if (!urls.length) {
    setStatus("Paste a link first.", true);
    return;
  }

  // Check the address here too, not only in the background: the footer already
  // knows whether one is set, so asking the background just to be told "no
  // address" is a wasted round trip and a worse message.
  const cfg = await browser.storage.local.get({ baseUrl: "" });
  if (!String(cfg.baseUrl || "").replace(/\/+$/, "")) {
    setStatus("Open Settings and set your FreshRSS address.", true);
    return;
  }

  $("add").disabled = true;
  setStatus(urls.length === 1 ? "Adding..." : "Adding " + urls.length + "...", false);

  try {
    const res = await browser.runtime.sendMessage({ type: "add-urls", urls });

    if (!res || !res.ok) {
      setStatus((res && res.error) || "Could not add - open Settings.", true);
      $("add").disabled = false;
      return;
    }

    if (res.opened) {
      // deeplink mode: FreshRSS's own add page is opening in a background tab
      setStatus(urls.length === 1 ? "Opened FreshRSS in a background tab."
                                  : "Opened " + urls.length + " in background tabs.",
                false);
    } else if (res.failed && res.failed.length) {
      setStatus("Added " + res.added + ", failed " + res.failed.length + ".", true);
    } else {
      setStatus("Added " + res.added + ".", false);
    }

    $("urls").value = "";
    setTimeout(() => window.close(), 900);
  } catch (err) {
    setStatus(String(err && err.message ? err.message : err), true);
    $("add").disabled = false;
  }
}

$("add").addEventListener("click", add);

/* Ctrl/Cmd+Enter adds, so a pasted list does not need the mouse */
$("urls").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    add();
  }
});

/* ---------- settings ---------- */

$("settings").addEventListener("click", () => {
  browser.runtime.openOptionsPage();
  window.close();
});

/* ---------- footer: which mode is active, and is it ready ---------- */

(async () => {
  const cfg = await browser.storage.local.get({ baseUrl: "", mode: "deeplink", user: "", apiPassword: "" });

  const hasAddress = String(cfg.baseUrl || "").replace(/\/+$/, "") !== "";
  const silent = cfg.mode === "api" && cfg.user && cfg.apiPassword;

  if (!hasAddress) {
    $("mode").textContent = "No address set";
    setStatus("Open Settings and set your FreshRSS address.", true);
    $("add").disabled = true;
    return;
  }

  $("mode").textContent = silent ? "Silent (API)" : "Opens a background tab";
  $("urls").focus();
})();
