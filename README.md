# springhouse-site-animations

Scroll animations for the Springhouse marketing site (Webflow). GSAP, ScrollTrigger and SplitText load from jsDelivr. This repo is public, so never commit secrets or internal URLs.

## Hooks

| Attribute | Values | Effect |
|---|---|---|
| `data-reveal` | `lines`, `fade`, `rise`, `pop` | Entrance on scroll. `rise` is batched and staggered. |
| `data-parallax` | number (e.g. `0.1`) | Scrubbed vertical drift. Factor scales the shift, halved below 992px. |
| `data-mask` | `ellipse` | Scrubbed ellipse clip-path expand. |
| `data-draw` | `true` | SVG stroke draw, or a div grows along its long axis. |
| `data-clip` | any | Wipe inside the pinned slider, desktop only. |
| `data-slider` | `pin` | Owned by the vanilla slider script in the Refrigerator footer. Not touched here. |

Reveals use `yPercent` and parallax uses `y`, so both can sit on one element.

## Usage in Webflow

1. Page head: paste `head-snippet.html`.
2. Page footer: paste `footer-snippet.html` (replace `OWNER`), above existing page scripts.
3. Page custom code does not run in the Designer. Test on a published staging URL.

Use `v2-*` classes only. Do not edit shared live classes.

## Behavior

- `prefers-reduced-motion: reduce` shows everything with no motion.
- If GSAP fails to load, or after 3s, `[data-reveal]` content is shown anyway.
- SplitText missing falls back to a fade for `lines`.

## Release

Pin the footer snippet to a release tag or full commit SHA (jsDelivr treats both as immutable). Avoid `@main` in production because jsDelivr caches branches.
