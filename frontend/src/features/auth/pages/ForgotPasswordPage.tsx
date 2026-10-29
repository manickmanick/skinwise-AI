import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import { ApiError, apiRequest } from "../../../lib/api";

type Step = "email" | "otp" | "password" | "success";
type FieldErrors = Record<string, string>;

function emailError(value: string) {
  if (!value.trim()) return "Please enter your email address.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()))
    return "Enter a valid email address.";
  return "";
}

function maskedEmail(value: string) {
  const [name, domain] = value.split("@");
  if (!domain) return value;
  const visible = name.slice(0, 1);
  return `${visible}${"•".repeat(Math.min(8, Math.max(3, name.length - 1)))}@${domain}`;
}

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [expiresAt, setExpiresAt] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const otpRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const resetTokenRef = useRef("");

  useEffect(() => {
    if (!(["otp", "password"] as Step[]).includes(step) || expiresAt === 0)
      return;
    const update = () =>
      setSecondsLeft(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [step, expiresAt]);

  function focusFirst(fields: FieldErrors) {
    if (fields.email) emailRef.current?.focus();
    else if (fields.otp) otpRef.current?.focus();
    else if (fields.password || fields.confirmPassword)
      passwordRef.current?.focus();
  }

  async function sendOtp(event?: FormEvent) {
    event?.preventDefault();
    setFormError("");
    const issue = emailError(email);
    if (issue) {
      const next = { email: issue };
      setErrors(next);
      focusFirst(next);
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      const result = await apiRequest<{
        challengeId: string;
        expiresAt: number;
      }>("/auth/forgot-password", {
        method: "POST",
        body: { email: email.trim() },
      });
      setChallengeId(result.challengeId);
      setExpiresAt(result.expiresAt);
      setOtp("");
      setStep("otp");
      window.setTimeout(() => otpRef.current?.focus(), 0);
    } catch (error) {
      if (error instanceof ApiError && error.errors) setErrors(error.errors);
      setFormError(
        error instanceof Error
          ? error.message
          : "We couldn't send a code. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    const next: FieldErrors = {};
    if (!/^\d{6}$/.test(otp))
      next.otp = "Enter the six-digit code from your email.";
    if (secondsLeft <= 0)
      next.otp = "This code has expired. Request a new one.";
    if (Object.keys(next).length) {
      setErrors(next);
      focusFirst(next);
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      const result = await apiRequest<{
        resetToken: string;
        expiresAt: number;
      }>("/auth/verify-reset-otp", {
        method: "POST",
        body: { challengeId, otp },
      });
      resetTokenRef.current = result.resetToken;
      setResetToken(result.resetToken);
      setExpiresAt(result.expiresAt);
      setPassword("");
      setConfirmPassword("");
      setStep("password");
      window.setTimeout(() => passwordRef.current?.focus(), 0);
    } catch (error) {
      if (error instanceof ApiError && error.errors) setErrors(error.errors);
      setFormError(
        error instanceof Error
          ? error.message
          : "We couldn't verify that code.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function updatePassword(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    const next: FieldErrors = {};
    if (password.length < 10) next.password = "Use at least 10 characters.";
    else if (password.length > 128)
      next.password = "Use no more than 128 characters.";
    else if (!password.trim())
      next.password = "Password can't contain only spaces.";
    if (!confirmPassword)
      next.confirmPassword = "Please confirm your new password.";
    else if (confirmPassword !== password)
      next.confirmPassword = "The passwords don't match.";
    if (!resetTokenRef.current || Date.now() >= expiresAt)
      next.password = "Your reset authorization expired. Request a new code.";
    if (Object.keys(next).length) {
      setErrors(next);
      focusFirst(next);
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      await apiRequest("/auth/reset-password", {
        method: "POST",
        body: { resetToken, password },
      });
      resetTokenRef.current = "";
      setResetToken("");
      setOtp("");
      setPassword("");
      setConfirmPassword("");
      setStep("success");
    } catch (error) {
      if (error instanceof ApiError && error.errors) setErrors(error.errors);
      setFormError(
        error instanceof Error
          ? error.message
          : "We couldn't update your password.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page auth-page">
      <Card className="auth-card recovery-card">
        <p className="eyebrow">ACCOUNT RECOVERY</p>
        <h1>
          {step === "success" ? "Password updated." : "Reset your password."}
        </h1>
        <p className="muted">
          {step === "email" &&
            "Enter the email address linked to your SkinWise account. If it exists, we'll send a six-digit code."}
          {step === "otp" &&
            `Enter the six-digit code sent to ${maskedEmail(email)}. The code expires in two minutes.`}
          {step === "password" &&
            "Choose a new password to finish recovering your account."}
          {step === "success" &&
            "Your password has been changed. Sign in with the new password."}
        </p>
        {formError && !Object.values(errors).some(Boolean) && (
          <p className="form-error" role="alert">
            {formError}
          </p>
        )}
        {step === "email" && (
          <form className="auth-form" noValidate onSubmit={sendOtp}>
            <label htmlFor="recovery-email">
              Email address <span aria-hidden="true">*</span>
            </label>
            <input
              ref={emailRef}
              id="recovery-email"
              type="email"
              autoComplete="email"
              value={email}
              maxLength={254}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={
                errors.email ? "recovery-email-error" : undefined
              }
              onBlur={() =>
                setErrors(emailError(email) ? { email: emailError(email) } : {})
              }
              onChange={(event) => {
                setEmail(event.target.value);
                setErrors({});
                setFormError("");
              }}
              placeholder="you@example.com"
            />
            {errors.email && (
              <small
                id="recovery-email-error"
                className="field-error"
                role="alert"
              >
                {errors.email}
              </small>
            )}
            <Button type="submit" disabled={busy}>
              {busy ? "Sending…" : "Send OTP"}
            </Button>
          </form>
        )}
        {step === "otp" && (
          <form className="auth-form" noValidate onSubmit={verify}>
            <label htmlFor="recovery-otp">
              Six-digit code <span aria-hidden="true">*</span>
            </label>
            <input
              ref={otpRef}
              id="recovery-otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otp}
              maxLength={6}
              aria-invalid={Boolean(errors.otp)}
              aria-describedby={errors.otp ? "recovery-otp-error" : "otp-timer"}
              onChange={(event) => {
                setOtp(event.target.value.replace(/\D/g, "").slice(0, 6));
                setErrors({});
                setFormError("");
              }}
              placeholder="000000"
            />
            {errors.otp && (
              <small
                id="recovery-otp-error"
                className="field-error"
                role="alert"
              >
                {errors.otp}
              </small>
            )}
            <p id="otp-timer" className="muted" role="timer" aria-live="off">
              {secondsLeft > 0
                ? `Code expires in ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`
                : "Code expired. Request a new one."}
            </p>
            <Button type="submit" disabled={busy || secondsLeft <= 0}>
              {busy ? "Checking…" : "Verify code"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy || secondsLeft > 60}
              onClick={() => void sendOtp()}
            >
              {busy ? "Please wait…" : "Resend OTP"}
            </Button>
            <button
              type="button"
              className="text-link"
              onClick={() => {
                setStep("email");
                setErrors({});
                setFormError("");
              }}
            >
              Use a different email
            </button>
          </form>
        )}
        {step === "password" && (
          <form className="auth-form" noValidate onSubmit={updatePassword}>
            <p className="muted" role="timer">
              Reset authorization expires in {Math.floor(secondsLeft / 60)}:
              {String(secondsLeft % 60).padStart(2, "0")}.
            </p>
            <label htmlFor="new-password">
              New password <span aria-hidden="true">*</span>
            </label>
            <input
              ref={passwordRef}
              id="new-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              maxLength={128}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={
                errors.password ? "new-password-error" : "password-requirements"
              }
              onChange={(event) => {
                setPassword(event.target.value);
                setErrors((current) => ({ ...current, password: "" }));
                setFormError("");
              }}
            />
            {errors.password && (
              <small
                id="new-password-error"
                className="field-error"
                role="alert"
              >
                {errors.password}
              </small>
            )}
            <small id="password-requirements" className="muted">
              Use 10–128 characters. Passwords are case-sensitive.
            </small>
            <label htmlFor="confirm-password">
              Confirm new password <span aria-hidden="true">*</span>
            </label>
            <input
              id="confirm-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={confirmPassword}
              maxLength={128}
              aria-invalid={Boolean(errors.confirmPassword)}
              aria-describedby={
                errors.confirmPassword ? "confirm-password-error" : undefined
              }
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                setErrors((current) => ({ ...current, confirmPassword: "" }));
                setFormError("");
              }}
            />
            {errors.confirmPassword && (
              <small
                id="confirm-password-error"
                className="field-error"
                role="alert"
              >
                {errors.confirmPassword}
              </small>
            )}
            <label className="password-toggle">
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(event) => setShowPassword(event.target.checked)}
              />{" "}
              Show passwords
            </label>
            <Button type="submit" disabled={busy}>
              {busy ? "Updating…" : "Update password"}
            </Button>
            <button
              type="button"
              className="text-link"
              disabled={busy}
              onClick={() => {
                resetTokenRef.current = "";
                setResetToken("");
                setStep("email");
                setErrors({});
                setFormError("");
              }}
            >
              Request a new code
            </button>
          </form>
        )}
        {step === "success" && (
          <Button onClick={() => navigate("/login", { replace: true })}>
            Return to sign in
          </Button>
        )}
        {step !== "success" && (
          <p className="auth-switch">
            <Link to="/login">← Back to sign in</Link>
          </p>
        )}
      </Card>
    </main>
  );
}
