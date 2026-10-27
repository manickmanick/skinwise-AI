import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Card from "../../../components/ui/Card";
import { apiRequest } from "../../../lib/api";
type Metric = {
  type: string;
  region?: string;
  skin_type?: string;
  ui_score?: number;
  raw_score?: number;
  score?: number;
};
type Analysis = {
  id: string;
  analyzedAt: string;
  metrics: { output: Metric[] };
};
type Comparison = {
  from: Analysis;
  to: Analysis;
  comparisons: {
    type: string;
    region: string | null;
    field: string;
    from: number;
    to: number;
    difference: number;
  }[];
};
type Summary = {
  today: { percentage: number; qualifies: boolean };
  streak: { currentStreak: number; bestStreak: number };
  analysisCount: number;
};
const nice = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
function dateLabel(value: string, timezone: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(value));
}
export default function ProgressPage() {
  const [history, setHistory] = useState<Analysis[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [olderId, setOlderId] = useState("");
  const [newerId, setNewerId] = useState("");
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  );
  useEffect(() => {
    Promise.all([
      apiRequest<{ analyses: Analysis[] }>("/progress/history"),
      apiRequest<Summary>("/progress/summary"),
      apiRequest<{ preferences: { timezone: string } }>("/skin-profile"),
    ])
      .then(([historyResult, summaryResult, profileResult]) => {
        setHistory(historyResult.analyses);
        setSummary(summaryResult);
        setTimezone(profileResult.preferences.timezone);
        if (historyResult.analyses.length >= 2) {
          setOlderId(historyResult.analyses[1].id);
          setNewerId(historyResult.analyses[0].id);
        }
      })
      .catch((e: unknown) =>
        setError(
          e instanceof Error ? e.message : "Couldn't load your progress.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!olderId || !newerId || olderId === newerId) return;
    apiRequest<Comparison>(
      `/skin-analyses/compare?from=${encodeURIComponent(olderId)}&to=${encodeURIComponent(newerId)}`,
    )
      .then(setComparison)
      .catch((e: unknown) =>
        setError(
          e instanceof Error ? e.message : "Couldn't compare those analyses.",
        ),
      );
  }, [olderId, newerId]);
  if (loading)
    return (
      <main className="page">
        <p role="status">Loading your progress…</p>
      </main>
    );
  return (
    <main className="page progress-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">YOUR JOURNEY OVER TIME</p>
          <h1>Progress, at your pace.</h1>
          <p className="page-description">
            Routine adherence and analysis metrics are shown as separate
            records.
          </p>
        </div>
        <span className="pill">Your private history</span>
      </header>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {summary && (
        <section className="progress-stat-grid" aria-label="Routine adherence">
          <Card>
            <span className="muted">Today's routine completion</span>
            <strong>{summary.today.percentage}%</strong>
            <small>
              {summary.today.qualifies
                ? "Today currently qualifies for a streak"
                : "At least 50% qualifies a day"}
            </small>
          </Card>
          <Card>
            <span className="muted">Current routine streak</span>
            <strong>{summary.streak.currentStreak} days</strong>
            <small>Based on qualifying local calendar days</small>
          </Card>
          <Card>
            <span className="muted">Best routine streak</span>
            <strong>{summary.streak.bestStreak} days</strong>
            <small>Historical checklist records</small>
          </Card>
        </section>
      )}
      {summary && (
        <Card className="analysis-count-card">
          <span className="muted">Skin analyses saved</span>
          <strong>{summary.analysisCount}</strong>
          <small>Analysis history is separate from routine adherence.</small>
        </Card>
      )}
      <section className="progress-history">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">SKIN ANALYSIS</p>
            <h2>Analysis history</h2>
          </div>
          <Link className="text-link" to="/skin-analysis">
            New analysis →
          </Link>
        </div>
        {!history.length ? (
          <Card className="progress-empty">
            <h3>Your first analysis will appear here.</h3>
            <p className="muted">
              Only analyses completed while signed in are saved to your account.
            </p>
            <Link
              className="app-button app-button--primary"
              to="/skin-analysis"
            >
              Start an analysis
            </Link>
          </Card>
        ) : (
          <div className="analysis-history-list">
            {history.map((analysis) => (
              <Card key={analysis.id} className="history-card">
                <div className="history-card-heading">
                  <div>
                    <h3>{dateLabel(analysis.analyzedAt, timezone)}</h3>
                    <small>
                      {analysis.metrics.output.length} provider metrics
                    </small>
                  </div>
                  <span className="pill">Saved</span>
                </div>
                <div className="history-metrics">
                  {analysis.metrics.output.map((metric, index) => (
                    <div key={`${metric.type}-${metric.region || ""}-${index}`}>
                      <strong>
                        {nice(metric.type)}
                        {metric.region ? ` · ${nice(metric.region)}` : ""}
                      </strong>
                      {metric.skin_type && <span>{metric.skin_type}</span>}
                      {typeof metric.ui_score === "number" && (
                        <span>UI score: {metric.ui_score}</span>
                      )}
                      {typeof metric.raw_score === "number" && (
                        <span>
                          Raw score: {Number(metric.raw_score.toFixed(2))}
                        </span>
                      )}
                      {typeof metric.score === "number" && (
                        <span>Score: {Number(metric.score.toFixed(2))}</span>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
      {history.length === 1 && (
        <Card className="insufficient-history">
          <h3>One more analysis enables comparison.</h3>
          <p className="muted">
            Your current result is saved. A second signed-in analysis lets you
            compare matching provider metrics across a date range.
          </p>
          <Link className="text-link" to="/skin-analysis">
            Start another analysis →
          </Link>
        </Card>
      )}
      {history.length >= 2 && (
        <section className="comparison-section">
          <div className="section-title-row">
            <div>
              <p className="eyebrow">LIKE-FOR-LIKE COMPARISON</p>
              <h2>Compare two analyses</h2>
            </div>
          </div>
          <Card>
            <div className="comparison-selectors">
              <label>
                Analysis A
                <select
                  value={olderId}
                  onChange={(e) => {
                    setComparison(null);
                    setOlderId(e.target.value);
                  }}
                >
                  {history.map((item) => (
                    <option key={item.id} value={item.id}>
                      {dateLabel(item.analyzedAt, timezone)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Analysis B
                <select
                  value={newerId}
                  onChange={(e) => {
                    setComparison(null);
                    setNewerId(e.target.value);
                  }}
                >
                  {history.map((item) => (
                    <option key={item.id} value={item.id}>
                      {dateLabel(item.analyzedAt, timezone)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {comparison &&
              (comparison.comparisons.length ? (
                <>
                  <p className="muted">
                    From {dateLabel(comparison.from.analyzedAt, timezone)} to{" "}
                    {dateLabel(comparison.to.analyzedAt, timezone)}
                  </p>
                  <div className="comparison-table-wrap">
                    <table className="comparison-table">
                      <thead>
                        <tr>
                          <th>Metric</th>
                          <th>Analysis A</th>
                          <th>Analysis B</th>
                          <th>Difference</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparison.comparisons.map((item) => (
                          <tr key={`${item.type}:${item.region}:${item.field}`}>
                            <th>
                              {nice(item.type)}
                              {item.region ? ` · ${nice(item.region)}` : ""} (
                              {nice(item.field)})
                            </th>
                            <td>{Number(item.from.toFixed(2))}</td>
                            <td>{Number(item.to.toFixed(2))}</td>
                            <td>
                              {item.difference > 0 ? "+" : ""}
                              {Number(item.difference.toFixed(2))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className="muted">
                  These analyses have no matching numeric fields to compare.
                </p>
              ))}
          </Card>
          <p className="muted">
            A difference does not mean medical improvement or decline, and does
            not show that routine adherence caused a change. Lighting, camera
            angle, image quality, conditions and analysis variability can affect
            results.
          </p>
        </section>
      )}
    </main>
  );
}
