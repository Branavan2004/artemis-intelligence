import { useEffect, useState } from "react";
import { Outlet, NavLink } from "react-router-dom";
import {
  applyTheme,
  getPreferredTheme,
  persistTheme,
  Theme,
} from "../lib/theme";

const navItems = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/replay", label: "Replay" },
  { to: "/crew", label: "Crew" },
  { to: "/news", label: "News" },
];

export default function Layout() {
  const [theme, setTheme] = useState<Theme>(() => getPreferredTheme());

  useEffect(() => {
    applyTheme(theme);
    persistTheme(theme);
  }, [theme]);

  function handleThemeToggle() {
    setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"));
  }

  return (
    <div className="app-shell">
      <header className="app-nav">
        <NavLink
          to="/"
          className="app-brand-link"
          aria-label="Artemis Intelligence home"
        >
          <span className="app-brand-mark" aria-hidden="true">
            <svg
              viewBox="0 0 18 18"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle
                cx="9"
                cy="9"
                r="8.5"
                stroke="currentColor"
                strokeWidth="1"
              />
              <circle cx="9" cy="9" r="2.5" fill="currentColor" />
            </svg>
          </span>
          <span className="app-brand-wordmark">ARTEMIS</span>
          <span className="app-brand-divider" aria-hidden="true" />
          <span className="app-brand-subtitle">INTELLIGENCE</span>
        </NavLink>

        <nav className="app-nav__center" aria-label="Primary">
          {navItems.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `app-nav-link${isActive ? " app-nav-link--active" : ""}`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="app-nav__meta">
          <div className="mission-status" aria-live="polite">
            <span className="mission-status__dot pulse" />
            <span className="mission-status__text">Mission Active</span>
          </div>
          <button
            type="button"
            className="app-theme-toggle"
            onClick={handleThemeToggle}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            <span className="app-theme-toggle__icon" aria-hidden="true">
              {theme === "dark" ? "◐" : "◑"}
            </span>
            <span className="app-theme-toggle__label">
              {theme === "dark" ? "Light" : "Dark"}
            </span>
          </button>
        </div>
      </header>

      <main className="app-main">
        <Outlet />
      </main>

      <footer className="app-footer">
        <a
          href="https://www.linkedin.com/in/branavan-kuganesan-548244307/"
          target="_blank"
          rel="noreferrer"
          className="app-footer__link"
        >
          Open source project by kuganesan branavan
        </a>
      </footer>
    </div>
  );
}
