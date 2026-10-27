import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./useAuth";
import LoadingSpinner from "../../components/ui/LoadingSpinner";

export default function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading)
    return (
      <div className="page">
        <LoadingSpinner label="Checking your account…" />
      </div>
    );
  return user ? (
    <Outlet />
  ) : (
    <Navigate to="/login" replace state={{ from: location.pathname }} />
  );
}
