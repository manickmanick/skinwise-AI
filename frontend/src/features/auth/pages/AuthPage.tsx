import { useRef, useState, type FormEvent } from "react";
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
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
    setError(null);
    const next: Record<string, string> = {};
    if (!email.trim()) next.email = "Please enter your email address.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      next.email = "Enter a valid email address.";
    if (!password) next.password = "Please enter your password.";
    else if (mode === "register" && password.trim().length === 0)
      next.password = "Password can't contain only spaces.";
    else if (mode === "register" && password.length < 10)
      next.password = "Use at least 10 characters.";
    else if (password.length > 128)
      next.password = "Use no more than 128 characters.";
    if (Object.keys(next).length) {
      setFieldErrors(next);
      if (next.email) emailRef.current?.focus();
      else passwordRef.current?.focus();
      return;
    }
    setBusy(true);
    setFieldErrors({});
    try {
      if (mode === "login") await signIn(email, password);
      else await signUp(email, password);
      navigate(target, { replace: true });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to continue. Try again.",
      );
      const apiFields = (e as { errors?: Record<string, string> }).errors;
      if (apiFields) {
        setFieldErrors(apiFields);
        if (apiFields.email) emailRef.current?.focus();
        else if (apiFields.password) passwordRef.current?.focus();
      }
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
        <form noValidate onSubmit={submit} className="auth-form">
          <label htmlFor="email">
            Email address <span aria-hidden="true">*</span>
          </label>
          <input
            ref={emailRef}
            id="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={
              fieldErrors.email ? "auth-email-error" : undefined
            }
            value={email}
            onBlur={() => {
              if (!email.trim())
                setFieldErrors((current) => ({
                  ...current,
                  email: "Please enter your email address.",
                }));
              else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
                setFieldErrors((current) => ({
                  ...current,
                  email: "Enter a valid email address.",
                }));
            }}
            onChange={(e) => {
              setEmail(e.target.value);
              setFieldErrors((current) => ({ ...current, email: "" }));
              setError(null);
            }}
          />
          {fieldErrors.email && (
            <small id="auth-email-error" className="field-error" role="alert">
              {fieldErrors.email}
            </small>
          )}
          <label htmlFor="password">
            Password <span aria-hidden="true">*</span>
          </label>
          <input
            ref={passwordRef}
            id="password"
            type="password"
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            maxLength={128}
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={
              fieldErrors.password
                ? "auth-password-error"
                : mode === "register"
                  ? "auth-password-help"
                  : undefined
            }
            value={password}
            onBlur={() => {
              if (!password && mode === "login")
                setFieldErrors((current) => ({
                  ...current,
                  password: "Please enter your password.",
                }));
              else if (mode === "register" && password.trim().length === 0)
                setFieldErrors((current) => ({
                  ...current,
                  password: "Password can't contain only spaces.",
                }));
              else if (mode === "register" && password.length < 10)
                setFieldErrors((current) => ({
                  ...current,
                  password: "Use at least 10 characters.",
                }));
            }}
            onChange={(e) => {
              setPassword(e.target.value);
              setFieldErrors((current) => ({ ...current, password: "" }));
              setError(null);
            }}
          />
          {fieldErrors.password && (
            <small
              id="auth-password-error"
              className="field-error"
              role="alert"
            >
              {fieldErrors.password}
            </small>
          )}
          {mode === "register" && (
            <small id="auth-password-help" className="muted">
              Use 10–128 characters.
            </small>
          )}
          {error && !Object.values(fieldErrors).some(Boolean) && (
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
        {mode === "login" && (
          <p className="auth-switch">
            <Link to="/forgot-password">Forgot password?</Link>
          </p>
        )}
        <Link className="text-link" to="/skin-analysis">
          Continue as a guest →
        </Link>
      </Card>
    </main>
  );
}
