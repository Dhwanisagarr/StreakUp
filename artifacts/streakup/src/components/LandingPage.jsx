import { useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowDown,
  Check,
  Sparkles,
  NotebookPen,
  CalendarDays,
  Flame,
  Menu,
  X,
} from "lucide-react";
import { LiquidGlass } from "./LiquidGlass";
import { Halcyon } from "./Halcyon";

function Logo() {
  return (
    <span className="landing-brand-mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

const weekDays = [
  { label: "M", done: true },
  { label: "T", done: true },
  { label: "W", done: true },
  { label: "T", done: false },
  { label: "F", done: true },
  { label: "S", done: true },
  { label: "S", done: true },
];

function PreviewStage({ onEnter }) {
  return (
    <div className="preview-stage" aria-label="A preview of the StreakUp daily check-in">
      <div className="preview-orbit preview-orbit-one" />
      <div className="preview-orbit preview-orbit-two" />

      <LiquidGlass
        glassMode="css"
        cornerRadius={32}
        blur={24}
        refraction={65}
        specularIntensity={1.8}
        rainbowIntensity={0.65}
        edgeHighlight={0.9}
        tintColor="#ffffff"
        tintOpacity={0.12}
        style={{ width: "100%", maxWidth: 440 }}
      >
        <div className="preview-card">
          <div className="preview-topline">
            <span className="preview-window-dots">
              <i />
              <i />
              <i />
            </span>
            <span className="preview-date">TUESDAY · 08:42</span>
            <span className="preview-avatar">S</span>
          </div>

          <div className="preview-greeting">
            <div>
              <span className="eyebrow">Your small reset</span>
              <h2>Today's check-in</h2>
            </div>
            <div className="preview-ring" aria-label="71 percent complete">
              <strong>71</strong>
              <small>%</small>
            </div>
          </div>

          <div className="preview-challenge">
            <div className="preview-challenge-head">
              <div>
                <span className="preview-challenge-kicker">CURRENT CHALLENGE</span>
                <h3>Make room for good work</h3>
              </div>
              <span className="preview-streak">
                <Flame size={13} /> 6 days
              </span>
            </div>

            <div className="preview-progress">
              <span />
            </div>

            <div className="preview-progress-label">
              <span>Day 18 of 30</span>
              <span>12 days to go</span>
            </div>

            <div className="preview-habits">
              <div className="preview-habit is-done">
                <span>
                  <Check size={13} />
                </span>
                <p>Write the first paragraph</p>
                <b>done</b>
              </div>
              <div className="preview-habit is-done">
                <span>
                  <Check size={13} />
                </span>
                <p>Take a 20 minute walk</p>
                <b>done</b>
              </div>
              <div className="preview-habit">
                <span />
                <p>Put the phone away at 9</p>
                <b>next</b>
              </div>
            </div>

            <button
              className="preview-action"
              type="button"
              onClick={onEnter}
              aria-label="Complete today check-in"
            >
              <span>Complete today</span>
              <ArrowRight size={14} />
            </button>
          </div>

          <div className="preview-footer-note">
            <Sparkles size={14} />
            <span>Consistency looks good on you.</span>
          </div>
        </div>
      </LiquidGlass>

      <div className="preview-float preview-float-streak">
        <LiquidGlass
          glassMode="liquid"
          cornerRadius={20}
          blur={16}
          glassTint="rgba(255, 255, 255, 0.75)"
          shadowOpacity={0.12}
          shadowSize={16}
        >
          <div className="preview-float-inner">
            <span className="float-icon">
              <Flame size={15} />
            </span>
            <span>
              <b>6 day streak</b>
              <small>Keep the thread going</small>
            </span>
          </div>
        </LiquidGlass>
      </div>

      <div className="preview-float preview-float-note">
        <LiquidGlass
          glassMode="liquid"
          cornerRadius={20}
          blur={16}
          glassTint="rgba(255, 255, 255, 0.75)"
          shadowOpacity={0.12}
          shadowSize={16}
        >
          <div className="preview-float-inner">
            <span className="float-icon note-icon">
              <NotebookPen size={15} />
            </span>
            <span>
              <b>One useful note</b>
              <small>Saved for later</small>
            </span>
          </div>
        </LiquidGlass>
      </div>
    </div>
  );
}

export default function LandingPage({ onEnter }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleNavClick = () => {
    setMenuOpen(false);
  };

  const handleEnterTracker = () => {
    setMenuOpen(false);
    onEnter();
  };

  return (
    <main className="landing-page">
      <div className="landing-grain" aria-hidden="true" />

      {/* HALCYON ANIMATED WEBGL FLOW-FIELD BACKGROUND (PASTEL SAGE GREEN) */}
      <div className="halcyon-bg-wrapper" aria-hidden="true">
        <Halcyon
          preset="Pastel Sage"
          color1="#0f261c"
          color2="#1c4d3b"
          color3="#3e7e65"
          color4="#7cb89a"
          color5="#d4e7db"
          speed={1.0}
          scale={1.4}
          warp={2.2}
          grain={0.03}
        />
        <div className="halcyon-overlay-mask" />
      </div>

      {/* HEADER / NAV */}
      <header className="landing-nav-wrapper">
        <LiquidGlass
          glassMode="liquid"
          cornerRadius={24}
          blur={20}
          glassTint="rgba(228, 239, 231, 0.82)"
          shadowOpacity={0.08}
          shadowSize={20}
          style={{ width: "100%" }}
        >
          <div className="landing-nav">
            <a
              className="landing-logo"
              href="#top"
              onClick={handleNavClick}
              data-testid="link-brand-home"
            >
              <Logo />
              <span>
                Streak<span>Up</span>
              </span>
            </a>

            <nav
              className={`landing-nav-links${menuOpen ? " is-open" : ""}`}
              aria-label="Primary navigation"
            >
              <a href="#top" onClick={handleNavClick} data-testid="link-overview">
                Overview
              </a>
              <a href="#ritual" onClick={handleNavClick} data-testid="link-ritual">
                How It Works
              </a>
            </nav>

            <button
              className="landing-menu-toggle"
              type="button"
              aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
              data-testid="button-toggle-navigation"
            >
              {menuOpen ? <X size={21} /> : <Menu size={21} />}
            </button>

            {/* SINGLE PRIMARY CTA BUTTON */}
            <button
              className="nav-cta"
              type="button"
              onClick={handleEnterTracker}
              data-testid="button-nav-open-tracker"
            >
              Open Tracker <ArrowUpRight size={15} />
            </button>
          </div>
        </LiquidGlass>
      </header>

      {/* ─────────────────────────────────────────────
         PAGE / SECTION 1: HERO & OVERVIEW
      ───────────────────────────────────────────── */}
      <section className="landing-hero" id="top">
        <div className="hero-copy landing-reveal">
          <div className="hero-kicker">
            <span className="kicker-line" /> STREAKUP HABIT TRACKER
          </div>
          <h1>
            Small steps.
            <br />
            <span>Daily momentum.</span>
          </h1>
          <p className="hero-intro">
            The distraction-free habit companion built for daily consistency. Track challenges, build streaks, and reflect every day.
          </p>

          <div className="hero-actions">
            <button
              className="primary-action"
              type="button"
              onClick={handleEnterTracker}
              data-testid="button-hero-start"
            >
              Start a Challenge <ArrowRight size={17} />
            </button>
            <a
              className="text-action"
              href="#ritual"
              data-testid="link-hero-learn"
            >
              See how it works <ArrowDown size={15} />
            </a>
          </div>
          <div className="hero-proof">
            <span className="proof-mark">
              <Check size={12} />
            </span>
            <span>No account required · Instant local storage · Built for momentum</span>
          </div>
        </div>

        <PreviewStage onEnter={handleEnterTracker} />
      </section>

      {/* TICKER IN MOTION */}
      <div className="landing-ticker" aria-label="StreakUp principles">
        <div className="ticker-track">
          <span>SHOW UP DAILY</span>
          <i aria-hidden="true" />
          <span>NOTICE PROGRESS</span>
          <i aria-hidden="true" />
          <span>KEEP IT SIMPLE</span>
          <i aria-hidden="true" />
          <span>BUILD MOMENTUM</span>
          <i aria-hidden="true" />
          <span>ONE DAY AT A TIME</span>
          <i aria-hidden="true" />
          {/* Seamless Duplicate Set */}
          <span>SHOW UP DAILY</span>
          <i aria-hidden="true" />
          <span>NOTICE PROGRESS</span>
          <i aria-hidden="true" />
          <span>KEEP IT SIMPLE</span>
          <i aria-hidden="true" />
          <span>BUILD MOMENTUM</span>
          <i aria-hidden="true" />
          <span>ONE DAY AT A TIME</span>
          <i aria-hidden="true" />
        </div>
      </div>

      {/* ─────────────────────────────────────────────
         PAGE / SECTION 2: THE RITUAL & CLOSING CTA
      ───────────────────────────────────────────── */}
      <section className="ritual-section landing-section" id="ritual">
        <div className="ritual-panel">
          <div className="ritual-copy landing-reveal">
            <span className="section-label section-label-light">
              02 / HOW IT WORKS
            </span>
            <h2>
              A simple daily ritual for <span>showing up.</span>
            </h2>
            <p>
              Set a challenge timeline, track daily habits, and keep notes on your progress — all in one clean space.
            </p>

            <div className="ritual-steps">
              <div>
                <span>01</span>
                <p>
                  <b>Set a challenge</b>
                  <small>Choose a 21, 30, or 66-day timeline with custom daily habits.</small>
                </p>
              </div>
              <div>
                <span>02</span>
                <p>
                  <b>Track daily check-ins</b>
                  <small>Log completions, build streaks, or skip guilt-free when life happens.</small>
                </p>
              </div>
              <div>
                <span>03</span>
                <p>
                  <b>Reflect & stay consistent</b>
                  <small>Earn badges, write journal entries, and watch your progress compound.</small>
                </p>
              </div>
            </div>
          </div>

          <div className="ritual-art" aria-hidden="true">
            <div className="sun-disc" />
            <LiquidGlass
              glassMode="css"
              cornerRadius={24}
              blur={20}
              refraction={50}
              specularIntensity={1.4}
              glassTint="rgba(255, 255, 255, 0.55)"
              style={{ zIndex: 2, width: "min(100%, 390px)", transform: "rotate(-3deg)" }}
            >
              <div className="ritual-card">
                <div className="mini-card-top">
                  <span className="mini-card-label">THIS WEEK</span>
                  <span className="mini-card-count">5 / 7</span>
                </div>
                <div className="week-days">
                  {weekDays.map((item, idx) => (
                    <div
                      key={`${item.label}-${idx}`}
                      className={item.done ? "is-done" : ""}
                    >
                      <span>{item.label}</span>
                      <i>{item.done && <Check size={12} />}</i>
                    </div>
                  ))}
                </div>
                <div className="ritual-card-rule" />
                <div className="mini-insight">
                  <span className="insight-spark">
                    <Sparkles size={14} />
                  </span>
                  <p>
                    <b>You are building a reliable habit.</b>
                    <small>Three weeks in a row.</small>
                  </p>
                </div>
              </div>
            </LiquidGlass>
          </div>
        </div>

        {/* INTEGRATED CLOSING CTA CARD INSIDE SECTION 2 */}
        <div style={{ marginTop: 60, width: "100%" }}>
          <LiquidGlass
            glassMode="css"
            cornerRadius={32}
            blur={24}
            refraction={60}
            specularIntensity={1.8}
            rainbowIntensity={0.6}
            glassTint="rgba(253, 248, 240, 0.94)"
            style={{ width: "100%", maxWidth: 1040, margin: "0 auto" }}
          >
            <div className="closing-copy landing-reveal">
              <span className="section-label section-label-light">
                READY TO BEGIN?
              </span>
              <h2>
                Make today
                <br />
                <span>count for something.</span>
              </h2>
              <p>
                Pick one small action today. StreakUp will help you notice what happens when you show up.
              </p>

              <button
                className="light-action"
                type="button"
                onClick={handleEnterTracker}
                data-testid="button-closing-start"
              >
                Start your first challenge <ArrowRight size={17} />
              </button>

              <span className="closing-footnote">
                <CalendarDays size={14} /> Built for real days. No accounts. No complexity.
              </span>
            </div>
          </LiquidGlass>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="landing-footer">
        <a
          className="landing-logo"
          href="#top"
          onClick={handleNavClick}
          data-testid="link-footer-home"
        >
          <Logo />
          <span>
            Streak<span>Up</span>
          </span>
        </a>
        <span>Small steps, clearly seen.</span>
        <button
          type="button"
          onClick={handleEnterTracker}
          className="nav-cta"
          data-testid="button-footer-open-tracker"
        >
          Open Tracker <ArrowUpRight size={14} />
        </button>
      </footer>
    </main>
  );
}
