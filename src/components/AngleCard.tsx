import { PenLine } from "lucide-react";
import type { Angle, TrendImage } from "@/lib/types";
import { ThermalImage } from "./ThermalImage";
import { Sticker } from "./Sticker";
import { CopyButton } from "./CopyButton";
import { UPTAKE_WRITE_URL } from "@/lib/links";

interface Props {
  angle: Angle;
  image: TrendImage | null;
  category: string;
  trendTitle: string;
  index?: number;
  example?: boolean;
  withPhoto?: boolean;
}

/** Idée de post : photo, sticker, titre, exemple, réseaux conseillés, « Copy » / « Write it in upTake ». */
export function AngleCard({ angle, image, category, trendTitle, index = 0, example = false, withPhoto = true }: Props) {
  return (
    <article className="tr-angle">
      {withPhoto ? (
        <ThermalImage
          image={image}
          alt={`${trendTitle}, post angle ${index + 1}`}
          category={category}
          className="aspect-[16/7] w-full"
          sizes="(max-width: 760px) 100vw, 400px"
        />
      ) : null}
      <div className="body">
        <div className="flex items-center justify-between gap-2">
          <Sticker variant={index % 2 ? "r" : "default"}>{angle.tag}</Sticker>
          {example ? <span className="tr-example">Example</span> : null}
        </div>
        <h4>{angle.title}</h4>
        <blockquote>{angle.example}</blockquote>
        <p className="tr-muted m-0 text-[13px]">Fits: {angle.fits}</p>
        <div className="mt-auto flex flex-wrap gap-2">
          <CopyButton text={angle.example} />
          <a className="tr-btn ink small" href={UPTAKE_WRITE_URL} target="_blank" rel="noopener">
            <PenLine strokeWidth={1.75} aria-hidden="true" />
            Write it in upTake
          </a>
        </div>
      </div>
    </article>
  );
}
