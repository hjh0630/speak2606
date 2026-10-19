import React, { useState, useCallback } from 'react';

interface SearchResult {
  id: string;
  name: string;
  type: string;
  matchField: string;
}

export const ModelSearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }
    setIsSearching(true);
    // Simulated search - in production, this would query an API
    setTimeout(() => {
      setResults([
        { id: '1', name: 'Shoe Upper Model A', type: '3D Model', matchField: 'name' },
        { id: '2', name: 'Shoe Upper Model B', type: '3D Model', matchField: 'tags' },
      ]);
      setIsSearching(false);
    }, 300);
  }, []);

  return (
    <div className="model-search">
      <div className="search-input-wrapper">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            handleSearch(e.target.value);
          }}
          placeholder="Search models by name, tags, or description..."
          className="search-input"
        />
        {isSearching && <span className="search-spinner" />}
      </div>
      {results.length > 0 && (
        <div className="search-results">
          {results.map((result) => (
            <div key={result.id} className="search-result-item">
              <span className="result-name">{result.name}</span>
              <span className="result-type">{result.type}</span>
              <span className="result-match">Matched: {result.matchField}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
