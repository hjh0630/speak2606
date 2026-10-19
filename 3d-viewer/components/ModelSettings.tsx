import React, { useState } from 'react';

interface ViewerSettings {
  antialiasing: boolean;
  shadows: boolean;
  gridHelper: boolean;
  axesHelper: boolean;
  autoRotate: boolean;
  backgroundColor: string;
  renderScale: number;
  maxFPS: number;
}

export const ModelSettings: React.FC = () => {
  const [settings, setSettings] = useState<ViewerSettings>({
    antialiasing: true,
    shadows: true,
    gridHelper: true,
    axesHelper: false,
    autoRotate: false,
    backgroundColor: '#1a1a2e',
    renderScale: 1.0,
    maxFPS: 60,
  });

  const updateSetting = <K extends keyof ViewerSettings>(
    key: K,
    value: ViewerSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="model-settings">
      <h3>Viewer Settings</h3>
      <div className="settings-group">
        <label className="setting-item">
          <span>Anti-aliasing</span>
          <input
            type="checkbox"
            checked={settings.antialiasing}
            onChange={(e) => updateSetting('antialiasing', e.target.checked)}
          />
        </label>
        <label className="setting-item">
          <span>Shadows</span>
          <input
            type="checkbox"
            checked={settings.shadows}
            onChange={(e) => updateSetting('shadows', e.target.checked)}
          />
        </label>
        <label className="setting-item">
          <span>Grid Helper</span>
          <input
            type="checkbox"
            checked={settings.gridHelper}
            onChange={(e) => updateSetting('gridHelper', e.target.checked)}
          />
        </label>
        <label className="setting-item">
          <span>Axes Helper</span>
          <input
            type="checkbox"
            checked={settings.axesHelper}
            onChange={(e) => updateSetting('axesHelper', e.target.checked)}
          />
        </label>
        <label className="setting-item">
          <span>Auto Rotate</span>
          <input
            type="checkbox"
            checked={settings.autoRotate}
            onChange={(e) => updateSetting('autoRotate', e.target.checked)}
          />
        </label>
        <label className="setting-item">
          <span>Background Color</span>
          <input
            type="color"
            value={settings.backgroundColor}
            onChange={(e) => updateSetting('backgroundColor', e.target.value)}
          />
        </label>
        <label className="setting-item">
          <span>Render Scale: {settings.renderScale.toFixed(1)}x</span>
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.1"
            value={settings.renderScale}
            onChange={(e) => updateSetting('renderScale', parseFloat(e.target.value))}
          />
        </label>
        <label className="setting-item">
          <span>Max FPS: {settings.maxFPS}</span>
          <input
            type="range"
            min="30"
            max="144"
            step="1"
            value={settings.maxFPS}
            onChange={(e) => updateSetting('maxFPS', parseInt(e.target.value))}
          />
        </label>
      </div>
    </div>
  );
};
