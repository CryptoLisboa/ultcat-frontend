import { SPRITE_CANVAS, type SkinId, type StageId, spriteUrl } from "./sprites";

export interface OutputSize {
  id: string;
  label: string;
  hint: string;
  width: number;
  height: number;
  /** Where the caption sits, as a fraction of width. Banners dodge the avatar. */
  captionCenter: number;
  captionMaxWidth: number;
  /** Caption baseline as a fraction of height. */
  captionBottom: number;
  /**
   * Compose inside the square's inscribed circle, because X renders a profile
   * picture as a circle and everything in the corners is thrown away.
   */
  circleSafe?: boolean;
}

/**
 * Sized to X's own spec: a profile picture displays at 400x400 and a header at
 * 1500x500. "Post" is 16:9, which is what X shows a single attached image at
 * without cropping it.
 */
export const OUTPUT_SIZES: readonly OutputSize[] = [
  {
    id: "pfp",
    label: "PFP",
    // 800, not X's 400 display size: the source art is 768 tall, so a 400px
    // square draws the cat at 344px and throws away 2.23x of it. At 800 the cat
    // lands at 688px — effectively native — and X downsamples to its own 400
    // variant from more data than we could hand it.
    hint: "800 × 800",
    width: 800,
    height: 800,
    captionCenter: 0.5,
    // A caption along the very bottom of a square falls outside the circle
    // almost entirely, so on a PFP it is lifted and narrowed to the chord.
    captionMaxWidth: 0.6,
    captionBottom: 0.87,
    circleSafe: true,
  },
  {
    id: "post",
    label: "Post",
    hint: "1200 × 675",
    width: 1200,
    height: 675,
    captionCenter: 0.5,
    captionMaxWidth: 0.9,
    captionBottom: 0.95,
  },
  {
    // X overlays the profile picture on the banner's bottom-left, so the caption
    // is pushed right of centre and kept narrow enough never to run under it.
    id: "banner",
    label: "Banner",
    hint: "1500 × 500",
    width: 1500,
    height: 500,
    captionCenter: 0.62,
    captionMaxWidth: 0.6,
    captionBottom: 0.95,
  },
] as const;

export interface Background {
  id: string;
  label: string;
  /** Colour stops painted top-to-bottom. A single stop is a flat fill. */
  stops: readonly string[];
  /** Radial bloom centred behind the cat, if this background has one. */
  bloom?: string;
  /** Wide elliptical glow hanging off the top edge — the MAXED stage look. */
  topGlow?: string;
}

/**
 * The first entry reproduces the MAXED game's own stage: a near-black field with
 * a soft glow spilling in from above. Measured off the source, which paints
 * `radial-gradient(1200px 700px at 50% -10%, #16161c, transparent 55%)` over
 * `#07070a`. Everything that makes these portraits work — the gold ki, the lit
 * eyes — depends on the backdrop staying almost black, so this is the default.
 *
 * The rest borrow the page's own aurora palette so a generated PFP still reads as
 * ULTCAT when it lands on a timeline next to the site.
 */
export const BACKGROUNDS: readonly Background[] = [
  { id: "maxed", label: "MAXED", stops: ["#07070a"], topGlow: "#16161c" },
  { id: "aurora", label: "Aurora", stops: ["#04070b", "#0b2436", "#04070b"], bloom: "rgba(76, 219, 255, 0.42)" },
  { id: "ki", label: "Gold ki", stops: ["#0a0700", "#33230a", "#0a0700"], bloom: "rgba(255, 196, 64, 0.42)" },
  { id: "storm", label: "Storm", stops: ["#05060f", "#1b1746", "#05060f"], bloom: "rgba(139, 107, 255, 0.42)" },
  { id: "ice", label: "Ice", stops: ["#01080b", "#0d3038", "#01080b"], bloom: "rgba(124, 240, 224, 0.4)" },
  { id: "inferno", label: "Inferno", stops: ["#0b0301", "#3a1206", "#0b0301"], bloom: "rgba(255, 90, 61, 0.42)" },
  { id: "ink", label: "Ink", stops: ["#04070b"] },
  { id: "none", label: "None", stops: [] },
] as const;

export interface GeneratorState {
  skin: SkinId;
  stage: StageId;
  background: string;
  caption: string;
  size: OutputSize;
}

/**
 * Decoded-image cache.
 *
 * A decoded 580x768 RGBA bitmap is ~1.8MB, and there are only 20 sprites, so the
 * whole set is ~36MB at worst — but a visitor realistically touches a handful.
 * The cap keeps a long randomise session bounded.
 *
 * Map.set on an EXISTING key does not move it in insertion order, so re-setting
 * alone would silently degrade this to FIFO. Delete-then-set is what marks an
 * entry most-recently-used.
 */
const MAX_DECODED = 12;
const imageCache = new Map<string, Promise<HTMLImageElement>>();

function loadImageOnce(url: string): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    // Same-origin, but this keeps the canvas untainted if the assets ever move.
    image.crossOrigin = "anonymous";
    image.onload = () => {
      void (async () => {
        // Decode off the main thread so drawImage never triggers a synchronous
        // decode mid-composite. Safari throws on decode() for some already-cached
        // images, and a failed decode must not fail the load.
        await image.decode().catch(() => undefined);
        resolve(image);
      })();
    };
    image.onerror = () => reject(new Error(`Unable to load ${url}`));
    image.src = url;
  });
}

export function loadSprite(url: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(url);
  if (cached !== undefined) {
    imageCache.delete(url);
    imageCache.set(url, cached);
    return cached;
  }

  const pending = loadImageOnce(url)
    // One silent retry. A single dropped request on a phone network should not
    // strand the visitor on a stale cat behind a dead-end error; the cache-bust
    // param defeats a negatively-cached response.
    .catch(() => loadImageOnce(`${url}?retry=1`))
    .catch((error: unknown) => {
      // Drop the rejected promise so a later attempt starts clean instead of
      // reusing this one.
      imageCache.delete(url);
      throw error;
    });

  imageCache.set(url, pending);
  if (imageCache.size > MAX_DECODED) {
    const oldest = imageCache.keys().next().value;
    if (oldest !== undefined) imageCache.delete(oldest);
  }
  return pending;
}

/** Warm the HTTP cache for a sprite the visitor is about to pick. Fire and forget. */
export function prefetchSprite(skin: SkinId, stage: StageId): void {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData === true) return;
  // The body must be read to completion: cancelling it aborts the fetch per spec,
  // so the HTTP cache never stores a complete entry and the prefetch is worthless.
  void fetch(spriteUrl(skin, stage), { priority: "low", mode: "same-origin" })
    .then((response) => response.arrayBuffer())
    .catch(() => undefined);
}

function paintBackground(
  context: CanvasRenderingContext2D,
  background: Background,
  width: number,
  height: number,
): void {
  if (background.stops.length === 0) return;

  if (background.stops.length === 1) {
    context.fillStyle = background.stops[0];
    context.fillRect(0, 0, width, height);
  } else {
    const gradient = context.createLinearGradient(0, 0, 0, height);
    background.stops.forEach((stop, index) => {
      gradient.addColorStop(index / (background.stops.length - 1), stop);
    });
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
  }

  if (background.topGlow !== undefined) {
    // Canvas radial gradients are circular, so squash the space to get the
    // source's 1200x700 ellipse hanging off the top edge.
    const radiusX = width * 1.2;
    const radiusY = width * 0.7;
    context.save();
    context.translate(width / 2, -height * 0.1);
    context.scale(1, radiusY / radiusX);
    const glow = context.createRadialGradient(0, 0, 0, 0, 0, radiusX);
    glow.addColorStop(0, background.topGlow);
    glow.addColorStop(0.55, "rgba(0, 0, 0, 0)");
    context.fillStyle = glow;
    context.fillRect(-radiusX, -radiusX, radiusX * 2, radiusX * 2);
    context.restore();
  }

  if (background.bloom !== undefined) {
    const radius = Math.max(width, height) * 0.62;
    const bloom = context.createRadialGradient(
      width / 2,
      height * 0.52,
      0,
      width / 2,
      height * 0.52,
      radius,
    );
    bloom.addColorStop(0, background.bloom);
    bloom.addColorStop(1, "rgba(0, 0, 0, 0)");
    context.fillStyle = bloom;
    context.fillRect(0, 0, width, height);
  }
}

/**
 * The portraits are busts framed head-and-shoulders. Fitting them by HEIGHT keeps
 * the head the same size whatever the output aspect, and the wide formats simply
 * show more background either side rather than cropping the ears off.
 */
function drawCat(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  size: OutputSize,
  hasCaption: boolean,
): void {
  const { width, height } = size;

  // Measured against every sprite: centred at 0.86 of the square, essentially
  // nothing falls outside the inscribed circle (worst case 0.17% of opaque
  // pixels), where the old full-bleed 0.98 top-aligned framing lost up to 3.3%
  // — ear tips, aura and the point of the bandana. With a caption the cat gives
  // up more room and rides higher so both stay inside the circle.
  const heightRatio = size.circleSafe === true
    ? (hasCaption ? 0.72 : 0.86)
    : (hasCaption ? 0.86 : 0.98);

  const drawHeight = height * heightRatio;
  const drawWidth = SPRITE_CANVAS.width * (drawHeight / SPRITE_CANVAS.height);
  const x = (width - drawWidth) / 2;

  // Off-centre art loses more to the circle than centred art, so a circle-safe
  // composition is centred vertically; the wide formats stay top-aligned, which
  // is what keeps the bust filling the frame.
  const y = size.circleSafe === true
    ? (height - drawHeight) / 2 - (hasCaption ? height * 0.06 : 0)
    : 0;

  context.drawImage(image, x, y, drawWidth, drawHeight);
}

/**
 * next/font generates a hashed family name (`__Syne_1a2b3c`), never the literal
 * "Syne", so a canvas font string naming the plain family silently falls back to
 * system-ui. Read the same CSS variable the stylesheet uses.
 */
function displayFontFamily(): string {
  if (typeof window === "undefined") return "system-ui, sans-serif";
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue("--font-display")
    .trim();
  return value === "" ? "system-ui, sans-serif" : `${value}, system-ui, sans-serif`;
}

/** Canvas does not trigger font loading the way layout does — ask for it explicitly. */
export async function ensureCaptionFont(): Promise<void> {
  if (typeof document === "undefined" || document.fonts === undefined) return;
  try {
    await document.fonts.load(`800 64px ${displayFontFamily()}`);
  } catch {
    // A refused load just means the fallback renders. Never fail the composite.
  }
}

function drawCaption(
  context: CanvasRenderingContext2D,
  caption: string,
  size: OutputSize,
): void {
  const text = caption.trim().toUpperCase();
  if (text === "") return;

  const { width, height } = size;
  const family = displayFontFamily();
  const maxWidth = width * size.captionMaxWidth;

  // Shrink to fit rather than letting a long caption run off the edge. maxLength
  // caps the input at 28 characters, which still overflows a square at full size.
  let fontSize = Math.round(height * 0.11);
  const minFontSize = Math.round(height * 0.045);
  context.font = `800 ${fontSize}px ${family}`;
  while (context.measureText(text).width > maxWidth && fontSize > minFontSize) {
    fontSize -= 2;
    context.font = `800 ${fontSize}px ${family}`;
  }

  context.textAlign = "center";
  // "bottom" accounts for descenders, so the baseline maths cannot clip the
  // caption against the edge the way an alphabetic baseline did.
  context.textBaseline = "bottom";
  const y = Math.round(height * size.captionBottom);
  const x = width * size.captionCenter;

  // Stroke first, then fill: a dark outline is what keeps white text readable
  // over a pale aura, which is the whole reason the caption is legible at all.
  context.lineWidth = Math.max(2, fontSize * 0.16);
  context.lineJoin = "round";
  context.strokeStyle = "rgba(2, 6, 10, 0.92)";
  context.strokeText(text, x, y, maxWidth);
  context.fillStyle = "#ffffff";
  context.fillText(text, x, y, maxWidth);
}

/**
 * Draws the composition into `canvas` at `pixelWidth` device pixels across.
 *
 * Everything inside draws in OUTPUT coordinates (0..size.width) regardless of the
 * backing-store size — a scale transform does the rest. That is what lets the
 * on-screen preview follow the layout (and the screen's DPR) while the export
 * stays pinned to X's spec, from one code path.
 */
export async function renderComposite(
  canvas: HTMLCanvasElement,
  state: GeneratorState,
  pixelWidth?: number,
): Promise<void> {
  const { width, height } = state.size;
  // Never below spec: a preview narrower than the output would be a downgrade.
  const scale = Math.max(1, (pixelWidth ?? width) / width);
  const backingWidth = Math.round(width * scale);
  const backingHeight = Math.round(height * scale);

  // Assigning canvas.width/height blanks the surface per spec even when the value
  // does not change. Guarding it means a skin swap keeps the previous frame on
  // screen until the new one is drawn, instead of flashing empty.
  if (canvas.width !== backingWidth) canvas.width = backingWidth;
  if (canvas.height !== backingHeight) canvas.height = backingHeight;

  const context = canvas.getContext("2d");
  if (context === null) throw new Error("Unable to get a 2D context");

  context.setTransform(scale, 0, 0, scale, 0, 0);
  // The sprite is downsampled on every path; the default bilinear filter is
  // visibly mushier than bicubic on the aura's fine strands.
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  const hasText = state.caption.trim() !== "";
  const [image] = await Promise.all([
    loadSprite(spriteUrl(state.skin, state.stage)),
    hasText ? ensureCaptionFont() : Promise.resolve(),
  ]);
  const background =
    BACKGROUNDS.find((candidate) => candidate.id === state.background) ?? BACKGROUNDS[0];
  const hasCaption = state.caption.trim() !== "";

  context.clearRect(0, 0, width, height);
  paintBackground(context, background, width, height);
  drawCat(context, image, state.size, hasCaption);
  drawCaption(context, state.caption, state.size);
}

/**
 * PNG on this artwork is enormous — a 1000x1000 export is ~965KB, against ~125KB
 * as JPEG, for art with no flat areas where JPEG would show. PNG is kept only for
 * the transparent background, where it is the point.
 */
function exportFormat(state: GeneratorState): { type: string; extension: string } {
  return state.background === "none"
    ? { type: "image/png", extension: "png" }
    : { type: "image/jpeg", extension: "jpg" };
}

/**
 * Exports at the output spec exactly, by re-compositing off-screen rather than
 * reading the on-screen canvas — whose backing store tracks the layout and the
 * screen's DPR and is therefore the wrong size by design.
 */
export async function canvasToBlob(state: GeneratorState): Promise<Blob> {
  const { type } = exportFormat(state);
  const target = document.createElement("canvas");
  await renderComposite(target, state);
  return new Promise((resolve, reject) => {
    target.toBlob(
      (blob) => {
        if (blob === null) reject(new Error("Could not export the canvas"));
        else resolve(blob);
      },
      type,
      // Only consulted for lossy types; ignored for PNG.
      0.94,
    );
  });
}

export function fileNameFor(state: GeneratorState): string {
  const { extension } = exportFormat(state);
  return `ultcat-${state.skin}-${state.stage}-${state.size.id}.${extension}`;
}
