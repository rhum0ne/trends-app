import { Fragment, type ReactNode } from "react";

interface Props {
  /** Ligne de commande (curl…). */
  request: string;
  /** Réponse JSON d'exemple (objet sérialisable). */
  response?: unknown;
  label?: string;
}

function highlightJson(json: string): ReactNode[] {
  // Coloration minimale : clés en muted, chaînes en safe, nombres en caution.
  const out: ReactNode[] = [];
  const re = /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(json))) {
    if (m.index > last) out.push(json.slice(last, m.index));
    if (m[1] && m[2]) out.push(<span key={i++} className="k">{m[1]}</span>, m[2]);
    else if (m[1]) out.push(<span key={i++} className="s">{m[1]}</span>);
    else out.push(<span key={i++} className="h">{m[3]}</span>);
    last = re.lastIndex;
  }
  out.push(json.slice(last));
  return out;
}

/** Exemple d'appel de l'API (seul endroit où une police à chasse fixe est permise). */
export function ApiSnippet({ request, response, label }: Props) {
  return (
    <figure className="m-0 flex w-full min-w-0 flex-col gap-2">
      {label ? <figcaption className="tr-example">{label}</figcaption> : null}
      <pre className="tr-code">
        <span className="k">$ </span>
        {request}
        {response !== undefined ? (
          <Fragment>
            {"\n\n"}
            {highlightJson(JSON.stringify(response, null, 2))}
          </Fragment>
        ) : null}
      </pre>
    </figure>
  );
}
