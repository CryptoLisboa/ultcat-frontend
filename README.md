# Ultra Cat ($ULTCAT)

Community site for Ultra Cat, a memecoin on Cronos. Live at **[ultcat.com](https://ultcat.com)**.

Unofficial meme. Not Ult, not CRO. Just the cat.

## What's here

A single-page Next.js app with:

- **Buy links** — Obsidian, WolfSwap and cro.trade
- **Live stats** — price, liquidity and volume from DexScreener, revalidated every 30s
- **Chart** — GeckoTerminal embed for the V2 pair
- **Contract panel** — copy the address, open it in the explorer, or search it on X
- **Swap widget** — built against the V2 router, dormant until a Reown project ID is configured
- **Cat generator** — the reason most people show up

## The generator

Composites one of 20 cat portraits (4 skins × 5 power stages) over one of 8 backgrounds, with an optional caption, and exports at X's own dimensions:

| Output | Size | Notes |
| --- | --- | --- |
| PFP | 800 × 800 | Composed inside the inscribed circle, because X crops avatars round |
| Post | 1200 × 675 | 16:9, X's in-feed ratio — not the 1200 × 630 OG default |
| Banner | 1500 × 500 | Caption sits off-centre to clear the avatar X overlays bottom-left |

Exports go through the Web Share API on touch devices and a file download on desktop. The result is always also painted into a visible `<img>`, because on iOS both paths can misbehave and long-press-to-save never does.

A few decisions that aren't obvious from the code:

- **PFP is 800, not X's 400 display size.** The source art is 768px tall, so a 400px square draws the cat at 344px and throws away 2.23× of it. X downsamples to its own variant from more data than we could hand it.
- **The preview and the export are different canvases.** The on-screen canvas tracks its CSS size × `devicePixelRatio` so it stays sharp on retina displays; `canvasToBlob` re-composites off-screen at exact spec so the file never drifts off X's numbers.
- **Sprites are padded to a common 580 × 768 with no vertical correction.** They're already horizontally centred, and the aura reaches further below the chin at higher power stages — bottom-aligning the alpha bounding box would make the cat bob as you change selection.

## Running it

Requires Node 20+.

```bash
cd web
npm install
npm run dev
```

Then open http://localhost:3000.

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (swap maths) |

### Environment

Everything works with no configuration. One optional variable turns on the swap widget:

```
NEXT_PUBLIC_REOWN_PROJECT_ID=
```

Get one from [Reown](https://dashboard.reown.com) and add your domain to its allowlist. Without it the swap section renders a placeholder pointing at the external venues, and nothing else changes.

See `web/.env.example`.

## Layout

```
web/
  src/app/         page, layout, global styles
  src/components/  Generator, SwapWidget, LiveStats, BuyButtons, Aurora, …
  src/lib/         generator (canvas compositor), swap maths, DexScreener client,
                   sprites (generated), constants (every address and URL)
  public/cat/      20 cat portraits, WebP
  public/brand/    logo and banner
```

Every address and external URL lives in `src/lib/constants.ts`. Nothing is hotlinked — all images are served from `public/`, which is why `next.config.ts` carries no `remotePatterns`.

## Credits

Cat artwork by **[DRod](https://x.com/DeeRod)**, who founded ULTCAT and drew every one of these cats.

## Disclaimer

Community project. Not affiliated with or endorsed by Ult or Cronos Labs. Memecoins are highly volatile; nothing here is financial advice.
