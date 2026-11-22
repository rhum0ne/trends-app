import { clampHeat, heatLevelIndex } from "@/lib/heat/levels";

interface Props {
  heat: number;
  size?: "md" | "xl";
  cooled?: boolean;
  className?: string;
}

/** Le degré, coloré par niveau (classe tr-heat l0…l4). */
export function HeatBadge({ heat, size = "md", cooled = false, className = "" }: Props) {
  const h = clampHeat(heat);
  const cls = ["tr-heat", cooled ? "cooled" : `l${heatLevelIndex(h)}`, size === "xl" ? "xl" : "", className]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={cls} aria-label={`${h} degrees`}>
      {h}
      <span aria-hidden="true">°</span>
    </span>
  );
}

export function HeatScale({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex flex-col gap-2" aria-label="Heat scale from cold to scorching">
      <div className="tr-scale">
        <span className="s0" />
        <span className="s1" />
        <span className="s2" />
        <span className="s3" />
        <span className="s4" />
      </div>
      <div className="tr-scale-labels">
        <span>cold{compact ? "" : " 0°"}</span>
        <span>mild{compact ? "" : " 40°"}</span>
        <span>warm{compact ? "" : " 60°"}</span>
        <span>hot{compact ? "" : " 75°"}</span>
        <span>scorching{compact ? "" : " 90°"}</span>
      </div>
    </div>
  );
}
