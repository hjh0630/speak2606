import React, { useEffect, useRef } from 'react';

interface ModelViewerWebXRProps {
  modelUrl: string;
  immersiveMode?: 'inline' | 'immersive-vr' | 'immersive-ar';
}

export const ModelViewerWebXR: React.FC<ModelViewerWebXRProps> = ({
  modelUrl,
  immersiveMode = 'immersive-ar',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (!navigator.xr) {
      containerRef.current.innerHTML = '<p>WebXR is not supported in this browser.</p>';
      return;
    }
    navigator.xr.isSessionSupported(immersiveMode).then((supported) => {
      if (!supported) {
        containerRef.current!.innerHTML =
          `<p>WebXR mode "${immersiveMode}" is not supported.</p>`;
      }
    });
  }, [immersiveMode]);

  const handleRequestSession = async () => {
    try {
      if (navigator.xr) {
        const session = await navigator.xr.requestSession(immersiveMode);
        session.addEventListener('end', () => {
          console.log('WebXR session ended');
        });
        console.log('WebXR session started:', session);
      }
    } catch (err) {
      console.error('WebXR session request failed:', err);
    }
  };

  return (
    <div className="model-viewer-webxr" ref={containerRef}>
      <div className="webxr-prompt">
        <div className="webxr-icon">WebXR</div>
        <h3>WebXR Standard</h3>
        <p>Using WebXR Device API - Mode: {immersiveMode}</p>
        <button onClick={handleRequestSession} className="webxr-button">
          Start WebXR Session
        </button>
      </div>
    </div>
  );
};
