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
const NOTIFICATION_LINK_KEY = "notificationLinks";

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
  const addedIds = [];
  for (const url of urls) {
    try {
      const feedId = await addViaApi(cfg, url);
      added++;
      if (feedId) addedIds.push(feedId);
    } catch (e) {
      failed.push({ url, error: String(e && e.message ? e.message : e) });
    }
  }

  if (added) {
    // One feed added -> the notification opens that feed's settings page.
    // Several -> no single settings page to point at, so no link.
    const link = urls.length === 1 && addedIds.length === 1
      ? feedSettingsUrl(cfg, addedIds[0]) : "";
    await notify(added === 1 ? "Added to FreshRSS" : "Added " + added + " feeds to FreshRSS",
                 failed.length ? failed.length + " failed." : (urls.length === 1 ? urls[0] : ""),
                 link);
  } else if (failed.length) {
    await notify("FreshRSS add failed", failed[0].error);
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

/* FreshRSS's own "feed added" redirect is c=subscription&a=feed&id=N
 * (subscriptionController::feedAction), so that is the settings route. */
function feedSettingsUrl(cfg, feedId) {
  return trimBase(cfg.baseUrl) + "/i/?c=subscription&a=feed&id=" + encodeURIComponent(feedId);
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

async function listSubscriptions(cfg, auth) {
  const res = await fetch(trimBase(cfg.baseUrl) + "/api/greader.php/reader/api/0/subscription/list?output=json", {
    headers: { "Authorization": "GoogleLogin auth=" + auth }
  });
  if (!res.ok) throw new Error("subscription list HTTP " + res.status);
  const data = await res.json();
  return Array.isArray(data.subscriptions) ? data.subscriptions : [];
}

function sameFeedUrl(a, b) {
  if (!a || !b) return false;
  try {
    const strip = (raw) => {
      const u = new URL(raw);
      return u.origin + u.pathname.replace(/\/+$/, "");
    };
    return strip(a) === strip(b);
  } catch (e) {
    return a === b;
  }
}

/* Subscribes silently and returns the new feed's numeric id, or null.
 * The id is only needed to link the notification to the feed's settings page,
 * so a failed lookup returns null instead of throwing: the feed WAS added and
 * must not be reported as a failure. The id is found by diffing the
 * subscription list around the subscribe call, which survives FreshRSS
 * rewriting the URL (301) to a canonical one; a URL match is the fallback. */
async function addViaApi(cfg, feedUrl) {
  const auth = await login(cfg);

  let before = null;
  try { before = await listSubscriptions(cfg, auth); } catch (e) { /* best effort */ }

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

  try {
    const after = await listSubscriptions(cfg, auth);
    let id = "";
    if (before) {
      const known = new Set(before.map((sub) => sub.id));
      const fresh = after.filter((sub) => !known.has(sub.id));
      if (fresh.length === 1) id = fresh[0].id;
    }
    if (!id) {
      const match = after.find((sub) => sameFeedUrl(sub.url, feedUrl));
      if (match) id = match.id;
    }
    return /^feed\/[0-9]+$/.test(id) ? id.slice("feed/".length) : null;
  } catch (e) {
    return null;
  }
}

/* The notification outlives this background page (MV3 event pages are torn
 * down), so the link is kept in storage.local rather than in a variable that
 * would be gone by the time the user clicks. */
async function readNotificationLinks() {
  const stored = await browser.storage.local.get({ [NOTIFICATION_LINK_KEY]: {} });
  return stored[NOTIFICATION_LINK_KEY] || {};
}

async function notify(title, message, link) {
  try {
    const notificationId = "add-to-freshrss-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
    await browser.notifications.create(notificationId, {
      type: "basic",
      iconUrl: browser.runtime.getURL("icons/icon-96.png"),
      title: title,
      message: message
    });
    if (link) {
      const links = await readNotificationLinks();
      links[notificationId] = link;
      const ids = Object.keys(links);
      for (const stale of ids.slice(0, Math.max(0, ids.length - 20))) delete links[stale];
      await browser.storage.local.set({ [NOTIFICATION_LINK_KEY]: links });
    }
  } catch (e) { /* best effort */ }
}

async function forgetNotification(notificationId) {
  const links = await readNotificationLinks();
  if (!(notificationId in links)) return;
  delete links[notificationId];
  await browser.storage.local.set({ [NOTIFICATION_LINK_KEY]: links });
}

browser.notifications.onClicked.addListener(async (notificationId) => {
  const links = await readNotificationLinks();
  const url = links[notificationId];
  if (!url) return;
  await forgetNotification(notificationId);
  browser.tabs.create({ url, active: false });
  browser.notifications.clear(notificationId);
});

browser.notifications.onClosed.addListener((notificationId) => {
  forgetNotification(notificationId);
});

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
    const feedId = await addViaApi(cfg, url);
    // awaited: the notification id -> settings link must be stored before this
    // background page can be torn down, or the click would find nothing.
    await notify("Added to FreshRSS", url, feedId ? feedSettingsUrl(cfg, feedId) : "");
  } catch (e) {
    await notify("FreshRSS add failed", String(e && e.message ? e.message : e));
  }
});
