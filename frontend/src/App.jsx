import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import GigShieldLogo from "./components/GigShieldLogo";
import ProtectedRoute from "./components/ProtectedRoute";
import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import { useAuth } from "./context/AuthContext";

function BrandSplash() {
  return (
    <div className="brand-splash" role="status" aria-live="polite" aria-label="Loading Gig Shield">
      <div className="brand-card glass">
        <div className="brand-symbol" aria-hidden="true">
          <GigShieldLogo className="brand-symbol-svg" title="Gig Shield" />
        </div>
        <p className="kicker">Initializing Platform</p>
        <h1 className="brand-name">Gig Shield</h1>
        <p className="subtle">Loading secure insurance intelligence...</p>
        <div className="buffer-line" aria-hidden="true">
          <span className="buffer-glow" />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { isAuthenticated } = useAuth();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2200);
    return () => clearTimeout(timer);
  }, []);

  if (showSplash) {
    return <BrandSplash />;
  }

  return (
    <Routes>
      <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <AuthPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to={isAuthenticated ? "/dashboard" : "/"} replace />} />
    </Routes>
  );
}
