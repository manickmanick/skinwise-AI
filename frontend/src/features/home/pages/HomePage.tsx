import { Link } from "react-router-dom";
import Card from "../../../components/ui/Card";
import { useAuth } from "../../../app/auth/useAuth";

const features = [
  {
    icon: "✳",
    title: "AI Skin Analysis",
    description: "Explore skin metrics from a clear facial photo.",
    to: "/skin-analysis",
    action: "Analyze my skin",
    status: "Start here",
  },
  {
    icon: "◉",
    title: "Your Skin Profile",
    description: "Share your skin concerns, preferences and current routine.",
    to: "/skin-profile",
    action: "Build your profile",
    status: "Personalize",
  },
  {
    icon: "♡",
    title: "My Routine",
    description:
      "Follow a gentle morning and evening routine with a saved checklist.",
    to: "/routine",
    action: "View routine",
    status: "Daily care",
  },
  {
    icon: "↗",
    title: "Progress Tracking",
    description:
      "Review saved analysis metrics and compare compatible results.",
    to: "/progress",
    action: "View progress",
    status: "Your history",
  },
];

export default function HomePage() {
  const { user } = useAuth();
  const visibleFeatures = user ? features : features.slice(0, 1);
  return (
    <main className="page home-page">
      <section className="home-hero">
        <div className="hero-copy">
          <span className="hero-kicker">
            <span className="hero-kicker-dot" /> YOUR PERSONAL SKINCARE SPACE
          </span>
          <h1>
            Get to know your skin.
            <br />
            <em>Care for it with confidence.</em>
          </h1>
          <p>
            Thoughtful skincare starts with understanding your skin. Explore
            your skin metrics, share what matters to you, and build a routine
            one step at a time.
          </p>
          <div className="hero-actions">
            <Link
              className="app-button app-button--primary"
              to="/skin-analysis"
            >
              Start skin analysis <span aria-hidden="true">↗</span>
            </Link>
            {user ? (
              <Link className="text-link" to="/skin-profile">
                Set up my skin profile <span aria-hidden="true">→</span>
              </Link>
            ) : (
              <Link className="text-link" to="/register">
                Create an account <span aria-hidden="true">→</span>
              </Link>
            )}
          </div>
          <div className="hero-trust">
            <span aria-hidden="true">✦</span> Your journey, your pace. No
            perfect skin required.
          </div>
        </div>
        <div
          className="hero-art"
          aria-label="Illustration of a calm skincare routine"
          role="img"
        >
          <div className="art-sun" />
          <div className="art-plant plant-one">
            <i />
            <i />
            <i />
            <i />
          </div>
          <div className="art-face">
            <div className="face-hair" />
            <div className="face-ear left" />
            <div className="face-ear right" />
            <div className="face-eye eye-one" />
            <div className="face-eye eye-two" />
            <div className="face-nose" />
            <div className="face-mouth" />
            <div className="face-blush blush-one" />
            <div className="face-blush blush-two" />
          </div>
          <div className="art-leaf leaf-one" />
          <div className="art-leaf leaf-two" />
          <div className="art-leaf leaf-three" />
          <div className="art-caption">
            <span className="caption-sparkle">✦</span>
            <span>
              <strong>Skin first, always</strong>
              <small>A little care goes a long way</small>
            </span>
          </div>
        </div>
      </section>

      <section className="home-section">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">YOUR SKIN JOURNEY</p>
            <h2>Everything starts with you.</h2>
          </div>
          <span className="section-subtitle">Explore your workspace</span>
        </div>
        <div className="feature-grid">
          {visibleFeatures.map((feature, index) => (
            <Card
              className={`feature-card feature-card-${index + 1}`}
              key={feature.to}
            >
              <div className="feature-card-top">
                <span className="icon-tile">{feature.icon}</span>
                <span className="feature-status">{feature.status}</span>
              </div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
              <Link to={feature.to} className="feature-link">
                {feature.action}
                <span aria-hidden="true">→</span>
              </Link>
            </Card>
          ))}
        </div>
      </section>
      <section className="home-bottom-banner">
        <div className="banner-mark" aria-hidden="true">
          ✦
        </div>
        <div>
          <p className="eyebrow">A GENTLER WAY TO SKINCARE</p>
          <h2>Progress, not perfection.</h2>
          <p>
            Learn about your skin without the pressure to change everything at
            once.
          </p>
        </div>
        <Link
          className="app-button app-button--secondary"
          to={user ? "/skin-profile" : "/register"}
        >
          {user ? "Get started" : "Create your account"}
        </Link>
      </section>
      <footer className="page-footer">
        SkinWise AI <span>·</span> Built around your skin journey
      </footer>
    </main>
  );
}
