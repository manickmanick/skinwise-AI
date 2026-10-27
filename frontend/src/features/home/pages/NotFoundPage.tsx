import { Link } from "react-router-dom";
export default function NotFoundPage() {
  return (
    <main className="page">
      <section className="empty-state">
        <p className="eyebrow">PAGE NOT FOUND</p>
        <h1>We couldn't find that page.</h1>
        <p>
          The link may have moved. Return to your SkinWise home page to
          continue.
        </p>
        <Link to="/" className="app-button app-button--primary">
          Back to home
        </Link>
      </section>
    </main>
  );
}
