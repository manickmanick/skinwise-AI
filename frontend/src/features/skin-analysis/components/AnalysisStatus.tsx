import Button from "../../../components/ui/Button";
import LoadingSpinner from "../../../components/ui/LoadingSpinner";
interface Props {
  loading: boolean;
  error: string | null;
  canRetry: boolean;
  onRetry: () => void;
}
export default function AnalysisStatus({
  loading,
  error,
  canRetry,
  onRetry,
}: Props) {
  if (loading)
    return (
      <div className="status-panel">
        <LoadingSpinner label="Preparing your analysis…" />
        <p className="muted">
          Your image is being sent securely to the analysis provider. SkinWise
          does not retain guest photos.
        </p>
      </div>
    );
  if (!error) return null;
  return (
    <div className="error-panel" role="alert">
      <h3>We couldn't complete the analysis</h3>
      <p>{error}</p>
      {canRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
