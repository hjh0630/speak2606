import React from 'react';

interface ModelDetailProps {
  modelId: string;
  modelName: string;
  modelType: string;
  vertexCount: number;
  faceCount: number;
  materialCount: string;
  fileSize: string;
  createdAt: string;
  updatedAt: string;
  description: string;
  tags: string[];
}

export const ModelDetail: React.FC<{ model: ModelDetailProps }> = ({ model }) => {
  return (
    <div className="model-detail">
      <div className="detail-header">
        <h2>{model.modelName}</h2>
        <span className="model-type-badge">{model.modelType}</span>
      </div>
      <div className="detail-stats">
        <div className="stat-item">
          <label>Vertices</label>
          <span>{model.vertexCount.toLocaleString()}</span>
        </div>
        <div className="stat-item">
          <label>Faces</label>
          <span>{model.faceCount.toLocaleString()}</span>
        </div>
        <div className="stat-item">
          <label>Materials</label>
          <span>{model.materialCount}</span>
        </div>
        <div className="stat-item">
          <label>File Size</label>
          <span>{model.fileSize}</span>
        </div>
      </div>
      <div className="detail-description">
        <h3>Description</h3>
        <p>{model.description}</p>
      </div>
      <div className="detail-tags">
        <h3>Tags</h3>
        <div className="tags-list">
          {model.tags.map((tag, i) => (
            <span key={i} className="tag">{tag}</span>
          ))}
        </div>
      </div>
      <div className="detail-dates">
        <span>Created: {model.createdAt}</span>
        <span>Updated: {model.updatedAt}</span>
      </div>
    </div>
  );
};
