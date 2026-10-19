import React, { useEffect, useRef } from 'react';

interface ModelViewerXRProps {
  modelUrl: string;
  mode?: 'ar' | 'vr' | 'mr';
}

export const ModelViewerXR: React.FC<ModelViewerXRProps> = ({
  modelUrl,
  mode = 'ar',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const sessionMode = mode === 'vr' ? 'immersive-vr' : 'immersive-ar';
    navigator.xr?.isSessionSupported(sessionMode).then((supported) => {
      if (!supported) {
        containerRef.current!.innerHTML = `<p>XR (${mode}) is not supported on this device.</p>`;
      }
    });
  }, [mode]);

  const handleEnterXR = async () => {
    try {
      if (navigator.xr) {
        const sessionMode = mode === 'vr' ? 'immersive-vr' : 'immersive-ar';
        const session = await navigator.xr.requestSession(sessionMode);
        console.log('XR session started', session);
      }
    } catch (err) {
      console.error('XR session failed:', err);
    }
  };

  return (
    <div className="model-viewer-xr" ref={containerRef}>
      <div className="xr-prompt">
        <div className="xr-icon">XR</div>
        <h3>Extended Reality ({mode.toUpperCase()})</h3>
        <p>Experience this model in {mode.toUpperCase()} mode</p>
        <button onClick={handleEnterXR} className="xr-button">
          Enter {mode.toUpperCase()}
        </button>
      </div>
    </div>
  );
};
