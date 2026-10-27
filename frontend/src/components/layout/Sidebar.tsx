import { NavLink, Link } from "react-router-dom";
import { useAuth } from "../../app/auth/useAuth";

const items = [
  { label: "Overview", to: "/", icon: "⌂" },
  { label: "Skin Analysis", to: "/skin-analysis", icon: "✳" },
  { label: "Skin Profile", to: "/skin-profile", icon: "◉" },
  { label: "My Routine", to: "/routine", icon: "♡" },
  { label: "Progress Tracking", to: "/progress", icon: "↗" },
];

export default function Sidebar() {
  const { user, signOut } = useAuth();
  const visibleItems = user ? items : items.slice(0, 2);
  return (
    <aside className="app-sidebar" aria-label="Main navigation">
      <NavLink to="/" className="brand">
        <span className="brand-mark" aria-hidden="true">
          S
        </span>
        <span className="brand-copy">
          <strong>skinwise</strong>
          <small>AI SKIN COMPANION</small>
        </span>
      </NavLink>
      <p className="nav-caption">YOUR WORKSPACE</p>
      <nav className="sidebar-links">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `nav-link${isActive ? " nav-link-active" : ""}`
            }
          >
            <span className="nav-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-note">
        <span className="sidebar-note-icon" aria-hidden="true">
          ✦
        </span>
        <strong>Your skin, understood.</strong>
        <p>Small steps. Thoughtful care.</p>
      </div>
      <div className="sidebar-footer">
        {user ? (
          <>
            <span className="status-dot" />{" "}
            <span className="sidebar-account">{user.email}</span>
            <button
              className="sidebar-signout"
              type="button"
              onClick={() => void signOut()}
            >
              Sign out
            </button>
          </>
        ) : (
          <>
            <span className="status-dot" /> SkinWise AI{" "}
            <Link to="/login">Sign in</Link>
          </>
        )}
      </div>
    </aside>
  );
}
