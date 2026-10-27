import { NavLink } from "react-router-dom";
import { useAuth } from "../../app/auth/useAuth";

const items = [
  { label: "Home", to: "/", icon: "⌂" },
  { label: "Analyze", to: "/skin-analysis", icon: "✳" },
  { label: "Profile", to: "/skin-profile", icon: "◉" },
  { label: "Routine", to: "/routine", icon: "♡" },
  { label: "Progress", to: "/progress", icon: "↗" },
];

export default function MobileNavigation() {
  const { user, signOut } = useAuth();
  const visibleItems = user ? items : items.slice(0, 2);
  return (
    <>
      {user && (
        <div className="mobile-account-bar">
          <span className="mobile-account-email" title={user.email}>
            Signed in as {user.email}
          </span>
          <button type="button" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      )}
      <nav className="mobile-navigation" aria-label="Mobile navigation">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `mobile-nav-link${isActive ? " mobile-nav-link-active" : ""}`
            }
          >
            <span aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}
