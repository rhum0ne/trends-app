import Link from "next/link";
import { heatLevelIndex } from "@/lib/heat/levels";

export interface TickerItem {
  slug: string;
  title: string;
  heat: number;
  heat_change?: number;
}

/** Bandeau LIVE en haut de chaque page : tendances du jour et leur degré, défilement continu. */
export function Ticker({ items, label = "LIVE" }: { items: TickerItem[]; label?: string }) {
  if (items.length === 0) {
    return (
      <div className="tr-ticker" role="region" aria-label="Live heat ticker">
        <span className="tr-live">{label}</span>
        <span className="tr-muted text-xs">Today&apos;s forecast is being prepared.</span>
      </div>
    );
  }
  // Piste doublée pour une boucle continue ; la copie est cachée aux lecteurs d'écran.
  const track = (hidden: boolean) =>
    items.map((it) => (
      <span key={`${hidden ? "h" : "v"}-${it.slug}`} aria-hidden={hidden || undefined}>
        <Link href={`/t/${it.slug}`} tabIndex={hidden ? -1 : undefined}>
          <b>{it.title}</b>
          <em className={`tr-heat l${heatLevelIndex(it.heat)}`}>{it.heat}°</em>
          {typeof it.heat_change === "number" && it.heat_change !== 0 ? (
            <span className="tr-muted"> {it.heat_change > 0 ? `▲${it.heat_change}` : `▼${Math.abs(it.heat_change)}`}</span>
          ) : null}
        </Link>
      </span>
    ));
  return (
    <div className="tr-ticker" role="region" aria-label="Live heat ticker">
      <span className="tr-live">{label}</span>
      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="tr-track">
          {track(false)}
          {track(true)}
        </div>
      </div>
    </div>
  );
}
