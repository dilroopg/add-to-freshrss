# Add to FreshRSS

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
> It is provided under the **MIT licence** — see `LICENSE` — which means you are free to
> **use, modify, fork, redistribute, and sell** it, with no permission needed and no
> obligation beyond keeping the copyright notice. If you find a bug, please fix it and
> send a patch; the licence explicitly invites that. See
> [Contributing](#contributing) for how the code came to exist.

Right-click any link — or any page — and subscribe it to your
[FreshRSS](https://freshrss.org) — no copy-pasting URLs into the web UI.

Firefox extension, Manifest V3. No build step, no dependencies, no telemetry: it talks
only to the FreshRSS instance you configure.

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

Either way, a site address works as well as a feed URL — FreshRSS does the feed
auto-discovery itself.

Adding always happens in the background page, not in the popup: a popup is torn down
the moment it loses focus, so anything awaited inside it could silently never finish.

## Install

Until it's on AMO, load it as a temporary add-on:

1. `about:debugging#/runtime/this-firefox`
2. **Load Temporary Add-on…** → pick `manifest.json` in this folder.

Temporary add-ons are cleared when Firefox restarts. For a permanent install, zip the
folder and load it as an unsigned XPI, or build/sign it with
[`web-ext`](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/):

```sh
npx web-ext build        # -> web-ext-artifacts/*.zip
npx web-ext lint         # validator clean before you submit
```

Then open the extension's preferences (toolbar button) and fill in:

- **FreshRSS address** — e.g. `https://rss.example.com`
- **Username** and **API password** (silent mode only)

The API password is *not* your login password. In FreshRSS: **Settings → Profile →
API management** (or `./cli/create-user.php --api-password …`).

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

The licence explicitly grants you the right to change anything. If you find a defect:

1. **Fork it and fix it.** You need no permission. `LICENSE` is MIT: modify, repackage,
   redistribute, even sell it.
2. **Send a pull request** if you'd like the fix upstream. There is no CLA to sign and no
   contribution process beyond "make the change and explain why".
3. **Publish your own version** under a different name if you'd rather not wait. Point
   people at it. Nothing here is locked down.

Please keep the AI-authorship disclosure (or an accurate description of your own code) in
any fork, so users can make an informed choice about what they're installing.

## License

MIT — see `LICENSE`. Copyright (c) 2026 hardlysleep.ing.

Use it, fork it, ship it, sell it. The only obligation is keeping the copyright notice.
