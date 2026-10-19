import React, { useEffect, useRef } from 'react';

interface ModelViewerVRProps {
  modelUrl: string;
}

export const ModelViewerVR: React.FC<ModelViewerVRProps> = ({ modelUrl }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    // Check VR support
    navigator.xr?.isSessionSupported('immersive-vr').then((supported) => {
      if (!supported) {
        containerRef.current!.innerHTML = '<p>VR is not supported on this device.</p>';
      }
    });
  }, []);

  const handleEnterVR = async () => {
    try {
      if (navigator.xr) {
        const session = await navigator.xr.requestSession('immersive-vr');
        console.log('VR session started', session);
      }
    } catch (err) {
      console.error('VR session failed:', err);
    }
  };

  return (
    <div className="model-viewer-vr" ref={containerRef}>
      <div className="vr-prompt">
        <div className="vr-icon">VR</div>
        <h3>Virtual Reality Viewing</h3>
        <p>Put on your VR headset to experience this model in immersive VR</p>
        <button onClick={handleEnterVR} className="vr-button">
          Enter VR
        </button>
      </div>
    </div>
  );
};
