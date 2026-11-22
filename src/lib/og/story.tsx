/* eslint-disable @next/next/no-img-element -- next/og (satori) ne rend que <img> */
// Rendu des images partageables (next/og) : carte story 1080×1920 et image Open Graph 1200×630.
// Archivo est chargée depuis Google Fonts au rendu (TTF statique) ; next/og ne gère ni les polices variables
// ni font-stretch : le titre y est en Archivo 800 largeur normale (TODO.md).

import { ImageResponse } from "next/og";
import type { TrendView } from "@/lib/types";
import { heatLevelIndex } from "@/lib/heat/levels";
import { CATEGORY_LABEL, coolsInLabel } from "@/lib/format";
import { SITE_HOST } from "@/lib/links";
import { thermalDataUrl } from "./thermal";

const HEAT = ["#2457ff", "#7b3cff", "#e4358c", "#ff7a1a", "#ffd84d"];
const ON = ["#ffffff", "#ffffff", "#120f1e", "#120f1e", "#120f1e"];

const fontCache = new Map<number, Promise<ArrayBuffer | null>>();

/** TTF d'Archivo (graisse donnée). Un User-Agent ancien fait servir du TTF par Google Fonts. */
function archivo(weight: number): Promise<ArrayBuffer | null> {
  if (!fontCache.has(weight)) {
    fontCache.set(
      weight,
      (async () => {
        try {
          const css = await fetch(`https://fonts.googleapis.com/css2?family=Archivo:wght@${weight}`, {
            headers: { "User-Agent": "Mozilla/4.0 (compatible; MSIE 8.0)" },
            signal: AbortSignal.timeout(5000),
          }).then((r) => r.text());
          const url = /src:\s*url\(([^)]+)\)\s*format\('(?:truetype|opentype)'\)/.exec(css)?.[1];
          if (!url) return null;
          return await fetch(url, { signal: AbortSignal.timeout(5000) }).then((r) => r.arrayBuffer());
        } catch {
          return null;
        }
      })(),
    );
  }
  return fontCache.get(weight)!;
}

async function fonts() {
  const [bold, regular] = await Promise.all([archivo(800), archivo(400)]);
  const out: { name: string; data: ArrayBuffer; weight: 400 | 800; style: "normal" }[] = [];
  if (bold) out.push({ name: "Archivo", data: bold, weight: 800, style: "normal" });
  if (regular) out.push({ name: "Archivo", data: regular, weight: 400, style: "normal" });
  return out;
}

function Fallback() {
  // Repli sans photo : dégradé discret, jamais une illustration
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        background: "radial-gradient(circle at 65% 30%, #ffd84d 0%, #ff7a1a 14%, #e4358c 30%, #7b3cff 48%, #2457ff 64%, #0b0a12 85%)",
        opacity: 0.6,
      }}
    />
  );
}

export async function storyCard(trend: TrendView, size = { width: 1080, height: 1920 }): Promise<ImageResponse> {
  const lvl = heatLevelIndex(trend.heat);
  const photoH = Math.round(size.height * 0.6);
  const photo = trend.image ? await thermalDataUrl(trend.image.url, size.width, photoH, trend.cooled ? "cooled" : "thermal") : null;
  const s = size.width / 1080;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#15131f", color: "#f5f3ff", fontFamily: "Archivo", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, width: size.width, height: photoH, display: "flex" }}>
          {photo ? <img src={photo} width={size.width} height={photoH} alt="" style={{ objectFit: "cover" }} /> : <Fallback />}
          <div style={{ position: "absolute", inset: 0, display: "flex", background: "linear-gradient(180deg, rgba(11,10,18,0.55) 0%, rgba(11,10,18,0) 30%, rgba(11,10,18,0) 55%, #15131f 100%)" }} />
        </div>
        <div style={{ position: "relative", display: "flex", flexDirection: "column", height: "100%", padding: `${40 * s}px ${56 * s}px ${64 * s}px` }}>
          <div style={{ display: "flex", gap: 10 * s }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ flex: 1, height: 8 * s, borderRadius: 4, background: "#f5f3ff", opacity: i === 0 ? 1 : 0.35 }} />
            ))}
          </div>
          <div style={{ display: "flex", gap: 16 * s, marginTop: 40 * s }}>
            <div style={{ display: "flex", background: "#f5f3ff", color: "#0b0a12", fontWeight: 800, fontSize: 32 * s, padding: `${12 * s}px ${22 * s}px`, borderRadius: 999, transform: "rotate(-3deg)", textTransform: "uppercase" }}>
              {CATEGORY_LABEL[trend.category] ?? trend.category}
            </div>
            <div style={{ display: "flex", background: trend.brand_safe ? "#3ddc97" : "#ffb020", color: "#120f1e", fontWeight: 800, fontSize: 32 * s, padding: `${12 * s}px ${22 * s}px`, borderRadius: 999, transform: "rotate(2.5deg)", textTransform: "uppercase" }}>
              {trend.brand_safe ? "Brand-safe" : "Caution"}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: "auto", gap: 28 * s }}>
            <div style={{ fontSize: 150 * s, fontWeight: 800, lineHeight: 0.9, letterSpacing: -4 * s, textTransform: "lowercase" }}>{trend.title}</div>
            <div style={{ fontSize: 40 * s, lineHeight: 1.3, fontWeight: 400 }}>{trend.cooled ? "This trend has cooled." : trend.why}</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", background: trend.cooled ? "transparent" : HEAT[lvl], color: trend.cooled ? "#6e6a85" : ON[lvl], fontSize: 72 * s, fontWeight: 800, padding: `${10 * s}px ${30 * s}px`, borderRadius: 999, border: trend.cooled ? "4px solid #6e6a85" : "none" }}>
                {`${trend.heat}°`}
              </div>
              <div style={{ display: "flex", fontSize: 34 * s, color: "#a39fbd" }}>{trend.cooled ? "archive" : coolsInLabel(trend.cools_in_days)}</div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 32 * s, color: "#a39fbd", marginTop: 24 * s }}>
              <span style={{ color: "#f5f3ff", fontWeight: 800 }}>trends°</span>
              <span>{SITE_HOST}</span>
            </div>
            {trend.image ? <div style={{ display: "flex", fontSize: 22 * s, color: "#a39fbd" }}>{`Photo: ${trend.image.credit.name} on Pexels`}</div> : null}
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: await fonts() },
  );
}

export async function ogImage(trend: TrendView | null): Promise<ImageResponse> {
  const size = { width: 1200, height: 630 };
  if (!trend) {
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "#0b0a12", color: "#f5f3ff", fontFamily: "Archivo" }}>
          <div style={{ fontSize: 140, fontWeight: 800 }}>trends°</div>
          <div style={{ fontSize: 44, color: "#a39fbd" }}>The internet&apos;s weather report, for makers.</div>
          <div style={{ fontSize: 30, color: "#a39fbd", marginTop: 40 }}>Powered by upTake</div>
        </div>
      ),
      { ...size, fonts: await fonts() },
    );
  }
  const lvl = heatLevelIndex(trend.heat);
  const photo = trend.image ? await thermalDataUrl(trend.image.url, size.width, size.height, trend.cooled ? "cooled" : "thermal") : null;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#0b0a12", color: "#f5f3ff", fontFamily: "Archivo", position: "relative" }}>
        {photo ? <img src={photo} width={size.width} height={size.height} alt="" style={{ position: "absolute", inset: 0, objectFit: "cover" }} /> : <Fallback />}
        <div style={{ position: "absolute", inset: 0, display: "flex", background: "linear-gradient(90deg, rgba(11,10,18,0.94) 0%, rgba(11,10,18,0.75) 50%, rgba(11,10,18,0.1) 100%)" }} />
        <div style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 64, gap: 18, width: "100%" }}>
          <div style={{ display: "flex", fontSize: 28, fontWeight: 800, textTransform: "uppercase" }}>{trend.cooled ? "Cooled" : "Heating up"}</div>
          <div style={{ fontSize: 120, fontWeight: 800, lineHeight: 0.9, letterSpacing: -3, textTransform: "lowercase", maxWidth: 1000 }}>{trend.title}</div>
          <div style={{ fontSize: 30, maxWidth: 820, lineHeight: 1.3 }}>{trend.cooled ? "This trend has cooled." : trend.why}</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
            <div style={{ display: "flex", background: trend.cooled ? "transparent" : HEAT[lvl], color: trend.cooled ? "#6e6a85" : ON[lvl], fontSize: 56, fontWeight: 800, padding: "6px 26px", borderRadius: 999 }}>{`${trend.heat}°`}</div>
            <div style={{ display: "flex", gap: 16, fontSize: 26, color: "#a39fbd" }}>
              <span style={{ color: "#f5f3ff", fontWeight: 800 }}>trends°</span>
              <span>{SITE_HOST}</span>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: await fonts() },
  );
}
