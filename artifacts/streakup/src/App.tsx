import { useState, useEffect } from "react";
// @ts-ignore
import LandingPage from "./components/LandingPage";
// @ts-ignore
import StreakUp from "./StreakUp";

export default function App() {
  const [showLanding, setShowLanding] = useState(() => {
    try {
      if (typeof window !== "undefined") {
        const searchParams = new URLSearchParams(window.location.search);
        if (searchParams.has("tracker")) return false;
        if (searchParams.has("landing")) return true;
      }
    } catch {
      // fallback
    }
    return true; // Always default to landing page
  });

  useEffect(() => {
    const handlePopState = () => {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.has("tracker")) {
        setShowLanding(false);
      } else if (searchParams.has("landing")) {
        setShowLanding(true);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleEnterTracker = () => {
    try {
      localStorage.setItem("streakup_landing_seen", "true");
      const url = new URL(window.location.href);
      url.searchParams.set("tracker", "true");
      url.searchParams.delete("landing");
      window.history.pushState({}, "", url.toString());
    } catch {
      // ignore
    }
    setShowLanding(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleReturnToLanding = () => {
    try {
      localStorage.removeItem("streakup_landing_seen");
      const url = new URL(window.location.href);
      url.searchParams.set("landing", "true");
      url.searchParams.delete("tracker");
      window.history.pushState({}, "", url.toString());
    } catch {
      // ignore
    }
    setShowLanding(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (showLanding) {
    return <LandingPage onEnter={handleEnterTracker} />;
  }

  return <StreakUp onReturnToLanding={handleReturnToLanding} />;
}
