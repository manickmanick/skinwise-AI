import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import MobileNavigation from "./MobileNavigation";

export default function AppLayout() {
  const location = useLocation();
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main" key={location.pathname}>
        <Outlet />
      </div>
      <MobileNavigation />
    </div>
  );
}
