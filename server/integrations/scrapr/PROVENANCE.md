# Upstream provenance — selected coflyn/scrapr adapters

- Repository: https://github.com/coflyn/scrapr
- Pinned commit: **2f41437aeafddb45f939f8066e9f98c0e976807e**
- Tree: `568a30b7aa443f44b40ae77fe6cc8edffd78e5ef`
- Upstream package version at reference: `@coflyn/scrapr` 1.3.0.
- License: MIT, Copyright (c) 2026 coflyn. The full license is retained in this directory as `LICENSE`.

Reference tree: https://github.com/coflyn/scrapr/tree/2f41437aeafddb45f939f8066e9f98c0e976807e

## Adapted source mapping

| Upstream file | Local adaptation |
|---|---|
| `lib/spotify/spotisaver/index.js` | `spotify.js`: page signature configuration, signed metadata request, signed POST media download |
| `lib/spotify/spotidown/index.js` | `spotify.js`: action/track form parsing and metadata decoding |
| `lib/spotify/spotmate/index.js` | `spotify.js`: Spotimate session, verification and multipart form flow |
| `lib/reddit/rapidsave/index.js` | `other.js`: RapidSave page/download parsing |
| `lib/bilibili/direct/index.js` | `other.js`: view/playurl API flow |

This is a modified, selective adaptation, **not an unmodified installation of the whole upstream package**. The `spotmate` adapter/configuration name is retained for source traceability; its upstream service is Spotimate at `spotimate.app`.

## Deliberate changes

- Isolated network transport with HTTPS/public-address checks, validated socket DNS lookup, bounded redirects, origin-scoped sessions and response limits.
- JSON5 data parsing replaces evaluation of remote JavaScript. No remote `eval` or `new Function`.
- Signed Spotisaver media POST is preserved, with a fresh signature on download. No unsigned GET substitute.
- No fabricated CAPTCHA answer; challenged providers fail normally.
- No `/action` HTML-page placeholder masquerading as MP3. Download-anchor filtering and gateway MIME/prefix checks are applied.
- No hardcoded 320 kbps guarantee. Bilibili quality comes from the API; multiple returned segments are separate parts, not duplicate quality options.
- Expiring opaque media tickets keep upstream session/signature payloads server-side.
- TikTok, Instagram, YouTube and other existing resolver modules are not replaced with upstream scrapr modules.
- The duplicate Soundloaders/Spotimate implementation is not added. Bluesky/Tumblr stay on their previous integrations.

`network.js`, `media.js`, dispatcher glue, caption metadata helper and UI integration are project-specific additions. MIME/prefix checks are basic validation, not exhaustive file authenticity or malware checks.
