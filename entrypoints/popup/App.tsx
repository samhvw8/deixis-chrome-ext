import React, { useState, useEffect } from 'react';
import { siteAdapters } from '@/src/core/adapters/registry';

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

function App() {
  const [loggingEnabled, setLoggingEnabled] = useState(false);
  const [version, setVersion] = useState('');

  // Load initial state
  useEffect(() => {
    // Get version from manifest
    const manifest = browser.runtime.getManifest();
    setVersion(manifest.version);

    // Get logging state from storage
    browser.storage.local.get('loggingEnabled').then((result) => {
      setLoggingEnabled(result.loggingEnabled ?? false);
    });
  }, []);

  // Handle reload extension
  const handleReload = () => {
    browser.runtime.reload();
  };

  // Handle logging toggle
  const handleLoggingToggle = async () => {
    const newValue = !loggingEnabled;
    setLoggingEnabled(newValue);
    await browser.storage.local.set({ loggingEnabled: newValue });
  };

  return (
    <div className="popup-container">
      {/* Header */}
      <header className="popup-header">
        <h1 className="popup-title">DEIXIS</h1>
        <span className="popup-version">v{version}</span>
      </header>

      {/* Developer Tools Section */}
      <section className="popup-section">
        <h2 className="section-title">Developer Tools</h2>

        <div className="section-content">
          {/* Reload Extension Button */}
          <button
            onClick={handleReload}
            className="action-button"
            title="Reload the extension to apply changes"
          >
            <span className="action-icon">
              <RefreshIcon />
            </span>
            <span>Reload Extension</span>
          </button>

          {/* Logging Toggle */}
          <label className="toggle-row">
            <span className="toggle-label">Enable Logging</span>
            <button
              role="switch"
              aria-checked={loggingEnabled}
              onClick={handleLoggingToggle}
              className={`toggle-switch ${loggingEnabled ? 'active' : ''}`}
            >
              <span className="toggle-thumb" />
            </button>
          </label>
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
