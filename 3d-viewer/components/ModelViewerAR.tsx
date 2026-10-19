import React, { useEffect, useRef } from 'react';

interface ModelViewerARProps {
  modelUrl: string;
  title?: string;
}

export const ModelViewerAR: React.FC<ModelViewerARProps> = ({
  modelUrl,
  title = 'View in AR',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    // Check for AR support
    const isARSupported = navigator.xr?.isSessionSupported('immersive-ar');
    if (!isARSupported) {
      containerRef.current.innerHTML = '<p>AR is not supported on this device.</p>';
    }
  }, []);

  const handleViewInAR = async () => {
    try {
      if (navigator.xr) {
        const session = await navigator.xr.requestSession('immersive-ar');
        // AR session started - in production, render the model in AR
        console.log('AR session started', session);
      }
    } catch (err) {
      console.error('AR session failed:', err);
    }
  };

  return (
    <div className="model-viewer-ar" ref={containerRef}>
      <div className="ar-prompt">
        <div className="ar-icon">AR</div>
        <p>View this model in augmented reality</p>
        <button onClick={handleViewInAR} className="ar-button">
          {title}
        </button>
      </div>
      <model-viewer
        src={modelUrl}
        ar
        ar-modes="webxr scene-viewer quick-look"
        camera-controls
        auto-rotate
        style={{ width: '100%', height: '400px' }}
      />
    </div>
  );
};
