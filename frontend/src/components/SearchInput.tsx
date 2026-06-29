import { useState, useCallback, useRef, useEffect } from "react";

interface Props {
  onSearch: (query: string) => void;
  isLoading?: boolean;
  resultCount?: number;
}

export function SearchInput({ onSearch, isLoading = false, resultCount }: Props) {
  const [query, setQuery] = useState("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search - 300ms delay
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      onSearch(query);
    }, 300);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [query, onSearch]);

  const handleClear = useCallback(() => {
    setQuery("");
  }, []);

  const isSearching = query.length > 0;

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 border-b border-gray-300">
      <svg
        className="w-4 h-4 text-gray-500"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <input
        type="text"
        placeholder="Search messages"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        data-testid="search-input"
        className="flex-1 bg-transparent text-sm outline-none"
      />
      {isSearching && (
        <div className="flex items-center gap-2">
          {isLoading && (
            <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          )}
          {!isLoading && resultCount !== undefined && (
            <span className="text-xs text-gray-600" data-testid="result-count">
              {resultCount} {resultCount === 1 ? "result" : "results"}
            </span>
          )}
          <button
            onClick={handleClear}
            aria-label="Clear search"
            data-testid="clear-search-btn"
            className="text-gray-500 hover:text-gray-700 p-1"
          >
            <svg
              className="w-4 h-4"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
