let movies = [];
let allGenres = [];

// Load movies.json when page loads
fetch("movies.json")
  .then(res => res.json())
  .then(data => {
    movies = data;
    extractGenres();
    populateGenreDropdown();
    showAllMovies();
  })
  .catch(err => console.error("Error loading movies:", err));

/* -----------------------------
   GENRE HANDLING
------------------------------*/

// Extract unique genres from movies
function extractGenres() {
  const genreSet = new Set();
  movies.forEach(movie => {
    movie.genres.forEach(g => genreSet.add(g));
  });
  allGenres = Array.from(genreSet).sort();
}

// Populate dropdown with genres
function populateGenreDropdown() {
  const select = document.getElementById("movieSelect");
  select.innerHTML = `<option value="">Select a genre</option>`;

  allGenres.forEach(genre => {
    const option = document.createElement("option");
    option.value = genre;
    option.textContent = genre;
    select.appendChild(option);
  });
}

/* -----------------------------
   RECOMMEND BY GENRE
------------------------------*/

function recommendSimilar() {
  const selectedGenre = document.getElementById("movieSelect").value;
  const topN = parseInt(document.getElementById("topN").value) || 6;

  if (!selectedGenre) {
    alert("Please select a genre");
    return;
  }

  const results = movies.filter(movie =>
    movie.genres.includes(selectedGenre)
  );

  displayRecommendations(results.slice(0, topN));
}

/* -----------------------------
   RECOMMEND BY TEXT QUERY
------------------------------*/

function recommendFromQuery() {
  const query = document.getElementById("queryInput").value.toLowerCase();
  const topN = parseInt(document.getElementById("topN").value) || 6;

  if (!query) {
    alert("Please enter a description or genre keyword");
    return;
  }

  const scored = movies.map(movie => {
    let score = 0;

    if (movie.description.toLowerCase().includes(query)) score += 2;

    movie.genres.forEach(g => {
      if (query.includes(g.toLowerCase())) score += 1;
    });

    return { ...movie, score };
  });

  const results = scored
    .filter(m => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);

  displayRecommendations(results);
}

/* -----------------------------
   DISPLAY FUNCTIONS
------------------------------*/

function displayRecommendations(list) {
  const container = document.getElementById("recommendations");
  container.innerHTML = "";

  if (list.length === 0) {
    container.innerHTML = "<p>No recommendations found.</p>";
    return;
  }

  list.forEach(movie => {
    container.appendChild(createMovieCard(movie));
  });
}

function showAllMovies() {
  const container = document.getElementById("allMovies");
  container.innerHTML = "";

  movies.forEach(movie => {
    container.appendChild(createMovieCard(movie));
  });
}

// Create movie card
function createMovieCard(movie) {
  const card = document.createElement("div");
  card.className = "movie-card";

  card.innerHTML = `
    <h3>${movie.title}</h3>
    <p><strong>Genres:</strong> ${movie.genres.join(", ")}</p>
    <p>${movie.description}</p>
  `;

  return card;
}
