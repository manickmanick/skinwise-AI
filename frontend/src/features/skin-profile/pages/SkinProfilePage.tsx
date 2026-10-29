import { useEffect, useRef, useState, type FormEvent } from "react";
import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
import { ApiError, apiRequest } from "../../../lib/api";
import { useAuth } from "../../../app/auth/useAuth";
import { useNavigate } from "react-router-dom";

const concernOptions = [
  ["acne", "Acne & breakouts"],
  ["pigmentation", "Pigmentation"],
  ["dryness", "Dryness"],
  ["oiliness", "Oiliness"],
  ["sensitivity", "Sensitivity"],
  ["other", "Other"],
];
const goalOptions = [
  ["simple-routine", "Keep my routine simple"],
  ["hydration", "Support hydration"],
  ["sun-protection", "Build sun-protection habits"],
  ["comfort", "Support skin comfort"],
  ["even-tone", "Even-looking tone"],
];
type Profile = {
  skinType: string;
  concerns: string[];
  allergies: string[];
  sensitivity: string;
  goals: string[];
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
const emptyProfile: Profile = {
  skinType: "unsure",
  concerns: [],
  allergies: [],
  sensitivity: "unsure",
  goals: [],
};

export default function SkinProfilePage() {
  const { deleteAccount } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  );
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [uv, setUv] = useState<Uv | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const allergyRef = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLInputElement>(null);
  const timezoneRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    apiRequest<{
      profile: Profile | null;
      preferences: { timezone: string; city: string | null };
    }>("/skin-profile")
      .then(({ profile: savedProfile, preferences }) => {
        if (savedProfile) setProfile(savedProfile);
        setTimezone(preferences.timezone);
        setCity(preferences.city || "");
      })
      .catch((e: unknown) =>
        setError(
          e instanceof Error ? e.message : "Couldn't load your profile.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);
  function update<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
    setSaved(false);
    setReviewing(false);
  }
  function timezoneIssue(value: string) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
      return "";
    } catch {
      return "Enter a valid timezone, such as Asia/Kolkata.";
    }
  }
  function toggleList(key: "concerns" | "goals", item: string) {
    update(
      key,
      profile[key].includes(item)
        ? profile[key].filter((value) => value !== item)
        : [...profile[key], item],
    );
  }
  async function save() {
    setBusy(true);
    setError(null);
    try {

      await apiRequest("/skin-profile", {
        method: "PUT",
        body: {
          skinType: profile.skinType,
          concerns: profile.concerns,
          allergies: profile.allergies,
          sensitivity: profile.sensitivity,
          goals: profile.goals,
          timezone,
          city: city.trim() || null,
        },
      });
      setSaved(true);
      setReviewing(false);
    } catch (e) {
      if (e instanceof ApiError && e.errors) {
        const mapped = Object.fromEntries(
          Object.entries(e.errors).map(([key, value]) => [
            key.split(".")[0],
            value,
          ]),
        );
        setFieldErrors(mapped);
        if (mapped.allergies) allergyRef.current?.focus();
        else if (mapped.city) cityRef.current?.focus();
        else if (mapped.timezone) timezoneRef.current?.focus();
      } else
        setError(
          e instanceof Error ? e.message : "Couldn't save your profile.",
        );
    } finally {
      setBusy(false);
    }
  }
  async function showCityUv() {
    setBusy(true);
    setUv(null);
    setError(null);
    try {
      setUv(
        await apiRequest<Uv>(
          `/environment/uv${city.trim() ? `?city=${encodeURIComponent(city.trim())}` : ""}`,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "UV guidance is unavailable.");
    } finally {
      setBusy(false);
    }
  }
  async function requestLocationUv() {
    setError(null);
    setUv(null);
    if (!navigator.geolocation) {
      setUv({
        available: false,
        reason: "Location is not available in this browser.",
      });
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          setUv(
            await apiRequest<Uv>(
              `/environment/uv?latitude=${coords.latitude}&longitude=${coords.longitude}`,
            ),
          );
        } catch (e) {
          setError(
            e instanceof Error ? e.message : "UV guidance is unavailable.",
          );
        } finally {
          setBusy(false);
        }
      },
      (e) => {
        setUv({
          available: false,
          reason:
            e.code === e.PERMISSION_DENIED
              ? "Location permission was declined. You can enter a city instead."
              : "We couldn't read your location. You can enter a city instead.",
        });
        setBusy(false);
      },
      { timeout: 10000, maximumAge: 300000 },
    );
  }
  async function removeAccount() {
    if (
      !window.confirm(
        "Delete your SkinWise account and its saved profile, analyses, routine and checklist history? This cannot be undone.",
      )
    )
      return;
    setDeleting(true);
    setError(null);
    try {
      await deleteAccount();
      navigate("/", { replace: true });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Couldn't delete your account.",
      );
      setDeleting(false);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (profile.allergies.length > 20)
      next.allergies = "List up to 20 items, separated by commas.";
    else if (profile.allergies.some((item) => item.length > 80))
      next.allergies = "Keep each item to 80 characters or fewer.";
    if (city.length > 120)
      next.city = "Keep the city name to 120 characters or fewer.";
    const timezoneError = timezoneIssue(timezone);
    if (timezoneError) next.timezone = timezoneError;
    if (Object.keys(next).length) {
      setFieldErrors(next);
      if (next.allergies) allergyRef.current?.focus();
      else if (next.city) cityRef.current?.focus();
      else timezoneRef.current?.focus();
      return;
    }
    setFieldErrors({});
    setReviewing(true);
    setError(null);
  }
  if (loading)
    return (
      <main className="page">
        <p role="status">Loading your saved profile…</p>
      </main>
    );
  const allergyText = profile.allergies.join(", ");
  return (
    <main className="page profile-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">YOUR SELF-REPORTED DETAILS</p>
          <h1>Your skin profile.</h1>
          <p className="page-description">
            These answers help shape a conservative routine. They are
            self-reported preferences, not medically verified information.
          </p>
        </div>
        <span className="pill">Saved to your account</span>
      </header>
      <form className="profile-layout" noValidate onSubmit={submit}>
        <div className="profile-main">
          <Card>
            <p className="eyebrow">01 / SKIN TYPE</p>
            <h2>How would you describe your skin?</h2>
            <div className="choice-grid">
              {[
                ["oily", "Oily"],
                ["dry", "Dry"],
                ["combination", "Combination"],
                ["normal", "Normal"],
                ["unsure", "Not sure"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`choice-card${profile.skinType === value ? " choice-card-selected" : ""}`}
                  onClick={() => update("skinType", value)}
                  aria-pressed={profile.skinType === value}
                >
                  {label}
                </button>
              ))}
            </div>
          </Card>
          <Card>
            <p className="eyebrow">02 / CONCERNS & GOALS</p>
            <h2>What would you like your routine to focus on?</h2>
            <p className="muted">
              Choose only what is useful to you. You can change this later.
            </p>
            <div className="concern-grid">
              {concernOptions.map(([value, label]) => (
                <label className="check-choice" key={value}>
                  <input
                    type="checkbox"
                    checked={profile.concerns.includes(value)}
                    onChange={() => toggleList("concerns", value)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <h3 className="subsection-heading">Your goals</h3>
            <div className="concern-grid">
              {goalOptions.map(([value, label]) => (
                <label className="check-choice" key={value}>
                  <input
                    type="checkbox"
                    checked={profile.goals.includes(value)}
                    onChange={() => toggleList("goals", value)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </Card>
          <Card>
            <p className="eyebrow">03 / SENSITIVITY & AVOIDANCES</p>
            <h2>Help us keep your routine comfortable.</h2>
            <div className="form-field">
              <label htmlFor="sensitivity">
                How often do skincare products feel irritating?
              </label>
              <select
                id="sensitivity"
                value={profile.sensitivity}
                onChange={(e) => update("sensitivity", e.target.value)}
              >
                <option value="unsure">Not sure</option>
                <option value="often">Often</option>
                <option value="sometimes">Sometimes</option>
                <option value="rarely">Rarely</option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="allergies">
                Known allergies or ingredients you want to avoid
              </label>
              <input
                ref={allergyRef}
                id="allergies"
                value={allergyText}
                onChange={(e) =>
                  update(
                    "allergies",
                    e.target.value
                      .split(",")
                      .map((item) => item.trim())
                      .filter(Boolean),
                  )
                }
                maxLength={1600}
                aria-invalid={Boolean(fieldErrors.allergies)}
                aria-describedby={
                  fieldErrors.allergies ? "allergies-error" : "allergies-help"
                }
                onBlur={() => {
                  const issue =
                    profile.allergies.length > 20
                      ? "List up to 20 items, separated by commas."
                      : profile.allergies.some((item) => item.length > 80)
                        ? "Keep each item to 80 characters or fewer."
                        : "";
                  setFieldErrors((current) => ({
                    ...current,
                    allergies: issue,
                  }));
                }}
                placeholder="Separate items with commas"
              />
              {fieldErrors.allergies && (
                <small
                  id="allergies-error"
                  className="field-error"
                  role="alert"
                >
                  {fieldErrors.allergies}
                </small>
              )}
              <small id="allergies-help" className="muted">
                Routine steps use categories, not brand ingredients. Check
                product labels and avoid anything you list here.
              </small>
            </div>
          </Card>
          <Card>
            <p className="eyebrow">04 / OPTIONAL LOCAL SUN GUIDANCE</p>
            <h2>Choose a city</h2>
            <p className="muted">
              Your city is used only to request a daily UV forecast. You can
              clear it anytime. You can also request one-time browser location
              access; precise coordinates are not saved.
            </p>
            <div className="form-field">
              <label htmlFor="city">City (optional)</label>
              <input
                ref={cityRef}
                id="city"
                maxLength={120}
                value={city}
                onChange={(e) => {
                  setCity(e.target.value);
                  setUv(null);
                  setFieldErrors((current) => ({ ...current, city: "" }));
                }}
                aria-invalid={Boolean(fieldErrors.city)}
                aria-describedby={fieldErrors.city ? "city-error" : undefined}
                onBlur={() =>
                  setFieldErrors((current) => ({
                    ...current,
                    city:
                      city.length > 120
                        ? "Keep the city name to 120 characters or fewer."
                        : "",
                  }))
                }
                placeholder="e.g. Bengaluru"
              />
              {fieldErrors.city && (
                <small id="city-error" className="field-error" role="alert">
                  {fieldErrors.city}
                </small>
              )}
            </div>
            <div className="form-field">
              <label htmlFor="timezone">Your timezone</label>
              <input
                ref={timezoneRef}
                id="timezone"
                value={timezone}
                onChange={(e) => {
                  setTimezone(e.target.value);
                  setFieldErrors((current) => ({ ...current, timezone: "" }));
                }}
                aria-invalid={Boolean(fieldErrors.timezone)}
                aria-describedby={
                  fieldErrors.timezone ? "timezone-error" : undefined
                }
                onBlur={() =>
                  setFieldErrors((current) => ({
                    ...current,
                    timezone: timezoneIssue(timezone),
                  }))
                }
                placeholder="Asia/Kolkata"
              />
              {fieldErrors.timezone && (
                <small id="timezone-error" className="field-error" role="alert">
                  {fieldErrors.timezone}
                </small>
              )}
            </div>
            <div className="analyze-actions">
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => void showCityUv()}
              >
                Check city UV
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => void requestLocationUv()}
              >
                Use my location once
              </Button>
              <Button
                type="button"
                variant="quiet"
                onClick={() => {
                  setCity("");
                  setUv(null);
                }}
              >
                Clear city
              </Button>
            </div>
            {uv && (
              <p className="uv-guidance" role="status">
                {uv.available ? (
                  <>
                    <strong>
                      UV index {uv.uvIndex} · {uv.city}
                      {uv.country ? `, ${uv.country}` : ""}
                    </strong>
                    <br />
                    {uv.guidance}
                    <br />
                    <small>{uv.date}</small>
                  </>
                ) : (
                  uv.reason
                )}
              </p>
            )}
            <small>
              Forecast data from{" "}
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
        </div>
        <aside className="profile-aside">
          <Card>
            <span className="icon-tile">♡</span>
            <h2>Review before saving</h2>
            <p className="muted">
              Your answers are saved privately to your account and can be
              updated anytime.
            </p>
            <div className="profile-summary">
              <div>
                <span>Skin type</span>
                <strong>{profile.skinType}</strong>
              </div>
              <div>
                <span>Concerns</span>
                <strong>{profile.concerns.length}</strong>
              </div>
              <div>
                <span>Goals</span>
                <strong>{profile.goals.length}</strong>
              </div>
              <div>
                <span>Allergy notes</span>
                <strong>{profile.allergies.length}</strong>
              </div>
            </div>
            {error && !Object.values(fieldErrors).some(Boolean) && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            {saved && (
              <p className="success-message" role="status">
                Your profile is saved.
              </p>
            )}
            {reviewing ? (
              <div className="review-box">
                <h3>Confirm your answers</h3>
                <p>
                  <strong>Skin type:</strong> {profile.skinType}
                </p>
                <p>
                  <strong>Sensitivity:</strong> {profile.sensitivity}
                </p>
                <p>
                  <strong>Concerns:</strong>{" "}
                  {profile.concerns.join(", ") || "None selected"}
                </p>
                <p>
                  <strong>Goals:</strong>{" "}
                  {profile.goals.join(", ") || "None selected"}
                </p>
                <p>
                  <strong>Avoidances:</strong>{" "}
                  {profile.allergies.join(", ") || "None listed"}
                </p>
                <p>
                  <strong>City:</strong> {city || "Not set"}
                </p>
                <p>
                  <strong>Timezone:</strong> {timezone}
                </p>
                <Button
                  type="button"
                  onClick={() => void save()}
                  disabled={busy}
                >
                  {busy ? "Saving…" : "Confirm and save"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setReviewing(false)}
                >
                  Back to edit
                </Button>
              </div>
            ) : (
              <Button type="submit">Review my answers</Button>
            )}
          </Card>
          <Card className="account-delete">
            <h2>Delete your account</h2>
            <p className="muted">
              This permanently removes your saved data and signs out all active
              sessions.
            </p>
            <Button
              type="button"
              variant="danger"
              disabled={deleting}
              onClick={() => void removeAccount()}
            >
              {deleting ? "Deleting…" : "Delete account and data"}
            </Button>
          </Card>
        </aside>
      </form>
    </main>
  );
}
