import type { Metadata, Viewport } from "next";
import { Syne, Figtree, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Aurora } from "../components/Aurora";
import { Web3Provider } from "../components/Web3Provider";
import {
  ARTIST_HANDLE,
  ARTIST_NAME,
  ARTIST_URL,
  HEADER_BANNER_URL,
} from "../lib/constants";

const syne = Syne({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const figtree = Figtree({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const TITLE = "Ultra Cat ($ULTCAT)";
const DESCRIPTION =
  "Ultra Cat ($ULTCAT) — the cat of the Ult launch on Cronos. Live price, chart, and buy links.";

export const metadata: Metadata = {
  metadataBase: new URL("https://ultcat.com"),
  title: TITLE,
  description: DESCRIPTION,
  // The cat artwork is DRod's. Credit belongs in the document, not only in the
  // footer, so it travels with every share card and scrape.
  authors: [{ name: ARTIST_NAME, url: ARTIST_URL }],
  creator: ARTIST_NAME,
  openGraph: {
    type: "website",
    url: "https://ultcat.com",
    siteName: TITLE,
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: HEADER_BANNER_URL }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@UltraCatOnCro",
    creator: ARTIST_HANDLE,
    title: TITLE,
    description: DESCRIPTION,
    images: [HEADER_BANNER_URL],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#04070b",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${syne.variable} ${figtree.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Aurora />
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  );
}
