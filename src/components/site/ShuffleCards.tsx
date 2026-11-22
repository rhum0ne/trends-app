"use client";

import { Shuffle } from "lucide-react";
import { useState } from "react";
import { TrendCard, type CardTrend } from "@/components/TrendCard";

/** « also heating up » : trois cartes, Shuffle en tire trois autres sans requête (toutes sont dans la page). */
export function ShuffleCards({ trends }: { trends: CardTrend[] }) {
  const [picked, setPicked] = useState(() => trends.slice(0, 3));
  const [round, setRound] = useState(0);
  if (trends.length === 0) return null;
  return (
    <div className="flex flex-col gap-5">
      <div className="grid justify-items-center gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-live="polite">
        {picked.map((t, i) => (
          <TrendCard key={`${round}-${t.slug}`} trend={t} index={i} total={picked.length} className="tr-enter w-full max-w-[300px]" />
        ))}
      </div>
      {trends.length > 3 ? (
        <button
          type="button"
          className="tr-btn line self-center"
          onClick={() => {
            const pool = [...trends];
            for (let i = pool.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [pool[i], pool[j]] = [pool[j], pool[i]];
            }
            setPicked(pool.slice(0, 3));
            setRound((r) => r + 1);
          }}
        >
          <Shuffle strokeWidth={1.75} aria-hidden="true" />
          Shuffle
        </button>
      ) : null}
    </div>
  );
}
