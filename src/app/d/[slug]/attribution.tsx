"use client";

import { useEffect } from "react";

type Attribution = { src: string | null; ref: string | null };

const key = (slug: string) => `pv:attr:${slug}`;

function safeGet(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function safeSet(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {
    // private mode etc.
  }
}

/** The link's ?src= / ?ref= if present, otherwise whatever link first brought this browser here. */
export function readAttribution(slug: string, fromUrl: Attribution): Attribution {
  if (fromUrl.src || fromUrl.ref) return fromUrl;
  try {
    const stored = safeGet(key(slug));
    return stored ? (JSON.parse(stored) as Attribution) : fromUrl;
  } catch {
    return fromUrl;
  }
}

/** Remembers how this visitor arrived and records one visit per browser for the funnel. */
export function AttributionTracker({ slug, src, refCode }: { slug: string; src: string | null; refCode: string | null }) {
  useEffect(() => {
    if (src || refCode) safeSet(key(slug), JSON.stringify({ src, ref: refCode }));
    const attr = readAttribution(slug, { src, ref: refCode });

    let visitorId = safeGet("pv:vid");
    if (!visitorId) {
      visitorId = crypto.randomUUID();
      safeSet("pv:vid", visitorId);
    }
    fetch("/api/visit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug, visitorId, ...attr }),
      keepalive: true,
    }).catch(() => {});
  }, [slug, src, refCode]);
  return null;
}
