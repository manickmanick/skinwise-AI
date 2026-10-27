import { NavLink } from "react-router-dom";

const items = [
  { label: "Home", to: "/", icon: "⌂" },
  { label: "Analyze", to: "/skin-analysis", icon: "✳" },
  { label: "Profile", to: "/skin-profile", icon: "◉" },
  { label: "Routine", to: "/routine", icon: "♡" },
  { label: "Progress", to: "/progress", icon: "↗" },
];

export default function MobileNavigation() {
  return (
    <nav className="mobile-navigation" aria-label="Mobile navigation">
      {items.map((item) => (
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
  );
}
