import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { TrendCard, CooledCard } from "@/components/TrendCard";
import { getArchive } from "@/lib/trends/queries";
import { formatDay } from "@/lib/format";

export const metadata: Metadata = {
  title: "Archive: the last 30 days · trends°",
  description: "The trend of the day, every day, for the last 30 days.",
  alternates: { canonical: "/archive" },
};

async function Archive() {
  await connection();
  const days = await getArchive(30);
  if (days.length === 0) return <p className="tr-muted">Nothing in the archive yet.</p>;
  return (
    <ol className="m-0 grid list-none justify-items-center gap-6 p-0 sm:grid-cols-2 lg:grid-cols-4">
      {days.map(({ day, trend }) => (
        <li key={day} className="flex w-full max-w-[300px] flex-col gap-2">
          <span className="tr-num text-sm font-bold">{formatDay(day, { weekday: "short", month: "short", day: "numeric" })}</span>
          {trend.cooled ? <CooledCard trend={trend} className="w-full" /> : <TrendCard trend={trend} className="w-full" />}
        </li>
      ))}
    </ol>
  );
}

export default function ArchivePage() {
  return (
    <div className="tr-wrap flex flex-col gap-6 py-10">
      <h1 className="tr-display m-0 text-[clamp(64px,10vw,120px)]">archive</h1>
      <p className="tr-muted m-0">The trend of the day for the last 30 days. Grey cards have cooled.</p>
      <Suspense fallback={<p className="tr-muted">Loading…</p>}>
        <Archive />
      </Suspense>
    </div>
  );
}
