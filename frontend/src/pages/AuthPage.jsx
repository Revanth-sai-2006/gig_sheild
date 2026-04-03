import { useEffect, useRef, useState } from "react";
import GigShieldLogo from "../components/GigShieldLogo";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

const initialForm = {
  name: "",
  email: "",
  password: "",
  jobType: "",
  location: ""
};

const introSlides = [
  {
    title: "Built For Gig Partners",
    line: "Support riders, drivers, and field workers with insurance that adapts every hour.",
    signal: "Partner-ready risk intelligence"
  },
  {
    title: "Advantages In Real Time",
    line: "Dynamic premiums, weather-aware alerts, and fast claim journeys reduce income uncertainty.",
    signal: "Live automation and instant protection"
  },
  {
    title: "Designed For Worker Needs",
    line: "From onboarding to payout tracking, every screen is built for clarity and action.",
    signal: "Simple flow, enterprise-grade trust"
  }
];

const partnerTags = ["Fleet Operators", "Delivery Platforms", "Mobility Aggregators", "Contract Workforce Teams"];

export default function AuthPage() {
  const { login, register } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const shellRef = useRef(null);
  const [isRegister, setIsRegister] = useState(true);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [authToast, setAuthToast] = useState("");
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const flash = sessionStorage.getItem("swi_auth_flash");
    if (!flash) {
      return undefined;
    }

    setAuthToast(flash);
    sessionStorage.removeItem("swi_auth_flash");

    const timer = setTimeout(() => setAuthToast(""), 2800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const slideTimer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % introSlides.length);
    }, 3600);

    return () => clearInterval(slideTimer);
  }, []);

  const onChange = (event) => {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isRegister) {
        await register(form);
      } else {
        await login({ email: form.email, password: form.password });
      }
    } catch (apiError) {
      setError(apiError?.response?.data?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleParallaxMove = (event) => {
    const shell = shellRef.current;
    if (!shell) {
      return;
    }

    const rect = shell.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    const py = ((event.clientY - rect.top) / rect.height - 0.5) * 2;

    shell.style.setProperty("--mx", px.toFixed(3));
    shell.style.setProperty("--my", py.toFixed(3));
  };

  const resetParallax = () => {
    const shell = shellRef.current;
    if (!shell) {
      return;
    }

    shell.style.setProperty("--mx", "0");
    shell.style.setProperty("--my", "0");
  };

  return (
    <div className="auth-shell" ref={shellRef} onMouseMove={handleParallaxMove} onMouseLeave={resetParallax}>
      {authToast && (
        <div className="toast success" role="status" aria-live="polite">
          <span className="toast-dot" aria-hidden="true" />
          {authToast}
        </div>
      )}
      <div className="aura orb-one" aria-hidden="true" />
      <div className="aura orb-two" aria-hidden="true" />
      <section className="auth-home-intro glass" aria-label="Gig Shield overview">
        <div className="brand-header-row">
          <GigShieldLogo className="header-logo" title="Gig Shield" />
          <span className="brand-header-text">Gig Shield</span>
        </div>
        <p className="kicker">Gig Shield Home</p>
        <h2 className="intro-title">Insurance intelligence crafted for modern gig operations</h2>
        <p className="subtle">Enter your details to access live risk coverage, partner-safe automation, and transparent claims support.</p>

        <div className="intro-slide-panel">
          <div key={activeSlide} className="intro-slide-content">
            <p className="intro-slide-tag">{introSlides[activeSlide].signal}</p>
            <h3>{introSlides[activeSlide].title}</h3>
            <p>{introSlides[activeSlide].line}</p>
          </div>
          <div className="intro-dots" role="tablist" aria-label="Intro slides">
            {introSlides.map((slide, index) => (
              <button
                key={slide.title}
                type="button"
                className={`intro-dot ${activeSlide === index ? "active" : ""}`}
                onClick={() => setActiveSlide(index)}
                aria-label={`View slide ${index + 1}`}
              />
            ))}
          </div>
        </div>

        <div className="partner-strip">
          {partnerTags.map((tag) => (
            <span key={tag} className="partner-pill">
              {tag}
            </span>
          ))}
        </div>
      </section>
      <div className="auth-card glass">
        <button
          type="button"
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
        >
          {theme === "light" ? (
            <svg className="theme-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M21 12.79A9 9 0 1 1 11.21 3c.5 0 .78.58.45.95A7 7 0 0 0 20.05 12c.37-.33.95-.05.95.79Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg className="theme-icon" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <path
                d="M12 2v2.5M12 19.5V22M4.93 4.93l1.77 1.77M17.3 17.3l1.77 1.77M2 12h2.5M19.5 12H22M4.93 19.07l1.77-1.77M17.3 6.7l1.77-1.77"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
        <p className="kicker">Enterprise Insurance Platform</p>
        <h1 className="auth-brand-title">
          <GigShieldLogo className="inline-logo" title="Gig Shield" /> Gig Shield
        </h1>
        <p className="subtle">Operational risk protection with automated pricing, claims, and compliance-ready tracking.</p>

        <div className="auth-meta">
          <span className="pill">Policy Intelligence</span>
          <span className="pill">Automated Claims</span>
          <span className="pill">Risk Monitoring</span>
        </div>

        <form onSubmit={onSubmit} className="form-grid">
          {isRegister && (
            <>
              <input name="name" placeholder="Full name" value={form.name} onChange={onChange} required />
              <input name="jobType" placeholder="Job type (e.g., construction)" value={form.jobType} onChange={onChange} required />
              <input name="location" placeholder="Location (e.g., Mumbai)" value={form.location} onChange={onChange} required />
            </>
          )}

          <input type="email" name="email" placeholder="Email" value={form.email} onChange={onChange} required />
          <input
            type="password"
            name="password"
            placeholder="Password"
            minLength={6}
            value={form.password}
            onChange={onChange}
            required
          />

          {error && <p className="error">{error}</p>}

          <button disabled={loading} type="submit" className="primary-btn">
            {loading ? "Please wait..." : isRegister ? "Create account" : "Login"}
          </button>
        </form>

        <button type="button" className="text-btn" onClick={() => setIsRegister((prev) => !prev)}>
          {isRegister ? "Already registered? Login" : "Need an account? Register"}
        </button>
      </div>

      <footer className="app-footer">Developed by @TeamException</footer>
    </div>
  );
}
