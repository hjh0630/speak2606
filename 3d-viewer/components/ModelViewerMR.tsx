import React, { useEffect, useRef } from 'react';

interface ModelViewerMRProps {
  modelUrl: string;
}

export const ModelViewerMR: React.FC<ModelViewerMRProps> = ({ modelUrl }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    navigator.xr?.isSessionSupported('immersive-ar').then((supported) => {
      if (!supported) {
        containerRef.current!.innerHTML = '<p>Mixed Reality is not supported on this device.</p>';
      }
    });
  }, []);

  const handleEnterMR = async () => {
    try {
      if (navigator.xr) {
        const session = await navigator.xr.requestSession('immersive-ar', {
          optionalFeatures: ['hand-tracking', 'hit-test'],
        });
        console.log('MR session started', session);
      }
    } catch (err) {
      console.error('MR session failed:', err);
    }
  };

  return (
    <div className="model-viewer-mr" ref={containerRef}>
      <div className="mr-prompt">
        <div className="mr-icon">MR</div>
        <h3>Mixed Reality Experience</h3>
        <p>Blend digital models with your physical environment</p>
        <button onClick={handleEnterMR} className="mr-button">
          Start MR Experience
        </button>
      </div>
    </div>
  );
};
