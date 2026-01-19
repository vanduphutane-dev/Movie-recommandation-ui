// ===============================
// Global data
// ===============================
let movies = [];

// ===============================
// Load movies when page loads
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  fetch("movies.json")   // ⚠️ make sure this file exists
    .then(response => response.json())
    .then(data => {
      movies = data;
      populateDropdown();
      renderMovies("allMovies", movies);
    })
    .catch(error => {
      console.error("Error loading movies:", error);
    });
});

// ===============================
// Populate dropdown
// ===============================
function populateDropdown() {
  const select = document.getElementById("movieSelect");
  select.innerHTML = "";

  movies.forEach((movie, index) => {
    const option = document.createElement("option");
    option.value = index;
    option.textContent = movie.title;
    select.appendChild(option);
  });
}

// ===============================
// Render movie cards
// ===============================
function renderMovies(containerId, movieList) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  if (movieList.length === 0) {
    container.innerHTML = "<p>No results found.</p>";
    return;
  }

  movieList.forEach(movie => {
    const card = document.createElement("div");
    card.className = "movie-card";

    card.innerHTML = `
      <h3>${movie.title}</h3>
      <p><strong>Genres:</strong> ${movie.genres.join(", ")}</p>
      <p>${movie.description}</p>
    `;

    container.appendChild(card);
  });
}

// ===============================
// Recommend similar movies
// ===============================
function recommendSimilar() {
  const index = document.getElementById("movieSelect").value;
  const topN = parseInt(document.getElementById("topN").value);

  if (!movies[index]) return;

  const selected = movies[index];

  const scored = movies
    .map(movie => ({
      movie,
      score: similarity(selected, movie)
    }))
    .filter(item => item.movie !== selected)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map(item => item.movie);

  renderMovies("recommendations", scored);
}

// ===============================
// Recommend from text query
// ===============================
function recommendFromQuery() {
  const query = document.getElementById("queryInput").value.toLowerCase();
  const topN = parseInt(document.getElementById("topN").value);

  if (!query) return;

  const scored = movies
    .map(movie => ({
      movie,
      score: textSimilarity(query, movie)
    }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map(item => item.movie);

  renderMovies("recommendations", scored);
}

// ===============================
// Similarity functions
// ===============================
function similarity(a, b) {
  let score = 0;

  // genre overlap
  const commonGenres = a.genres.filter(g => b.genres.includes(g));
  score += commonGenres.length * 2;

  // description overlap
  score += textOverlap(a.description, b.description);

  return score;
}

function textSimilarity(query, movie) {
  return textOverlap(query, movie.description + " " + movie.genres.join(" "));
}

function textOverlap(text1, text2) {
  const words1 = text1.toLowerCase().split(/\W+/);
  const words2 = text2.toLowerCase().split(/\W+/);

  let count = 0;
  words1.forEach(word => {
    if (words2.includes(word)) count++;
  });

  return count;
}

