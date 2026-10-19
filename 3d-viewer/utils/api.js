const API_BASE = '/api';

export async function fetchModels() {
  const res = await fetch(`${API_BASE}/models`);
  if (!res.ok) throw new Error('Failed to fetch models');
  return res.json();
}

export async function fetchModelById(id) {
  const res = await fetch(`${API_BASE}/models/${id}`);
  if (!res.ok) throw new Error(`Model ${id} not found`);
  return res.json();
}

export async function uploadModel(formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/models/upload`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status === 200) resolve(JSON.parse(xhr.responseText));
      else reject(new Error('Upload failed'));
    };
    xhr.onerror = () => reject(new Error('Upload error'));
    xhr.send(formData);
  });
}

export async function deleteModel(id) {
  const res = await fetch(`${API_BASE}/models/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Delete failed');
  return res.json();
}

export async function searchModels(query) {
  const res = await fetch(`${API_BASE}/models/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error('Search failed');
  return res.json();
}
