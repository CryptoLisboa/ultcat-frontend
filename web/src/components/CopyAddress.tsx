"use client";

import { useState } from "react";
import {
  EXPLORER_URL,
  ULTCAT_ADDRESS,
  X_SEARCH_CA_URL,
  X_SEARCH_TICKER_URL,
} from "../lib/constants";

export function CopyAddress() {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(ULTCAT_ADDRESS);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="contract-row">
      <code className="contract-address">{ULTCAT_ADDRESS}</code>
      <div className="contract-actions">
        <button type="button" className="btn btn-ghost" onClick={handleCopy}>
          {copied ? "Copied" : "Copy"}
        </button>
        <a
          className="btn btn-ghost"
          href={EXPLORER_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          Explorer
        </a>
      </div>
      <div className="buzz">
        <p className="buzz-label">See what&rsquo;s being said</p>
        <div className="buzz-row">
          <a
            className="btn btn-ghost buzz-btn"
            href={X_SEARCH_TICKER_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            $ULTCAT on X
          </a>
          <a
            className="btn btn-ghost buzz-btn"
            href={X_SEARCH_CA_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Contract on X
          </a>
        </div>
      </div>
    </div>
  );
}
