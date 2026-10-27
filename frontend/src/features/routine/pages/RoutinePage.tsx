import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import { apiRequest } from "../../../lib/api";

type Step = {
  id: string;
  position: number;
  period: "morning" | "night";
  title: string;
  instructions: string;
  frequency: string;
  reason: string;
  caution: string | null;
  completed?: boolean;
};
type RoutineResponse = {
  routine: {
    id: string;
    version: number;
    createdAt: string;
    steps: Step[];
  } | null;
  completion: {
    date?: string;
    completed: number;
    eligible: number;
    percentage: number;
    qualifies: boolean;
  };
  completedStepIds?: string[];
  message?: string;
};
type Uv = {
  available: boolean;
  city?: string;
  country?: string;
  uvIndex?: number;
  date?: string;
  guidance?: string;
  reason?: string;
};
type Summary = {
  streak: {
    currentStreak: number;
    bestStreak: number;
    todayQualifies: boolean;
  };
};

export default function RoutinePage() {
  const [data, setData] = useState<RoutineResponse | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [uv, setUv] = useState<Uv | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyStep, setBusyStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try {
      const [routine, progress] = await Promise.all([
        apiRequest<RoutineResponse>("/routine/current"),
        apiRequest<Summary>("/progress/summary"),
      ]);
      setData(routine);
      setSummary(progress);
      try {
        setUv(await apiRequest<Uv>("/environment/uv"));
      } catch {
        setUv(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load your routine.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);
  async function generate() {
    setBusy(true);
    setError(null);
    try {
      await apiRequest("/routine/generate", { method: "POST", body: {} });
      await load();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Couldn't generate your routine.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function toggle(step: Step) {
    if (!data || busyStep) return;
    setBusyStep(step.id);
    setError(null);
    const checked = !step.completed;
    setData((current) =>
      current
        ? {
            ...current,
            routine: current.routine
              ? {
                  ...current.routine,
                  steps: current.routine.steps.map((item) =>
                    item.id === step.id
                      ? { ...item, completed: checked }
                      : item,
                  ),
                }
              : null,
            completion: {
              ...current.completion,
              completed: current.completion.completed + (checked ? 1 : -1),
              percentage: current.completion.eligible
                ? Math.round(
                    ((current.completion.completed + (checked ? 1 : -1)) /
                      current.completion.eligible) *
                      100,
                  )
                : 0,
            },
          }
        : current,
    );
    try {
      const completion = await apiRequest<RoutineResponse["completion"]>(
        `/routine/completions/${encodeURIComponent(step.id)}`,
        {
          method: "PUT",
          body: { completed: checked },
        },
      );
      setData((current) => (current ? { ...current, completion } : current));
      const progress = await apiRequest<Summary>("/progress/summary");
      setSummary(progress);
    } catch (e) {
      await load();
      setError(e instanceof Error ? e.message : "Couldn't update this step.");
    } finally {
      setBusyStep(null);
    }
  }
  if (loading)
    return (
      <main className="page">
        <p role="status">Loading your routine…</p>
      </main>
    );
  const steps = data?.routine?.steps || [];
  return (
    <main className="page routine-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">YOUR DAILY ROUTINE</p>
          <h1>Small steps, every day.</h1>
          <p className="page-description">
            Your checklist is saved to your account and uses your timezone
            calendar day.
          </p>
        </div>
        <span className="pill">
          {data?.routine
            ? `Routine v${data.routine.version}`
            : "Set up required"}
        </span>
      </header>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {!data?.routine ? (
        <Card className="routine-empty">
          <h2>Start with your skin profile</h2>
          <p className="muted">
            Share a few self-reported preferences. We use conservative routine
            categories and do not recommend specific products.
          </p>
          <Link className="app-button app-button--secondary" to="/skin-profile">
            Complete skin profile
          </Link>
          <Button disabled={busy} onClick={() => void generate()}>
            {busy ? "Creating…" : "Generate my routine"}
          </Button>
        </Card>
      ) : (
        <>
          <section
            className="routine-dashboard"
            aria-label="Today's routine progress"
          >
            <Card>
              <span className="eyebrow">TODAY</span>
              <strong className="routine-percent">
                {data.completion.percentage}%
              </strong>
              <span>
                {data.completion.completed} of {data.completion.eligible} steps
              </span>
            </Card>
            <Card>
              <span className="eyebrow">CURRENT STREAK</span>
              <strong className="routine-percent">
                {summary?.streak.currentStreak || 0}
              </strong>
              <span>qualifying days</span>
            </Card>
            <Card>
              <span className="eyebrow">BEST STREAK</span>
              <strong className="routine-percent">
                {summary?.streak.bestStreak || 0}
              </strong>
              <span>qualifying days</span>
            </Card>
          </section>
          {summary && (
            <p className="muted streak-note">
              {summary.streak.todayQualifies
                ? "Today currently meets the 50% streak threshold."
                : "Complete at least half of today's steps for this day to qualify."}
            </p>
          )}
          <div className="routine-notice">
            <span aria-hidden="true">✦</span>
            <p>
              This general cosmetic guidance is not a diagnosis or treatment
              plan. If products cause discomfort, stop using them and seek
              professional advice when needed.
            </p>
          </div>
          {uv && (
            <Card className="uv-card">
              <h2>Local UV guidance</h2>
              <p>
                {uv.available ? (
                  <>
                    <strong>
                      UV index {uv.uvIndex} · {uv.city}
                      {uv.country ? `, ${uv.country}` : ""}
                    </strong>{" "}
                    — {uv.guidance} <small>{uv.date}</small>
                  </>
                ) : (
                  uv.reason
                )}
              </p>
              <small>
                Forecast from{" "}
                <a
                  href="https://open-meteo.com/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open-Meteo
                </a>
                .
              </small>
            </Card>
          )}
          <div className="routine-grid">
            {(["morning", "night"] as const).map((period) => (
              <Card className="routine-column" key={period}>
                <div className="routine-column-heading">
                  <span className="icon-tile">
                    {period === "morning" ? "☼" : "☾"}
                  </span>
                  <div>
                    <h2>{period === "morning" ? "Morning" : "Night"}</h2>
                    <p className="muted">
                      {period === "morning"
                        ? "A gentle start"
                        : "A simple wind-down"}
                    </p>
                  </div>
                </div>
                <div className="routine-steps">
                  {steps
                    .filter((step) => step.period === period)
                    .map((step) => (
                      <article
                        className={`routine-step checklist-step${step.completed ? " is-complete" : ""}`}
                        key={step.id}
                      >
                        <label className="routine-check">
                          <input
                            type="checkbox"
                            checked={Boolean(step.completed)}
                            disabled={busyStep !== null}
                            onChange={() => void toggle(step)}
                          />
                          <span className="sr-only">
                            Mark {step.title} complete
                          </span>
                        </label>
                        <div>
                          <h3>{step.title}</h3>
                          <p>{step.instructions}</p>
                          <small>
                            <strong>Why this step:</strong> {step.reason}
                          </small>
                          <small>
                            <strong>Frequency:</strong> {step.frequency}
                          </small>
                          {step.caution && (
                            <small className="routine-caution">
                              <strong>Note:</strong> {step.caution}
                            </small>
                          )}
                        </div>
                      </article>
                    ))}
                </div>
              </Card>
            ))}
          </div>
          <div className="routine-regenerate">
            <p className="muted">
              Updating your profile can change future routines. Past checklists
              remain linked to the routine you had that day. When replacing an
              active routine, today's checklist keeps its existing version; the
              new version starts next local day.
            </p>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => void generate()}
            >
              {busy ? "Updating…" : "Generate an updated routine"}
            </Button>
          </div>
        </>
      )}
    </main>
  );
}
