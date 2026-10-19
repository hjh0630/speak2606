import React, { useState } from 'react';

interface CompareModel {
  id: string;
  name: string;
  thumbnail: string;
  vertexCount: number;
  faceCount: number;
  materialCount: number;
}

export const ModelCompare: React.FC = () => {
  const [selectedModels, setSelectedModels] = useState<CompareModel[]>([]);
  const [isComparing, setIsComparing] = useState(false);

  const availableModels: CompareModel[] = [
    { id: '1', name: 'Model A', thumbnail: '', vertexCount: 15000, faceCount: 30000, materialCount: 3 },
    { id: '2', name: 'Model B', thumbnail: '', vertexCount: 22000, faceCount: 44000, materialCount: 5 },
    { id: '3', name: 'Model C', thumbnail: '', vertexCount: 18000, faceCount: 36000, materialCount: 2 },
  ];

  const toggleModel = (model: CompareModel) => {
    setSelectedModels((prev) =>
      prev.find((m) => m.id === model.id)
        ? prev.filter((m) => m.id !== model.id)
        : [...prev, model]
    );
  };

  return (
    <div className="model-compare">
      <h3>Compare Models</h3>
      <div className="model-selector">
        {availableModels.map((model) => (
          <label key={model.id} className="compare-checkbox">
            <input
              type="checkbox"
              checked={selectedModels.some((m) => m.id === model.id)}
              onChange={() => toggleModel(model)}
            />
            {model.name}
          </label>
        ))}
      </div>
      {selectedModels.length >= 2 && (
        <button onClick={() => setIsComparing(true)} className="compare-btn">
          Compare Selected ({selectedModels.length})
        </button>
      )}
      {isComparing && selectedModels.length > 0 && (
        <div className="comparison-table">
          <table>
            <thead>
              <tr>
                <th>Property</th>
                {selectedModels.map((m) => (
                  <th key={m.id}>{m.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Vertices</td>
                {selectedModels.map((m) => (
                  <td key={m.id}>{m.vertexCount.toLocaleString()}</td>
                ))}
              </tr>
              <tr>
                <td>Faces</td>
                {selectedModels.map((m) => (
                  <td key={m.id}>{m.faceCount.toLocaleString()}</td>
                ))}
              </tr>
              <tr>
                <td>Materials</td>
                {selectedModels.map((m) => (
                  <td key={m.id}>{m.materialCount}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
