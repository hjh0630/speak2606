import React, { useState, useCallback } from 'react';

interface UploadState {
  isUploading: boolean;
  progress: number;
  file: File | null;
  error: string | null;
}

const ALLOWED_TYPES = ['.glb', '.gltf', '.obj', '.fbx', '.stl', '.ply', '.3ds'];

export const ModelUpload: React.FC = () => {
  const [uploadState, setUploadState] = useState<UploadState>({
    isUploading: false,
    progress: 0,
    file: null,
    error: null,
  });

  const validateFile = (file: File): string | null => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_TYPES.includes(ext)) {
      return `Unsupported file type: ${ext}. Allowed: ${ALLOWED_TYPES.join(', ')}`;
    }
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      return `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Max: 100MB`;
    }
    return null;
  };

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const error = validateFile(file);
    if (error) {
      setUploadState((prev) => ({ ...prev, error }));
      return;
    }
    setUploadState({ isUploading: false, progress: 0, file, error: null });
  }, []);

  const handleUpload = async () => {
    const { file } = uploadState;
    if (!file) return;
    setUploadState((prev) => ({ ...prev, isUploading: true, progress: 0, error: null }));
    // Simulate upload progress
    const interval = setInterval(() => {
      setUploadState((prev) => ({
        ...prev,
        progress: Math.min(prev.progress + 10, 90),
      }));
    }, 500);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 3000));
    clearInterval(interval);
    setUploadState((prev) => ({
      ...prev,
      isUploading: false,
      progress: 100,
      error: null,
    }));
  };

  const { file, isUploading, progress, error } = uploadState;

  return (
    <div className="model-upload">
      <h3>Upload 3D Model</h3>
      <div className="upload-dropzone">
        <input
          type="file"
          accept={ALLOWED_TYPES.join(',')}
          onChange={handleFileSelect}
          disabled={isUploading}
          className="file-input"
        />
        {!file && <p>Drag & drop or click to select a 3D model file</p>}
        {file && <p>Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)</p>}
      </div>
      {error && <div className="upload-error">{error}</div>}
      {file && !isUploading && (
        <button onClick={handleUpload} className="upload-btn">
          Upload Model
        </button>
      )}
      {isUploading && (
        <div className="upload-progress">
          <div className="progress-bar" style={{ width: `${progress}%` }} />
          <span>{progress}%</span>
        </div>
      )}
      {progress === 100 && <div className="upload-success">Upload complete!</div>}
    </div>
  );
};
