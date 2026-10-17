# Add to FreshRSS

![Firefox and Zen](assets/firefox.svg) → ![FreshRSS](assets/freshrss.svg)

**A Firefox extension — works in [Firefox](https://www.mozilla.org/firefox/) and
[Zen](https://zen-browser.app/),** and in any other Firefox-based browser (Floorp,
Waterfox, LibreWolf, Mullvad…). Not a Chromium extension: it uses `browser.*` APIs and an
unpacked MV3 install path, so Chrome, Edge and Brave are out of scope. See
[Install](#install-the-easy-way--signed-from-releases).

> ### ⚠️ AI-generated software — use at your own risk
>
> **This extension was written by AI** (a large language model agent, with human
> direction and testing). It is **not** the product of professional software
> engineering, it has **not** been security-audited, and it has only been tested against
> one self-hosted FreshRSS instance.
>
> **Understand what that means before you install it:**
>
> - It handles your **FreshRSS URL, username, and API password**, and stores them in your
>   browser profile. Treat those credentials as exposed to any bug in this code.
> - It has **not** been reviewed by anyone but its author. There may be defects that
>   corrupt data, leak credentials, or behave unpredictably on setups unlike the one it
>   was developed on.
> - Behaviour on **public FreshRSS instances, other FreshRSS versions, or hosted
>   services is untested** and may not work at all.
> - **No warranty, no support, no guarantees.** You are responsible for your own data.
>   Back up your FreshRSS database (`data/users/<user>/db.sqlite`) before first use.
> - If you cannot accept those terms, **do not install this**. Use the official
>   FreshRSS web UI instead.
>
> It is provided under the **GNU General Public License v3.0 or later** — see `LICENSE`.
> You may **use, study, modify, fork and redistribute** it, and you may even redistribute
> it for a fee, but if you distribute a build of it you **must** publish your version's
> complete source under GPL-3.0, **keep the copyright notice and attribution to the
> original author**, and state what you changed. You may not ship a modified build as
> closed source or with the credit stripped. See [Contributing](#contributing) for how
> the code came to exist.

Right-click any link — or any page — and subscribe it to your
[FreshRSS](https://freshrss.org) — no copy-pasting URLs into the web UI.

**Looking for feeds? This add-on doesn't do that — use
[RSSHub Radar](https://github.com/DIYgod/RSSHub-Radar).** See
[This is not a discovery tool](#this-is-not-a-discovery-tool).

Firefox extension, Manifest V3. No build step, no dependencies, no telemetry: it talks
only to the FreshRSS instance you configure.

## About FreshRSS

This add-on is a client for **[FreshRSS](https://freshrss.org)** — the free, self-hosted
RSS/Atom aggregator (GPL-3.0, [source](https://github.com/FreshRSS/FreshRSS)) that you run
on your own server or NAS. If you don't already have a FreshRSS instance, this extension
has nothing to talk to: set that up first, then come back.

- Website: <https://freshrss.org>
- Source: <https://github.com/FreshRSS/FreshRSS>
- Docs / install: <https://freshrss.github.io/FreshRSS/en/admins/03_Installation.html>

What this add-on adds is the outside-the-web-UI path into it: instead of opening your
FreshRSS, clicking *Add a feed*, and pasting a URL, you right-click the link while you're
already looking at it.

This project is **unaffiliated with the FreshRSS project** — it's an independent client
that speaks FreshRSS's own Google Reader API (see [Getting silent mode
right](#getting-silent-mode-right)). Bugs here are mine, not theirs.

## This is not a discovery tool

This extension has exactly one job: **subscribe a URL you already have to your FreshRSS
instance.** It does not search for feeds, it does not list a site's feeds for you, and it
does not scan a page for feed links. Its input is a URL — a feed or a plain site address —
and its output is a subscription. That's it.

**Use [RSSHub Radar](https://github.com/DIYgod/RSSHub-Radar)** to *find* feeds. Radar is
the discovery half: it inspects the page you're on, shows every feed and RSSHub route it
can find, and is what you want when you don't yet know the feed URL. Install Radar from
[addons.mozilla.org](https://addons.mozilla.org/firefox/addon/rsshub-radar/) (Chrome/Edge
builds are in the same repo).

**Then use this extension** to push that URL into your FreshRSS without opening its web UI.

| You want to | Use |
|---|---|
| Discover what feeds a page or site offers | **RSSHub Radar** |
| Subscribe a URL you already have | **Add to FreshRSS** |

The two are complementary, not competing. Radar has a "subscribe" button too, but it is
built around RSSHub's service model and its own rules for handing off to a reader; this
extension talks to *your* self-hosted FreshRSS directly, in either deep-link or silent API
mode. If you're happy with Radar end to end, you don't need this.

## What it does

**Click the toolbar button** → a small popup opens where you can paste one or more
links (one per line) and add them straight away. Handy for feeds you found somewhere
that you don't want to hunt for on a page. `Ctrl`/`Cmd`+`Enter` adds without reaching
for the mouse; links are deduped and blank lines ignored. A **Settings** button in the
popup opens the preferences.

**Right-click a link, or right-click the page** → **Add to FreshRSS**. Right-clicking a
*link* subscribes that link. Right-clicking *anywhere else on a page* subscribes the
page's own URL — which is what you want when the page you're looking at **is** an RSS
feed, since there is no link to click. Two modes:

| Mode | What happens | Needs |
|---|---|---|
| **Deep link** (default) | Opens FreshRSS's add-feed page in a background tab, URL pre-filled. You confirm there. | Your FreshRSS base URL |
| **Silent (API)** | Subscribes via FreshRSS's Google Reader API and shows a notification. No tab, no password prompt. | Base URL + username + **API** password |

Silent mode also takes an optional category, which is applied to the subscription.

Adding always happens in the background page, not in the popup: a popup is torn down
the moment it loses focus, so anything awaited inside it could silently never finish.

## Install (the easy way — signed, from Releases)

**Just want to use it?** Download the signed `.xpi` from
**[Releases](https://github.com/dilroopg/add-to-freshrss/releases/latest)** and import it.
That's the whole install. Nothing is built by you, there is no build step to run, and
signing is already done — so it installs permanently and survives restarts.

1. Go to [Releases](https://github.com/dilroopg/add-to-freshrss/releases/latest) and
   download **`add-to-freshrss-<version>.xpi`** (under *Assets*). Ignore the "Source code"
   links — those are for developers.
2. In **Firefox or Zen**, open a new tab and go to `about:addons`
   (or **☰ → Add-ons and themes**).
3. Click the **gear icon** (top right of the Add-ons page) → **Install Add-on From File…**
4. Pick the `.xpi` you downloaded and confirm. Firefox/Zen may ask you to allow the
   install — that's normal for a self-distributed add-on.
5. **Pin it to the toolbar** so the button is always there: right-click the toolbar →
   *Customize Toolbar…*, then drag *Add to FreshRSS* onto the toolbar.

Then do the two-minute [Setup](#setup) below.

> **Why this works without the "corrupt add-on" error:** the `.xpi` in Releases is
> **signed by Mozilla**, so you do **not** need to touch `xpinstall.signatures.required`.
> If you see that error, you grabbed a self-built `.zip` from the build section below, not
> the signed release.

**Firefox versions below 140 are not supported** — the manifest uses
`data_collection_permissions`, which older versions do not understand and will reject.
140 is the current ESR, so any maintained Firefox or Zen build qualifies.

## Setup

Two fields, once.

1. Open the add-on's preferences: click the toolbar button, then **Settings** in the popup
   (or `about:addons` → *Add to FreshRSS* → *Preferences*).
2. Fill in **FreshRSS address** — where your instance lives, e.g.
   `https://rss.example.com` (no trailing slash needed).
3. *Optional, for silent mode:* **Username** and **API password**. The API password is
   *not* your login password — in FreshRSS go to **Settings → Profile → API management**
   (or run `./cli/create-user.php --api-password …`) and copy the one it generates.
4. Save. You're done.

### Using it

- **Subscribe a link:** right-click any link → **Add to FreshRSS**.
- **Subscribe the page you're on:** right-click anywhere else on the page → same item.
  This is what you want when the page *is* a feed.
- **Paste one or many:** click the toolbar button, paste one URL per line, press **Add**
  (`Ctrl`/`Cmd`+`Enter`). Blank lines are ignored and duplicates are dropped.
- **Deep link vs silent:** with no username/password saved you get the *deep link* mode — a
  background tab opens FreshRSS's own add-feed page with the URL filled in, and you confirm
  there. Add the API password and it instead subscribes by API with a notification, no tab.
- **Category:** in silent mode you can set a category, applied to each new subscription.

**Finding feeds is not what this does** — see
[This is not a discovery tool](#this-is-not-a-discovery-tool). Use
[RSSHub Radar](https://github.com/DIYgod/RSSHub-Radar) for that, then subscribe the URL
here.

## Build it from source (only if you want to)

**You do not need this section to install the add-on.** It exists for people who want to
run their own build or verify the code, not as an install route. If you just want it
working, use [Releases](#install-the-easy-way--signed-from-releases) above.

Nothing is built for you ahead of time in this path — you build the add-on yourself, which
takes about ten seconds and means you are running exactly the code you can read.

### Build it from source (no account, no signing)

Requires [Node.js](https://nodejs.org) (any recent LTS).

```sh
git clone https://github.com/dilroopg/add-to-freshrss.git
cd add-to-freshrss
npx --yes web-ext@latest build          # -> web-ext-artifacts/add_to_freshrss-*.zip
```

Now install the `.zip`:

1. In Firefox/Zen, go to `about:addons`
2. Gear icon (top right) → **Install Add-on From File…**
3. Pick the `.zip` from `web-ext-artifacts/` and confirm

That is a **permanent** install — it survives restarts.

> **Firefox will refuse it with "this add-on could not be installed because it appears
> to be corrupt"** unless signature enforcement is off. That is not a problem with this
> add-on; it is Firefox requiring every add-on to be signed by Mozilla. You have two
> options: set `xpinstall.signatures.required` to `false` in `about:config` (the
> documented [developer route](https://extensionworkshop.com/documentation/publish/self-distribution/),
> your call, and it applies to all add-ons), or wait for a Mozilla-signed build
> which installs with signing on.

### The quick way: temporary load (cleared on restart)

1. `about:debugging#/runtime/this-firefox`
2. **Load Temporary Add-on…** → pick `manifest.json` from the cloned folder

Fine for a look, but it disappears when the browser closes.

### Verification, if you care

```sh
npx --yes web-ext@latest lint --source-dir .   # expect 0 errors
```

And to confirm your build matches what you just read:

```sh
unzip -l web-ext-artifacts/add_to_freshrss-*.zip   # 9 runtime files, no extras
```

### Signed build
Head to [Releases](https://github.com/dilroopg/add-to-freshrss/releases/latest) and
download it. Import the add-on and enable it. Pin it. Full steps are in
[Install](#install-the-easy-way--signed-from-releases) and
[Setup](#setup) above.

## Getting silent mode right

FreshRSS's Google Reader API is a two-step dance, and getting it wrong looks like an
auth failure:

1. `POST /api/greader.php/accounts/ClientLogin` with `Email` and `Passwd`. The response
   contains `Auth=<user>/<sha1>`.
2. Send that whole `user/sha1` string as the **`Authorization: GoogleLogin auth=…`
   header** on `POST …/reader/api/0/subscription/edit` with `ac=subscribe` and
   `s=feed/<url>`.

Sending it as the `T` POST parameter instead leaves the request with no user at all, and
the endpoint answers `unauthorized` before it ever compares a token.

## "URL is not allowed to be resolved"

If your FreshRSS is on a **private address** — a LAN IP, a `.local` name, or a Tailscale
name — subscribing fails with HTTP 400 and this in the FreshRSS log:

```
subscriptionEdit error subscribe: URL is not allowed to be resolved: http://…
GReaderAPI::badRequest
```

That's FreshRSS's anti-SSRF guard, not the extension: it refuses to fetch hosts on
private/link-local/CGNAT ranges. Allowlist the host in FreshRSS under **Settings →
System configuration → internal host allowlist**. Both forms are worth adding if you're
unsure, because matching can be host or host:port:

```
192.168.1.20
192.168.1.20:8080
```

Two related traps if FreshRSS is in Docker: the *container* is what fetches the URL, so
use a name the container resolves (a container name, not your laptop's view of the
network), and note that a feed URL only has to be reachable **from the FreshRSS
container** — not from your browser.

## Permissions, and why

| Permission | Why |
|---|---|
| `contextMenus` | the right-click item — the whole point |
| `storage` | keeps your address, username and API password locally |
| `notifications` | reports success/failure in silent mode |
| `tabs` | opens the deep-link page in a background tab |
| `optional_host_permissions: <all_urls>` | requested at runtime so the API call can reach *your* FreshRSS host |

Nothing is sent anywhere except your own FreshRSS instance. Credentials live in
`browser.storage.local`; they are not synced and not transmitted to any third party.

## Contributing

**This project was built by AI and is published as-is.** That is stated plainly because
it affects how you should treat the code: read it before you trust it, and don't assume
it has had the review a human-written project would have had.

You are free to read, run, study, and change this code. Under GPL-3.0 that freedom comes
with obligations — if you find a defect:

1. **Fork it and fix it.** No permission needed. But if you distribute your version in
   any form, GPL-3.0 requires you to publish its complete source under GPL-3.0 and to
   keep the copyright notice and attribution intact. You cannot ship a modified build as
   closed source, and you cannot strip the credit.
2. **Send a pull request** if you'd like the fix upstream. There is no CLA to sign and no
   contribution process beyond "make the change and explain why" — but you are not
   required to send it, only to publish your source if you distribute.
3. **Do not republish this under a different name as if it were your own.** A fork must
   stay clearly marked as a fork, with the original author credited.

Keep the AI-authorship disclosure (or an accurate description of your own code) in any
fork, so users can make an informed choice about what they're installing.

## License

**GNU General Public License v3.0 or later** (GPL-3.0-or-later) — see `LICENSE`.
Copyright (C) 2026 hardlysleep.ing.

This program is free software: you can redistribute it and/or modify it under the terms
of the GPL as published by the Free Software Foundation, either version 3 of the License,
or (at your option) any later version. It is distributed in the hope that it will be
useful, but **without any warranty**; without even the implied warranty of
merchantability or fitness for a particular purpose.

**What that means in practice:**

| You may | You must |
|---|---|
| use it, run it, study it | keep the copyright notice and attribution |
| modify it, fork it | publish your complete source if you distribute it |
| redistribute it, even for a fee | license your version under GPL-3.0 as well |
| | state what you changed |

**You may not** take this code, modify it, and ship it as closed-source or without
crediting the original author. Derivative works are permitted only under these same
terms.

## Third-party logos

`assets/firefox.svg` is the Firefox logo, a trademark of the
[Mozilla Foundation](https://www.mozilla.org/foundation/), used here only to indicate that
this add-on runs in Firefox (and other Firefox-based browsers such as
[Zen](https://zen-browser.app/)). `assets/freshrss.svg` is the
[FreshRSS](https://freshrss.org) logo, used to indicate which service this add-on talks to.

Both are the property of their respective projects and are included for identification
only. Their presence does not imply any affiliation with, endorsement by, or sponsorship
from Mozilla or the FreshRSS project. Logos are not covered by this project's GPL-3.0
license.
