// Simple content-based recommender (TF-IDF on descriptions + genre binary vector).
// Loads movies.json and prepares vectors, then recommends similar movies by cosine similarity.

// ----- Utility functions -----
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w.trim());
}

function dot(a, b) {
  let s = 0;
  for (const k in a) if (b[k]) s += a[k] * b[k];
  return s;
}
function norm(vec) {
  let s = 0;
  for (const k in vec) s += vec[k] * vec[k];
  return Math.sqrt(s);
}
function cosine(a, b) {
  const d = dot(a, b);
  const na = norm(a), nb = norm(b);
  if (!na || !nb) return 0;
  return d / (na * nb);
}
// ----- Recommender pipeline -----
const MOVIES_URL = 'movies.json';
let movies = [];
let vocab = new Set();
let docsTokens = []; // array of token arrays
let idf = {}; // inverse doc freq
let tfidfVectors = []; // array of {term: weight}
let genreIndex = {}; // genre -> idx
let genreWeight = 1.2; // weight applied to genre vector dims

async function loadMovies() {
  const res = await fetch(MOVIES_URL);
  movies = await res.json();
}

function buildVocabAndTokens() {
  docsTokens = movies.map(m => {
    const tokens = tokenize((m.title || '') + ' ' + (m.description || ''));
    tokens.forEach(t => vocab.add(t));
    return tokens;
  });
}

function computeIdf() {
  const N = docsTokens.length;
  const df = {};
  docsTokens.forEach(tokens => {
    const seen = new Set(tokens);
    seen.forEach(t => df[t] = (df[t] || 0) + 1);
  });
  for (const t of vocab) {
    idf[t] = Math.log((N + 1) / ((df[t] || 0) + 1)) + 1; // smoothed idf
  }
}

function computeTfidfVectors() {
  tfidfVectors = docsTokens.map(tokens => {
    const tf = {};
    tokens.forEach(t => tf[t] = (tf[t] || 0) + 1);
    // convert to tf-idf
    const vec = {};
    for (const t in tf) {
      vec[t] = (tf[t] / tokens.length) * idf[t];
    }
    return vec;
  });
}

function buildGenreIndex() {
  let idx = 0;
  movies.forEach(m => {
    (m.genres || []).forEach(g => {
      if (!(g in genreIndex)) genreIndex[g] = idx++;
    });
  });
}

function movieFeatureVector(index) {
  // merge tfidfVectors[index] and genre vector (genre dims as term keys like "GENRE:Action")
  const vec = Object.assign({}, tfidfVectors[index]); // shallow copy
  const genres = movies[index].genres || [];
  genres.forEach(g => {
    const key = __genre__${g.toLowerCase()};
    vec[key] = (vec[key] || 0) + genreWeight;
  });
  return vec;
}

function queryToVector(query) {
  const tokens = tokenize(query);
  const tf = {};
  tokens.forEach(t => tf[t] = (tf[t] || 0) + 1);
  const vec = {};
  for (const t in tf) {
    if (idf[t]) vec[t] = (tf[t] / tokens.length) * idf[t];
  }
  // if user mentions genres as words, include them
  for (const g in genreIndex) {
    if (query.toLowerCase().includes(g.toLowerCase())) {
      const key = __genre__${g.toLowerCase()};
      vec[key] = (vec[key] || 0) + genreWeight;
    }
  }
  return vec;
}

function mergeVectors(a, b) {
  const out = {};
  for (const k in a) out[k] = a[k];
  for (const k in b) out[k] = (out[k] || 0) + b[k];
  return out;
}

function recommendByMovieId(id, topN = 6) {
  const idx = movies.findIndex(m => m.id === id);
  if (idx === -1) return [];
  const baseVec = movieFeatureVector(idx);
  const scores = movies.map((m, i) => {
    if (i === idx) return {i, score: -1}; // skip itself
    const v = movieFeatureVector(i);
    const s = cosine(baseVec, v);
    return {i, score: s};
  });
  scores.sort((a,b) => b.score - a.score);
  return scores.slice(0, topN).map(s => ({movie: movies[s.i], score: s.score}));
}
function recommendByQuery(query, topN = 6) {
  const qv = queryToVector(query);
  // compare qv with movieFeatureVector(i)
  const scores = movies.map((m,i) => {
    const v = movieFeatureVector(i);
    const s = cosine(qv, v);
    return {i, score: s};
  });
  scores.sort((a,b) => b.score - a.score);
  return scores.slice(0, topN).map(s => ({movie: movies[s.i], score: s.score}));
}

// ----- UI helpers -----
function makeCard(movie, score) {
  const card = document.createElement('div');
  card.className = 'card';
  const img = document.createElement('img');
  img.className = 'poster';
  img.src = movie.poster || https://via.placeholder.com/300x450?text=${encodeURIComponent(movie.title)};
  img.alt = movie.title;
  const content = document.createElement('div');
  content.className = 'card-content';
  const h3 = document.createElement('h3');
  h3.textContent = movie.title;
  const p = document.createElement('p');
  p.textContent = movie.description;
  const g = document.createElement('div');
  g.className = 'genres';
  g.textContent = (movie.genres || []).join(' • ');
  content.appendChild(h3);
  content.appendChild(p);
  content.appendChild(g);
  if (typeof score === 'number') {
    const s = document.createElement('div');
    s.style.fontSize = '12px';
    s.style.color = '#a3ffd8';
    s.style.marginTop = '6px';
    s.textContent = 'score: ' + score.toFixed(3);
    content.appendChild(s);
  }
  card.appendChild(img);
  card.appendChild(content);
  return card;
}

function populateMovieSelect() {
  const sel = document.getElementById('movieSelect');
  sel.innerHTML = '<option value="">-- choose movie --</option>';
  movies.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = ${m.title} (${(m.year||'')});
    sel.appendChild(opt);
  });
}

function showRecommendations(list, title = 'Recommendations') {
  const cards = document.getElementById('cards');
  const resultsTitle = document.getElementById('resultsTitle');
  resultsTitle.textContent = title;
  cards.innerHTML = '';
  if (list.length === 0) {
    cards.textContent = 'No recommendations found.';
    return;
  }
  list.forEach(item => {
    const card = makeCard(item.movie, item.score);
    cards.appendChild(card);
  });
}

function showAllMovies() {
  const all = document.getElementById('allCards');
  all.innerHTML = '';
  movies.forEach(m => {
    all.appendChild(makeCard(m));
  });
}

// ----- Wiring -----
async function init() {
  await loadMovies();
  buildVocabAndTokens();
  computeIdf();
  computeTfidfVectors();
  buildGenreIndex();

  populateMovieSelect();
  showAllMovies();

  document.getElementById('recommendBtn').addEventListener('click', () => {
    const sel = document.getElementById('movieSelect');
    const val = sel.value;
    const topN = Number(document.getElementById('topN').value) || 6;
    if (!val) return alert('Please select a movie');
    const recs = recommendByMovieId(val, topN);
    showRecommendations(recs, Because you liked "${movies.find(m => m.id===val).title}");
  });
 document.getElementById('queryRecommendBtn').addEventListener('click', () => {
    const q = document.getElementById('queryInput').value.trim();
    const topN = Number(document.getElementById('topN').value) || 6;
    if (!q) return alert('Please type a query describing what you like');
    const recs = recommendByQuery(q, topN);
    showRecommendations(recs, Recommendations for: "${q}");
  });

  // search-as-you-type: filter movie select and all list
  const qinput = document.getElementById('queryInput');
  qinput.addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    if (!q) {
      populateMovieSelect();
      showAllMovies();
      return;
    }
    const filtered = movies.filter(m => (m.title + ' ' + (m.description||'') + ' ' + (m.genres||[]).join(' ')).toLowerCase().includes(q));
    const sel = document.getElementById('movieSelect');
    sel.innerHTML = '<option value="">-- choose movie --</option>';
    filtered.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = ${m.title} (${m.year||''});
      sel.appendChild(opt);
    });
    const all = document.getElementById('allCards');
    all.innerHTML = '';
    filtered.forEach(m => all.appendChild(makeCard(m)));
  });
}

init().catch(err => {
  console.error(err);
  document.getElementById('cards').textContent = 'Failed to load movies';

});
function renderMovies(containerId, movies) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  if (movies.length === 0) {
    container.innerHTML = "<p>No results found.</p>";
    return;
  }

  movies.forEach(m => {
    const card = document.createElement("div");
    card.className = "movie-card";

    card.innerHTML = `
      <h3>${m.title}</h3>
      <p><strong>Genres:</strong> ${m.genres}</p>
      <p>${m.description.slice(0, 120)}...</p>
    `;

    container.appendChild(card);
  });
}
