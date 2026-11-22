"use client";

import Link from "next/link";
import { useState } from "react";
import { CountryTile } from "@/components/CountryTile";
import { Flag } from "@/components/Flag";
import { ThermalImage } from "@/components/ThermalImage";
import { TrendRow, type RowTrend } from "@/components/TrendRow";

export interface CountryPanelData {
  code: string;
  name: string;
  heat: number | null;
  top: (RowTrend & { rank: number })[];
}

function sentence(c: CountryPanelData): string {
  if (c.top.length === 0) return `None of today's trends is heating up in ${c.name} yet.`;
  const first = c.top[0];
  const others = c.top.length - 1;
  return `${first.title} is the hottest trend we cover in ${c.name} today${others > 0 ? `, ahead of ${others === 1 ? "one other" : `${others} others`}` : ""}.`;
}

/** « by country » : tuiles colorées par leur tendance la plus chaude ; un clic remplit le panneau. */
export function ByCountry({ countries, initial }: { countries: CountryPanelData[]; initial: string }) {
  const [selected, setSelected] = useState(countries.some((c) => c.code === initial) ? initial : (countries[0]?.code ?? ""));
  const current = countries.find((c) => c.code === selected);
  if (!current) return null;
  const first = current.top[0];
  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
        {countries.map((c) => (
          <CountryTile key={c.code} code={c.code} heat={c.heat} trendTitle={c.top[0]?.title ?? null} pressed={c.code === selected} onSelect={() => setSelected(c.code)} />
        ))}
      </div>
      <aside className="flex flex-col gap-4 rounded-[14px] bg-surface p-4" aria-live="polite" aria-label={`Trends in ${current.name}`}>
        <div className="flex items-center gap-3">
          <Flag code={current.code} size="lg" label={false} />
          <h3 className="tr-display m-0 text-[40px]">{current.name}</h3>
        </div>
        {first ? (
          <ThermalImage image={first.image} alt={first.title} category={first.category} className="aspect-[16/9] w-full rounded-[14px]" sizes="(max-width: 1024px) 100vw, 420px" />
        ) : null}
        <div className="tr-list">
          {current.top.map((t) => (
            <TrendRow key={t.slug} trend={t} rank={t.rank} />
          ))}
        </div>
        <p className="tr-muted m-0 text-sm">{sentence(current)}</p>
        <Link href={`/c/${current.code.toLowerCase()}`} className="font-bold">
          Full chart for {current.name} →
        </Link>
      </aside>
    </div>
  );
}
