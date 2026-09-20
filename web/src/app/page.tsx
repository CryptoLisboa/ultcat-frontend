import Image from "next/image";
import { BuyButtons } from "../components/BuyButtons";
import { CopyAddress } from "../components/CopyAddress";
import { Generator } from "../components/Generator";
import { LiveStats } from "../components/LiveStats";
import { SwapSlot } from "../components/SwapSlot";
import {
  ARTIST_NAME,
  ARTIST_URL,
  CHART_EMBED_URL,
  DEXSCREENER_URL,
  HEADER_BANNER_URL,
  TOKEN_LOGO_URL,
  ULTCAT_ADDRESS,
  X_URL,
} from "../lib/constants";
import { fetchLiveStats } from "../lib/dexscreener";

export default async function Home() {
  const stats = await fetchLiveStats();

  return (
    <main className="page">
      <section className="hero">
        <div className="hero-banner" aria-hidden="true">
          <Image
            src={HEADER_BANNER_URL}
            alt=""
            fill
            priority
            sizes="100vw"
            className="hero-banner-img"
          />
          <div className="hero-banner-wash" />
        </div>

        <div className="hero-inner">
          <Image
            src={TOKEN_LOGO_URL}
            alt="Ultra Cat logo"
            width={128}
            height={128}
            priority
            className="hero-logo"
          />
          <h1 className="hero-brand">
            Ultra Cat
            <span className="hero-ticker">$ULTCAT</span>
          </h1>
          <p className="hero-tagline">
            The community driven Cat on Cronos.
          </p>
          <div className="hero-ctas">
            <BuyButtons />
            <div className="hero-ctas-row">
              <a
                className="btn btn-secondary"
                href={X_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                Follow on X
              </a>
              <a
                className="btn btn-secondary"
                href={DEXSCREENER_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                View chart
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="contract-heading">
        <h2 id="contract-heading" className="section-title">
          Contract
        </h2>
        <CopyAddress />
      </section>

      <section className="section" aria-labelledby="stats-heading">
        <h2 id="stats-heading" className="section-title">
          Live stats
        </h2>
        <LiveStats stats={stats} />
      </section>

      <section className="section" aria-labelledby="chart-heading">
        <h2 id="chart-heading" className="section-title">
          Chart
        </h2>
        <div className="chart-frame">
          <iframe
            src={CHART_EMBED_URL}
            title="ULTCAT price chart (GeckoTerminal)"
            loading="lazy"
            allow="clipboard-write"
            className="chart-iframe"
          />
        </div>
      </section>

      <section className="section section-accent" aria-labelledby="swap-heading">
        <h2 id="swap-heading" className="section-title">
          Swap
        </h2>
        <SwapSlot />
      </section>

      <section className="section section-wide" aria-labelledby="generator-heading">
        <h2 id="generator-heading" className="section-title">
          Make your ULTCAT
        </h2>
        <Generator />
      </section>

      <section className="section" aria-labelledby="howto-heading">
        <h2 id="howto-heading" className="section-title">
          How to buy
        </h2>
        <ol className="howto-list">
          <li>
            <span className="howto-num">1</span>
            <div>
              <p className="howto-title">Get CRO on Cronos</p>
              <p className="howto-copy">
                Fund a Cronos wallet with CRO for gas and the swap.
              </p>
            </div>
          </li>
          <li>
            <span className="howto-num">2</span>
            <div>
              <p className="howto-title">Open Obsidian or WolfSwap</p>
              <p className="howto-copy">
                Connect the same wallet on either one.
              </p>
            </div>
          </li>
          <li>
            <span className="howto-num">3</span>
            <div>
              <p className="howto-title">Swap CRO → ULTCAT</p>
              <p className="howto-copy">
                Paste the contract{" "}
                <code className="inline-code">{ULTCAT_ADDRESS}</code> as the
                output token, or use the buy buttons above.
              </p>
            </div>
          </li>
        </ol>
      </section>

      <section className="section" aria-labelledby="about-heading">
        <h2 id="about-heading" className="section-title">
          About
        </h2>
        <div className="about-grid">
          <p className="about-shout">
            The cat went <span className="about-ult">ULT</span>ra.
          </p>
          <div>
            <p className="about-lead">
              $ULTCAT — The community driven Cat on Cronos.
            </p>
            <p className="about-copy">
              Unofficial meme. Not Ult, Not CRO. Just the cat.
            </p>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="footer-links">
          <a href={X_URL} target="_blank" rel="noopener noreferrer">
            X
          </a>
          <a href={DEXSCREENER_URL} target="_blank" rel="noopener noreferrer">
            DexScreener
          </a>
        </div>
        <p className="footer-credit">
          Cat artwork by{" "}
          <a href={ARTIST_URL} target="_blank" rel="noopener noreferrer">
            {ARTIST_NAME}
          </a>
          .
        </p>
        <p className="footer-disclaimer">
          Community page. Not affiliated with or endorsed by Ult or Cronos Labs.
          Memecoins are highly volatile; nothing here is financial advice.
        </p>
      </footer>
    </main>
  );
}
