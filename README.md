# Add to FreshRSS

Right-click any link and subscribe it to your [FreshRSS](https://freshrss.org) — no
copy-pasting URLs into the web UI.

Firefox extension, Manifest V3. No build step, no dependencies, no telemetry: it talks
only to the FreshRSS instance you configure.

## What it does

Right-click a link → **Add to FreshRSS**. Two modes:

| Mode | What happens | Needs |
|---|---|---|
| **Deep link** (default) | Opens FreshRSS's add-feed page in a background tab, URL pre-filled. You confirm there. | Your FreshRSS base URL |
| **Silent (API)** | Subscribes via FreshRSS's Google Reader API and shows a notification. No tab, no password prompt. | Base URL + username + **API** password |

Silent mode also takes an optional category, which is applied to the subscription.

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

## License

MIT — see `LICENSE`.
