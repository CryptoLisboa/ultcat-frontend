"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import {
  BACKGROUNDS,
  OUTPUT_SIZES,
  canvasToBlob,
  fileNameFor,
  prefetchSprite,
  renderComposite,
} from "../lib/generator";
import { SKINS, STAGES, type SkinId, type StageId } from "../lib/sprites";
import { ARTIST_NAME, ARTIST_URL } from "../lib/constants";

type Status = { kind: "idle" | "working" | "done" | "error"; message: string };

const IDLE: Status = { kind: "idle", message: "" };

/** Independent of any object-URL lifetime, so the visible result cannot be
 *  invalidated by the download path or by a revoke elsewhere. */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read the exported image"));
    reader.readAsDataURL(blob);
  });
}

export function Generator() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  // Guards against an out-of-order render: a slow sprite resolving after a newer
  // selection has already been drawn would otherwise paint the stale cat.
  const renderToken = useRef(0);

  const [skin, setSkin] = useState<SkinId>("ultcat");
  const [stage, setStage] = useState<StageId>("maxed");
  const [background, setBackground] = useState<string>("maxed");
  const [caption, setCaption] = useState("");
  const [size, setSize] = useState(OUTPUT_SIZES[0]);
  const [status, setStatus] = useState<Status>(IDLE);
  const [preview, setPreview] = useState<string | null>(null);
  const [pixelWidth, setPixelWidth] = useState<number | undefined>(undefined);

  // The preview's backing store tracks its CSS size x DPR. Without this the
  // canvas is the OUTPUT size stretched by CSS — a 400px bitmap shown at 654
  // CSS px on a retina Mac is a 3.3x upscale, which is what made the cat look
  // soft even though the exported file was sharp.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (wrap === null || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const cssWidth = entry.contentRect.width;
      if (cssWidth > 0) {
        // Capped at 2: a 3x phone rendering a banner at DPR 3 is megapixels of
        // RGBA for no visible gain.
        setPixelWidth(Math.round(cssWidth * Math.min(window.devicePixelRatio || 1, 2)));
      }
    });
    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;

    renderToken.current += 1;
    const token = renderToken.current;

    // Any change makes the last export stale, and it sits OVER the canvas — leave
    // it up and the visitor edits a cat they cannot see. Nothing to revoke: the
    // visible result is a data URL, deliberately (see exportImage).
    setPreview(null);

    void renderComposite(canvas, { skin, stage, background, caption, size }, pixelWidth)
      .then(() => {
        if (token === renderToken.current) setStatus((s) => (s.kind === "error" ? IDLE : s));
      })
      .catch((error: unknown) => {
        if (token !== renderToken.current) return;
        setStatus({
          kind: "error",
          message:
            error instanceof Error && error.message.startsWith("Unable to load")
              ? "That cat did not load. Pick it again to retry."
              : "Could not draw that one.",
        });
      });
  }, [skin, stage, background, caption, size, pixelWidth]);

  const exportImage = useCallback(async () => {
    const canvas = canvasRef.current;
    if (canvas === null) return;

    setStatus({ kind: "working", message: "Building your cat…" });
    const token = renderToken.current;
    try {
      const composition = { skin, stage, background, caption, size };
      const blob = await canvasToBlob(composition);
      const name = fileNameFor(composition);
      const file = new File([blob], name, { type: blob.type });

      // Always show the result as a real <img>: on any iOS browser where both the
      // Share API and anchor-download misbehave, long-press-save on this works.
      // It gets a DATA url, not an object url — iOS revokes or consumes the blob
      // behind anchor.download, which killed the shared object url and left this
      // element showing a broken-image icon over the cat.
      const dataUrl = await blobToDataUrl(blob);
      // Changed selection mid-encode: this result is of the previous cat, and
      // the render effect has already cleared the stage. Drop it.
      if (token !== renderToken.current) {
        setStatus(IDLE);
        return;
      }
      setPreview(dataUrl);

      // Desktop Chrome and Safari both advertise canShare({files}) and would open
      // the OS share sheet on a click — not what anyone expects from a button on a
      // web page with a mouse. Share sheet on touch, file download on desktop.
      const isTouch =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(pointer: coarse)").matches;

      if (
        isTouch &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] })
      ) {
        setStatus({ kind: "working", message: "Opening share…" });
        await navigator.share({ files: [file], title: "ULTCAT" });
        setStatus({ kind: "done", message: "Shared." });
        return;
      }

      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = name;
      anchor.click();
      // iOS finishes reading the blob well after click() returns; revoking
      // immediately produces a zero-byte or failed download.
      window.setTimeout(() => URL.revokeObjectURL(href), 60_000);
      setStatus({
        kind: "done",
        message: isTouch
          ? "Saved. Long-press the image to save again."
          : "Saved to your downloads.",
      });
    } catch (error: unknown) {
      // A cancelled share rejects with AbortError — that is the user changing
      // their mind, not a failure worth shouting about.
      if (error instanceof DOMException && error.name === "AbortError") {
        setStatus(IDLE);
        return;
      }
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Export failed.",
      });
    }
  }, [skin, stage, background, caption, size]);

  const randomise = useCallback(() => {
    const nextSkin = SKINS[Math.floor(Math.random() * SKINS.length)].id;
    const nextStage = STAGES[Math.floor(Math.random() * STAGES.length)].id;
    const nextBackground = BACKGROUNDS[Math.floor(Math.random() * (BACKGROUNDS.length - 1))].id;
    setSkin(nextSkin);
    setStage(nextStage);
    setBackground(nextBackground);
  }, []);

  const activeSkin = SKINS.find((candidate) => candidate.id === skin) ?? SKINS[0];

  return (
    <div className="gen">
      <div className="gen-stage">
        <div
          ref={wrapRef}
          className="gen-canvas-wrap"
          // Numeric ratio, because the desktop rule needs it inside calc() where
          // the `w / h` form is not a valid number. Set on the WRAP so the
          // export overlay inherits the artwork's exact box.
          style={{ "--gen-ar": size.width / size.height } as CSSProperties}
        >
          <canvas
            ref={canvasRef}
            className="gen-canvas"
            style={{ aspectRatio: `${size.width} / ${size.height}` }}
            role="img"
            aria-label={`${activeSkin.name} at ${
              STAGES.find((candidate) => candidate.id === stage)?.name ?? stage
            }`}
          />
          {preview !== null ? (
            <figure className="gen-result">
              {/* Deliberately a plain <img>: next/image cannot take a blob URL, and
                  this element is the long-press-to-save fallback. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="Your ULTCAT, ready to save"
                className="gen-result-img"
                onError={() => setPreview(null)}
              />
            </figure>
          ) : null}
        </div>

        <div className="gen-actions">
          <button
            type="button"
            className="btn btn-primary gen-go"
            onClick={() => void exportImage()}
          >
            {status.kind === "working" ? "Working…" : "Save / Share"}
          </button>
          <button type="button" className="btn gen-random" onClick={randomise}>
            Randomise
          </button>
        </div>

        <p
          className={`gen-status${status.kind === "error" ? " gen-status-error" : ""}`}
          role="status"
        >
          {status.message !== ""
            ? status.message
            : preview !== null
              ? "Long-press or right-click the image to save it again."
              : ""}
        </p>
      </div>

      <div className="gen-rail">
      <p className="gen-blurb">
        <strong>{activeSkin.name}</strong> · {activeSkin.tag} — {activeSkin.blurb}
      </p>

      <fieldset className="gen-group">
        <legend className="gen-legend">Cat</legend>
        <div className="gen-chips">
          {SKINS.map((option) => (
            <button
              key={option.id}
              type="button"
              className="gen-chip"
              aria-pressed={option.id === skin}
              onClick={() => setSkin(option.id)}
              onPointerEnter={() => prefetchSprite(option.id, stage)}
              onFocus={() => prefetchSprite(option.id, stage)}
            >
              {option.name}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="gen-group">
        <legend className="gen-legend">Power</legend>
        <div className="gen-chips">
          {STAGES.map((option) => (
            <button
              key={option.id}
              type="button"
              className="gen-chip"
              aria-pressed={option.id === stage}
              onClick={() => setStage(option.id)}
              onPointerEnter={() => prefetchSprite(skin, option.id)}
              onFocus={() => prefetchSprite(skin, option.id)}
            >
              {option.short}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="gen-group">
        <legend className="gen-legend">Background</legend>
        <div className="gen-chips">
          {BACKGROUNDS.map((option) => (
            <button
              key={option.id}
              type="button"
              className="gen-chip"
              aria-pressed={option.id === background}
              onClick={() => setBackground(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="gen-group">
        <legend className="gen-legend">Size</legend>
        <div className="gen-chips">
          {OUTPUT_SIZES.map((option) => (
            <button
              key={option.id}
              type="button"
              className="gen-chip"
              aria-pressed={option.id === size.id}
              onClick={() => setSize(option)}
            >
              {option.label}
              <span className="gen-chip-hint">{option.hint}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <label className="gen-field">
        <span className="gen-legend">Caption</span>
        <input
          type="text"
          className="gen-input"
          value={caption}
          maxLength={28}
          placeholder="Optional"
          onChange={(event) => setCaption(event.target.value)}
        />
      </label>

      <p className="gen-credit">
        Cat artwork by{" "}
        <a href={ARTIST_URL} target="_blank" rel="noopener noreferrer">
          {ARTIST_NAME}
        </a>
        .
      </p>
      </div>
    </div>
  );
}
