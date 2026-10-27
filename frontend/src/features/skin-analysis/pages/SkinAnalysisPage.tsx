import { useState } from "react";
import { Link } from "react-router-dom";
import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
import ImageUploader from "../components/ImageUploader";
import AnalysisStatus from "../components/AnalysisStatus";
import AnalysisResults from "../components/AnalysisResults";
import { useSkinAnalysis } from "../hooks/useSkinAnalysis";
import { useAuth } from "../../../app/auth/useAuth";

export default function SkinAnalysisPage() {
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [uploaderKey, setUploaderKey] = useState(0);
  const { data, loading, error, runAnalysis, reset } = useSkinAnalysis();
  const { user } = useAuth();
  function selectFile(next: File | null) {
    setFile(next);
    setConsent(false);
    reset();
  }
  async function analyze() {
    if (file && !loading) await runAnalysis(file);
  }
  return (
    <main className="page skin-analysis-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">YOUR SKIN JOURNEY / STEP 01</p>
          <h1>Understand your skin.</h1>
          <p className="page-description">
            Use one clear photo to receive cosmetic skin metrics from our
            analysis provider. No account is required.
          </p>
        </div>
        <span className="pill">
          {data?.analysisId
            ? "Saved to your account"
            : user
              ? "Signed-in analysis"
              : "Guest analysis"}
        </span>
      </header>
      <div className="analysis-layout">
        <div className="analysis-content">
          <ImageUploader
            key={uploaderKey}
            onSelect={selectFile}
            disabled={loading}
          />
          <label className="consent-check">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              disabled={!file || loading}
            />
            <span>
              I understand my photo will be sent to YouCam for analysis. As a
              guest, the result stays only in this browser session. If signed
              in, SkinWise saves supported metrics to my account, but does not
              keep the photo.
            </span>
          </label>
          <div className="analyze-actions">
            <Button disabled={!file || !consent || loading} onClick={analyze}>
              {loading ? "Analyzing…" : "Analyze my skin"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setFile(null);
                reset();
                setConsent(false);
                setUploaderKey((key) => key + 1);
              }}
              disabled={!file || loading}
            >
              Start over
            </Button>
          </div>
          <AnalysisStatus
            loading={loading}
            error={error}
            canRetry={Boolean(file)}
            onRetry={analyze}
          />
          {data && (
            <>
              <AnalysisResults
                output={
                  Array.isArray(data.results?.output) ? data.results.output : []
                }
              />
              {!user && (
                <Card className="guest-result-cta">
                  <h2>Keep your journey in one place</h2>
                  <p className="muted">
                    Create an account to save future analysis metrics, your
                    profile and routine. This guest result is temporary.
                  </p>
                  <Link
                    className="app-button app-button--primary"
                    to="/register"
                  >
                    Create an account →
                  </Link>
                </Card>
              )}
            </>
          )}
        </div>
        <aside className="analysis-aside">
          <Card>
            <span className="icon-tile">✦</span>
            <h2>For a clearer photo</h2>
            <ul className="guidance-list">
              <li>Use even, natural lighting.</li>
              <li>Keep your face unobstructed.</li>
              <li>Avoid beauty filters.</li>
              <li>Use a JPEG or PNG image under 10 MB.</li>
            </ul>
          </Card>
          <Card>
            <h2>Privacy first</h2>
            <p className="muted">
              Photos are processed by YouCam. SkinWise does not keep the
              uploaded photo. Guest results remain only in this open session;
              signed-in supported metrics are saved to your account.
            </p>
          </Card>
          <Card>
            <h2>Next step</h2>
            <p className="muted">
              Complete your skin profile so future recommendations can reflect
              your concerns and preferences.
            </p>
            <Link className="text-link" to="/skin-profile">
              Build my profile →
            </Link>
          </Card>
        </aside>
      </div>
    </main>
  );
}
