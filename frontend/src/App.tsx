
import { useEffect, useState } from "react";
import { getHealth } from "./api";
import "./App.css";

const sections = [
  {
    id: "profile",
    number: "01",
    title: "Skin Profile",
    description:
      "Your skin type, concerns and personal preferences.",
    icon: "◉",
  },
  {
    id: "analysis",
    number: "02",
    title: "Skin Analysis",
    description:
      "Your future AI-powered skin analysis workspace.",
    icon: "✳",
  },
  {
    id: "routine",
    number: "03",
    title: "My Routine",
    description:
      "A future space for your personalized skincare routine.",
    icon: "☼",
  },
  {
    id: "progress",
    number: "04",
    title: "Progress Tracking",
    description:
      "A future space to track changes over time.",
    icon: "↗",
  },
];

type HealthStatus = "checking" | "connected" | "offline";

function App() {
  const [healthStatus, setHealthStatus] =
    useState<HealthStatus>("checking");

  const [healthMessage, setHealthMessage] = useState(
    "Checking backend connection..."
  );

  useEffect(() => {
    let active = true;

    async function checkBackend() {
      try {
        const health = await getHealth();

        if (active) {
          setHealthStatus("connected");
          setHealthMessage(health.message);
        }
      } catch {
        if (active) {
          setHealthStatus("offline");
          setHealthMessage(
            "Backend unavailable. Start the backend and retry."
          );
        }
      }
    }

    checkBackend();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#home">
          <span className="brand-mark">S</span>
          <span>
            <strong>skinwise</strong>
            <small>AI SKINCARE STUDIO</small>
          </span>
        </a>

        <p className="nav-heading">WORKSPACE</p>

        <nav className="navigation" aria-label="Main navigation">
          {sections.map((section) => (
            <a
              className="nav-link"
              href={`#${section.id}`}
              key={section.id}
            >
              <span className="nav-icon">{section.icon}</span>
              {section.title}
            </a>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="privacy-note">
            <span className="privacy-icon">✦</span>
            <strong>Your skin, your journey.</strong>
            <p>
              A thoughtful space for your future skincare journey.
            </p>
          </div>
          <span className="version-label">SKINWISE AI · MVP</span>
        </div>
      </aside>

      <main className="main-content" id="home">
        <header className="topbar">
          <span className="breadcrumb">
            Workspace <span>/</span> Overview
          </span>

          <div
            className={`connection-status ${healthStatus}`}
            role="status"
            aria-live="polite"
          >
            <span className="status-dot" />
            {healthStatus === "checking"
              ? "Connecting"
              : healthStatus === "connected"
                ? "Backend connected"
                : "Backend offline"}
          </div>
        </header>

        <section className="welcome-section">
          <div className="eyebrow">
            <span className="eyebrow-line" />
            YOUR PERSONAL SKINCARE SPACE
          </div>

          <h1>
            Get to know
            <br />
            <span>your skin.</span>
          </h1>

          <p className="welcome-description">
            A smarter starting point for your skincare journey.
            Explore your future skin profile, AI analysis, routines
            and progress—all in one place.
          </p>

          <a className="primary-button" href="#analysis">
            Explore your workspace <span>→</span>
          </a>

          <div className="welcome-decoration" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="orbit orbit-three" />
            <div className="orbit-center">S</div>
            <span className="decoration-star star-one">✳</span>
            <span className="decoration-star star-two">✦</span>
          </div>
        </section>

        <section className="workspace-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">YOUR WORKSPACE</p>
              <h2>Everything starts here.</h2>
            </div>
            <span className="section-count">04 MODULES</span>
          </div>

          <div className="feature-grid">
            {sections.map((section) => (
              <article
                className="feature-card"
                id={section.id}
                key={section.id}
              >
                <div className="card-top">
                  <span className="feature-icon">{section.icon}</span>
                  <span className="feature-number">
                    {section.number}
                  </span>
                </div>

                <h3>{section.title}</h3>
                <p>{section.description}</p>

                <span className="coming-soon">
                  <span className="coming-dot" />
                  Foundation phase
                </span>
              </article>
            ))}
          </div>
        </section>

        <footer className="page-footer">
          <span>SKINWISE AI</span>
          <span>Built with care, one step at a time.</span>
        </footer>

        <p className="health-message" role="status">
          {healthMessage}
        </p>
      </main>
    </div>
  );
}

export default App;
