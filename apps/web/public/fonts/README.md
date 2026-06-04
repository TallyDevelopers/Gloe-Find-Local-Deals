# Self-hosted fonts

The gloe.app **consumer site** uses these two typefaces. Both are **free for
commercial use** (Fontshare / Indian Type Foundry) and are self-hosted here as
`.woff2` — no license to buy, no external CDN at runtime.

| File | Family | Weight | Used for |
|---|---|---|---|
| `clash-display-400/500/600/700.woff2` | Clash Display | 400–700 | Headlines (`--font-display`) |
| `general-sans-400/500/600.woff2` | General Sans | 400–600 | Body / UI (`--font-body`) |

Wired up in `apps/web/src/app/globals.css`:
- `@font-face` rules (top of file) point at these files.
- They're applied **scoped to `.consumer-shell`** — i.e. the gloe.app marketplace
  only. Vendor/admin/business portals + the iOS app keep their current fonts until
  sign-off, then this rolls out everywhere.

Source: https://www.fontshare.com (Clash Display, General Sans). To update weights,
download the `.woff2` from Fontshare and replace the matching file here.
