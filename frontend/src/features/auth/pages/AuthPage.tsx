import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import { useAuth } from "../../../app/auth/useAuth";

export default function AuthPage({ mode }: { mode: "login" | "register" }) {
  const { user, signIn, signUp, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const target =
    (location.state as { from?: string } | null)?.from || "/skin-profile";
  if (loading)
    return (
      <main className="page">
        <p role="status">Checking your session…</p>
      </main>
    );
  if (user) return <Navigate to="/" replace />;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") await signIn(email, password);
      else await signUp(email, password);
      navigate(target, { replace: true });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to continue. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="page auth-page">
      <Card className="auth-card">
        <p className="eyebrow">
          {mode === "login" ? "WELCOME BACK" : "YOUR PRIVATE SKIN JOURNEY"}
        </p>
        <h1>
          {mode === "login" ? "Sign in to SkinWise." : "Create your account."}
        </h1>
        <p className="muted">
          {mode === "login"
            ? "Your profile, routine and analysis history are ready when you are."
            : "Save your profile and routine. Your face photo is not stored by SkinWise."}
        </p>
        <form onSubmit={submit} className="auth-form">
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            minLength={10}
            maxLength={72}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {mode === "register" && (
            <small className="muted">Use at least 10 characters.</small>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy}>
            {busy
              ? "Please wait…"
              : mode === "login"
                ? "Sign in"
                : "Create account"}
          </Button>
        </form>
        <p className="auth-switch">
          {mode === "login" ? "New to SkinWise?" : "Already have an account?"}{" "}
          <Link to={mode === "login" ? "/register" : "/login"}>
            {mode === "login" ? "Create an account" : "Sign in"}
          </Link>
        </p>
        <Link className="text-link" to="/skin-analysis">
          Continue as a guest →
        </Link>
      </Card>
    </main>
  );
}
