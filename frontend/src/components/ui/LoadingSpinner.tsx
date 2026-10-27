interface Props {
  label?: string;
}
export default function LoadingSpinner({ label = "Loading…" }: Props) {
  return (
    <div className="loading-state" role="status">
      <span className="loading-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
