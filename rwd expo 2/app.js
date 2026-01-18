const API_BASE = ''; // empty = same origin, or 'http://localhost:4000' if front-end served separately

async function fetchMovies() {
  const res = await fetch(${API_BASE}/api/movies);
  return res.json();
}

async function fetchGenres() {
  const res = await fetch(${API_BASE}/api/genres);
  return res.json();
}

async function fetchRecommendations(id, topN = 6) {
  const res = await fetch(${API_BASE}/api/recommendations/${id}?topN=${topN});
  const json = await res.json();
  return json.recommendations || [];
}

// Example usage: integrating with previous UI code
// Replace the static movies variable with data fetched from fetchMovies()

(async function init() {
  window.movies = await fetchMovies(); // for debugging like before
  buildGenreFiltersFromData(window.movies); // implement similarly to previous buildGenreFilters
  renderMovies(window.movies); // existing render function reused
})();

// When showing details and clicking "Recommend similar", use fetchRecommendations(openMovie.id)