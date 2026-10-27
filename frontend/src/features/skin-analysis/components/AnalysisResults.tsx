import Card from "../../../components/ui/Card";
import type { SkinAnalysisOutput } from "../types/skinAnalysis.types";
interface Props {
  output: SkinAnalysisOutput[];
}
const label = (s: string) =>
  s
    .split("_")
    .map((x) => x.charAt(0).toUpperCase() + x.slice(1))
    .join(" ");
export default function AnalysisResults({ output }: Props) {
  const metrics = output.filter(
    (x) =>
      typeof x.ui_score === "number" ||
      typeof x.raw_score === "number" ||
      typeof x.score === "number",
  );
  const skinType = output.find(
    (x) => x.type === "skin_type" && x.region === "whole",
  )?.skin_type;
  return (
    <section className="results-section">
      <div className="section-title-row">
        <div>
          <p className="eyebrow">YOUR RESULTS</p>
          <h2>Skin analysis</h2>
        </div>
        <span className="pill">Analysis complete</span>
      </div>
      {skinType && (
        <Card>
          <p className="muted">Skin type</p>
          <h3>{skinType}</h3>
        </Card>
      )}
      {!skinType && metrics.length === 0 && (
        <Card>
          <p className="muted">
            The provider completed the analysis but returned no displayable
            metrics for this image.
          </p>
        </Card>
      )}
      <div className="metrics-grid">
        {metrics.map((x, index) => (
          <Card
            key={`${x.type}:${x.region || ""}:${index}`}
            className="metric-card"
          >
            <div className="metric-heading">
              <span>
                {label(x.type)}
                {x.region ? ` · ${label(x.region)}` : ""}
              </span>
            </div>
            {typeof x.ui_score === "number" && (
              <p className="metric-value">
                UI score <strong>{x.ui_score}</strong>
              </p>
            )}
            {typeof x.raw_score === "number" && (
              <p className="metric-value">
                Raw score <strong>{Number(x.raw_score.toFixed(2))}</strong>
              </p>
            )}
            {typeof x.score === "number" && (
              <p className="metric-value">
                Score <strong>{Number(x.score.toFixed(2))}</strong>
              </p>
            )}
          </Card>
        ))}
      </div>
      <p className="muted">
        Values are shown as returned by the analysis provider. They are not
        diagnoses, and a higher or lower value should not be read as better or
        worse without provider guidance. AI skin analysis is informational, not
        a medical diagnosis.
      </p>
    </section>
  );
}
