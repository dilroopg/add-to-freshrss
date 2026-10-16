/* Add to FreshRSS - background
 *
 * Registers a right-click menu item on links, then either:
 *   deeplink : opens <base>/i/?c=feed&a=add&url_rss=<url>   (RSSHub Radar's method)
 *   api      : silently subscribes via FreshRSS's Google Reader API + notifies
 *
 * Uses chrome.* with callbacks (same style as the working Karakeep add-on) so
 * chrome.runtime.lastError is available. The outcome is written to
 * storage.local.menuState, which the options popup displays - so if menu
 * registration fails we see the actual reason instead of guessing.
 */

const MENU_ID = "add-to-freshrss";

const DEFAULTS = {
  baseUrl: "",
  mode: "deeplink",
  user: "",
  apiPassword: "",
  category: ""
};

function getCfg() {
  return browser.storage.local.get(DEFAULTS);
}

function trimBase(u) {
  return String(u || "").replace(/\/+$/, "");
}

function record(state) {
  try { chrome.storage.local.set({ menuState: state }); } catch (e) { /* ignore */ }
}

/* ---------- menu registration (instrumented) ---------- */

function installMenu() {
  try {
    chrome.contextMenus.removeAll();
  } catch (e) { /* nothing registered yet */ }

  try {
    chrome.contextMenus.create(
      { id: MENU_ID, title: "Add to FreshRSS", contexts: ["link", "page", "frame"] },
      () => {
        const err = chrome.runtime.lastError;
        record(err ? "ERROR: " + err.message
                   : "menu created OK at " + new Date().toISOString());
      }
    );
  } catch (e) {
    record("THREW: " + (e && e.message ? e.message : String(e)));
  }
}

installMenu();
chrome.runtime.onInstalled.addListener(installMenu);
chrome.runtime.onStartup.addListener(installMenu);

/* Toolbar button now opens the paste-and-add popup (popup.html, declared as
 * action.default_popup in the manifest), so this listener only serves as the
 * fallback for if the popup is ever removed from the manifest. Preferences
 * live behind the Settings button inside the popup, and stay in a real TAB
 * because a popup is torn down by permission prompts. */
chrome.action.onClicked.addListener(() => {
  browser.runtime.openOptionsPage();
});

/* ---------- add from the popup ----------
 * The popup delegates here because a popup can be closed at any moment (loss
 * of focus, a permission prompt), which would abandon an in-flight await.
 * This background page outlives it, so the add always completes.
 */
browser.runtime.onMessage.addListener(async (msg) => {
  if (!msg || msg.type !== "add-urls") return;

  const urls = Array.isArray(msg.urls) ? msg.urls.filter(Boolean) : [];
  if (!urls.length) return { ok: false, error: "No links given." };

  const cfg = await getCfg();

  if (!trimBase(cfg.baseUrl)) {
    return { ok: false, error: "Open Settings and set your FreshRSS address." };
  }

  const useApi = cfg.mode === "api" && cfg.user && cfg.apiPassword;

  // deeplink mode: open FreshRSS's own pre-filled add page, one per link, in
  // background tabs he never asked to be pulled away from.
  if (!useApi) {
    for (const url of urls) {
      await openDeepLink(cfg, url);
    }
    return { ok: true, opened: true, added: 0, failed: [] };
  }

  let added = 0;
  const failed = [];
  for (const url of urls) {
    try {
      await addViaApi(cfg, url);
      added++;
    } catch (e) {
      failed.push({ url, error: String(e && e.message ? e.message : e) });
    }
  }

  if (added) {
    notify(added === 1 ? "Added to FreshRSS" : "Added " + added + " feeds to FreshRSS",
           failed.length ? failed.length + " failed." : (urls.length === 1 ? urls[0] : ""));
  } else if (failed.length) {
    notify("FreshRSS add failed", failed[0].error);
  }

  return { ok: true, opened: false, added, failed };
});

/* ---------- deeplink (Radar's method) ---------- */

function openDeepLink(cfg, url) {
  // background tab: subscribing shouldn't pull you off what you're reading
  return browser.tabs.create({
    url: trimBase(cfg.baseUrl) + "/i/?c=feed&a=add&url_rss=" + encodeURIComponent(url),
    active: false
  });
}

/* ---------- silent API add ---------- */

/* ClientLogin answers with:
 *     SID=<user>/<sha1(salt+user+apiPasswordHash)>
 *     LSID=null
 *     Auth=<user>/<sha1(...)>          <- same value
 * That "user/sha1" string is the argument of the Authorization header, NOT a T
 * token: FreshRSS's greader.php authenticates a call in authorizationToUser(),
 * which does explode('/', $headerAuth, 2) -> [user, sha1]. Sending it as the T
 * POST param (and no header) leaves the request with no user at all, so the
 * endpoint calls unauthorized() before it ever compares a token.
 */
async function login(cfg) {
  const res = await fetch(trimBase(cfg.baseUrl) + "/api/greader.php/accounts/ClientLogin", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ Email: cfg.user, Passwd: cfg.apiPassword }).toString()
  });
  if (!res.ok) throw new Error("login HTTP " + res.status);
  const text = await res.text();
  const m = text.match(/^Auth=(.+)$/m);
  if (!m) throw new Error("no Auth token returned");
  return m[1].trim();     // "<user>/<sha1>"
}

async function addViaApi(cfg, feedUrl) {
  const auth = await login(cfg);
  const params = new URLSearchParams({ ac: "subscribe", s: "feed/" + feedUrl });
  if (cfg.category) params.append("a", "user/-/label/" + cfg.category);

  const res = await fetch(trimBase(cfg.baseUrl) + "/api/greader.php/reader/api/0/subscription/edit", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": "GoogleLogin auth=" + auth
    },
    body: params.toString()
  });
  const text = await res.text();
  if (!res.ok) throw new Error("subscribe HTTP " + res.status);
  if (!/(^|\n)OK(\n|$)/.test(text)) throw new Error("FreshRSS said: " + (text.trim().slice(0, 80) || "(empty)"));
  return true;
}

function notify(title, message) {
  try {
    browser.notifications.create({
      type: "basic",
      iconUrl: browser.runtime.getURL("icons/icon-96.png"),
      title: title,
      message: message
    });
  } catch (e) { /* best effort */ }
}

/* ---------- click handling ---------- */

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  record("clicked: " + (info.menuItemId || "?"));
  if (info.menuItemId !== MENU_ID) return;

  /* Link click -> the link target. Page/frame click -> the tab's own URL, which
   * covers the feed-page case: the XML page IS the feed, so there is no link to
   * right-click and info.linkUrl is null. info.frameUrl is the more precise value
   * when the click was inside an iframe, so prefer it, then the tab, then the frame. */
  const url = info.linkUrl || info.frameUrl || (tab && tab.url) || "";
  if (!url) return;

  const cfg = await getCfg();

  if (!trimBase(cfg.baseUrl)) {
    notify("FreshRSS address not set",
           "Right-click settings: open the extension's preferences and enter your FreshRSS URL.");
    try { browser.runtime.openOptionsPage(); } catch (e) { /* ignore */ }
    return;
  }

  const useApi = cfg.mode === "api" && cfg.user && cfg.apiPassword;

  if (!useApi) {
    await openDeepLink(cfg, url);
    return;
  }

  try {
    await addViaApi(cfg, url);
    notify("Added to FreshRSS", url);
  } catch (e) {
    notify("FreshRSS add failed", String(e && e.message ? e.message : e));
  }
});
