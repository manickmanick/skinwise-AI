import { createBrowserRouter } from "react-router-dom";
import AppLayout from "../components/layout/AppLayout";
import HomePage from "../features/home/pages/HomePage";
import SkinAnalysisPage from "../features/skin-analysis/pages/SkinAnalysisPage";
import SkinProfilePage from "../features/skin-profile/pages/SkinProfilePage";
import RoutinePage from "../features/routine/pages/RoutinePage";
import ProgressPage from "../features/progress/pages/ProgressPage";
import NotFoundPage from "../features/home/pages/NotFoundPage";

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: "/", element: <HomePage /> },
      { path: "/skin-analysis", element: <SkinAnalysisPage /> },
      { path: "/skin-profile", element: <SkinProfilePage /> },
      { path: "/routine", element: <RoutinePage /> },
      { path: "/progress", element: <ProgressPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
