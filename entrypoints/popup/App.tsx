import React, { useState, useEffect } from 'react';
import { siteAdapters } from '@/src/core/adapters/registry';

// Annotation colors - same as in ColorPicker.tsx
const ANNOTATION_COLORS = [
  { value: '#22C55E', name: 'Green' },
  { value: '#EF4444', name: 'Red' },
  { value: '#3B82F6', name: 'Blue' },
  { value: '#EAB308', name: 'Yellow' },
  { value: '#F97316', name: 'Orange' },
  { value: '#A855F7', name: 'Purple' },
  { value: '#06B6D4', name: 'Cyan' },
  { value: '#FFFFFF', name: 'White' },
];

// Icons as SVG components with explicit sizing
const RefreshIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
    <path d="M16 16h5v5" />
  </svg>
);

const CheckIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const SunIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2" />
    <path d="M12 20v2" />
    <path d="m4.93 4.93 1.41 1.41" />
    <path d="m17.66 17.66 1.41 1.41" />
    <path d="M2 12h2" />
    <path d="M20 12h2" />
    <path d="m6.34 17.66-1.41 1.41" />
    <path d="m19.07 4.93-1.41 1.41" />
  </svg>
);

const MoonIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </svg>
);

const RefreshPageIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
    <path d="M16 16h5v5" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

type Theme = 'light' | 'dark';

const DEFAULT_COLOR = '#22C55E'; // Green

function App() {
  const [loggingEnabled, setLoggingEnabled] = useState(false);
  const [theme, setTheme] = useState<Theme>('dark');
  const [defaultColor, setDefaultColor] = useState(DEFAULT_COLOR);

  // Git version injected at build time (e.g., "v0.3.0-beta-4-g56fe0ce")
  const version = __GIT_VERSION__;

  // Load initial state
  useEffect(() => {
    // Get logging state, theme, and default color from storage
    browser.storage.local.get(['loggingEnabled', 'theme', 'defaultBrushColor']).then((result) => {
      setLoggingEnabled(result.loggingEnabled ?? false);
      const savedTheme = result.theme ?? 'dark';
      setTheme(savedTheme);
      document.documentElement.dataset.theme = savedTheme;
      if (result.defaultBrushColor) {
        setDefaultColor(result.defaultBrushColor);
      }
    });
  }, []);

  // Handle reload extension only
  const handleReload = () => {
    browser.runtime.reload();
  };

  // Handle reload extension + current page
  const handleReloadWithPage = async () => {
    // Get current active tab
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      // Save tab ID for background script to reload after extension restarts
      await browser.storage.local.set({
        pendingTabReload: { tabId: tab.id, timestamp: Date.now() }
      });
    }
    // Reload extension (this closes popup immediately)
    browser.runtime.reload();
  };

  // Handle logging toggle
  const handleLoggingToggle = async () => {
    const newValue = !loggingEnabled;
    setLoggingEnabled(newValue);
    await browser.storage.local.set({ loggingEnabled: newValue });
  };

  // Handle theme toggle
  const handleThemeToggle = async () => {
    const newTheme: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.documentElement.dataset.theme = newTheme;
    await browser.storage.local.set({ theme: newTheme });
  };

  // Handle color change
  const handleColorChange = async (color: string) => {
    setDefaultColor(color);
    await browser.storage.local.set({ defaultBrushColor: color });
  };

  return (
    <div className="popup-container">
      {/* Header */}
      <header className="popup-header">
        <div className="header-left">
          <h1 className="popup-title">DEIXIS</h1>
        </div>
        <div className="header-right">
          <button
            onClick={handleThemeToggle}
            className="theme-toggle"
            title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
          <span className="popup-version">{version}</span>
        </div>
      </header>

      {/* Developer Tools Section */}
      <section className="popup-section">
        <h2 className="section-title">Developer Tools</h2>

        <div className="section-content">
          {/* Reload Extension Button */}
          <button
            onClick={handleReload}
            className="action-button"
            title="Reload extension only"
          >
            <span className="action-icon">
              <RefreshIcon />
            </span>
            <span>Reload Extension</span>
          </button>

          {/* Reload Extension + Page Button */}
          <button
            onClick={handleReloadWithPage}
            className="action-button"
            title="Reload extension and refresh current page"
          >
            <span className="action-icon">
              <RefreshPageIcon />
            </span>
            <span>Reload Extension + Page</span>
          </button>

          {/* Logging Toggle */}
          <div className="toggle-row">
            <span className="toggle-label">Enable Logging</span>
            <button
              role="switch"
              aria-checked={loggingEnabled}
              onClick={handleLoggingToggle}
              className={`toggle-switch ${loggingEnabled ? 'active' : ''}`}
            >
              <span className="toggle-thumb" />
            </button>
          </div>
        </div>
      </section>

      {/* Settings Section */}
      <section className="popup-section">
        <h2 className="section-title">Settings</h2>

        <div className="section-content">
          {/* Default Brush Color */}
          <div className="color-picker-row">
            <span className="color-picker-label">Default Brush Color</span>
            <div className="color-picker-controls">
              {/* Preset color swatches */}
              <div className="color-swatches">
                {ANNOTATION_COLORS.map((color) => (
                  <button
                    key={color.value}
                    className={`color-swatch ${defaultColor === color.value ? 'selected' : ''}`}
                    style={{
                      backgroundColor: color.value,
                      boxShadow: color.value === '#FFFFFF' ? 'inset 0 0 0 1px rgba(0,0,0,0.2)' : 'none',
                    }}
                    onClick={() => handleColorChange(color.value)}
                    title={color.name}
                    aria-label={color.name}
                  />
                ))}
              </div>
              {/* Custom color picker */}
              <div className="custom-color-picker">
                <input
                  type="color"
                  value={defaultColor}
                  onChange={(e) => handleColorChange(e.target.value)}
                  title="Pick custom color"
                  aria-label="Pick custom color"
                />
                <span
                  className="rainbow-indicator"
                  style={{
                    background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Supported Sites Section */}
      <section className="popup-section last">
        <h2 className="section-title">Supported Sites</h2>

        <ul className="sites-list">
          {siteAdapters.map((adapter) => (
            <li key={adapter.id} className="site-item">
              <div className="site-header">
                <span className="site-check">
                  <CheckIcon />
                </span>
                <span className="site-name">{adapter.name}</span>
              </div>
              <div className="site-patterns">
                {adapter.matches.map((pattern, idx) => (
                  <span key={idx} className="site-pattern">
                    {pattern}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default App;
