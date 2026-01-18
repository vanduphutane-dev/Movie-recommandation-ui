const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data', 'movies.json');

const app = express();
app.use(cors());
app.use(express.json());

// Load movies
function loadMovies() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load movies.json', e);
    return [];
  }
}

function saveMovies(movies) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(movies, null, 2), 'utf8');
}

// Simple tokenizer: lowercase, split on non-word, remove empty tokens
function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(Boolean);
}

// Stopwords (small set)
const STOPWORDS = new Set([
  'the','and','a','an','of','in','on','to','for','with','is','are','by','from','that','this','it','as','be','was','which'
]);

function tokenizeFiltered(text) {
  return tokenize(text).filter(t => !STOPWORDS.has(t));
}

// Build TF-IDF index
let movies = loadMovies();
let vocabulary = []; // array of terms
let termIndex = {}; // term -> idx
let docTfIdf = []; // array of { id, vec (Float64Array of length V), norm }
let builtAt = null;

function buildIndex() {
  // documents: combined text per movie
  const docs = movies.map(m => {
    const textParts = [
      m.title || '',
      (m.genres || []).join(' '),
      (m.keywords || []).join(' '),
      m.desc || ''
    ];
    return tokenizeFiltered(textParts.join(' '));
  });

  // Build vocab and document frequencies
  const df = {};
  docs.forEach(tokens => {
    const seen = new Set();
    tokens.forEach(t => {
      if (!seen.has(t)) {
        df[t] = (df[t] || 0) + 1;
        seen.add(t);
      }
    });
  });

  vocabulary = Object.keys(df).sort();
  termIndex = {};
  vocabulary.forEach((t, i) => termIndex[t] = i);

  const N = docs.length;
  const idf = vocabulary.map(t => Math.log((N) / (1 + (df[t] || 0))) + 1); // smoothed idf

  // Build normalized TF-IDF vectors
  docTfIdf = docs.map((tokens, docIdx) => {
    const tf = {};
    tokens.forEach(t => tf[t] = (tf[t] || 0) + 1);
    // compute tf-idf vector as dense Float64Array
    const vec = new Float64Array(vocabulary.length);
    for (const [t, cnt] of Object.entries(tf)) {
      const idx = termIndex[t];
      if (idx === undefined) continue;
      // raw tf, optionally use log-scaling
      const tfVal = 1 + Math.log(cnt);
      vec[idx] = tfVal * idf[idx];
    }
    // normalize
    let norm = 0;
    for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < vec.length; i++) vec[i] = vec[i] / norm;
    return { id: movies[docIdx].id, vec, norm };
  });

  builtAt = new Date().toISOString();
  console.log(Index built: ${movies.length} docs, vocab=${vocabulary.length});
}

// Cosine similarity between two normalized vectors (dot product)
function cosine(vecA, vecB) {
  const len = Math.min(vecA.length, vecB.length);
  let s = 0;
  for (let i = 0; i < len; i++) s += vecA[i] * vecB[i];
  return s;
}
/ Recommend function
function recommendFor(id, topN = 5) {
  const idx = docTfIdf.findIndex(d => d.id === Number(id));
  if (idx === -1) return [];
  const base = docTfIdf[idx];
  const scores = [];
  for (let i = 0; i < docTfIdf.length; i++) {
    if (i === idx) continue;
    const other = docTfIdf[i];
    const score = cosine(base.vec, other.vec);
    scores.push({ id: other.id, score });
  }
  scores.sort((a, b) => b.score - a.score);
  const results = scores.slice(0, topN).map(s => {
    const m = movies.find(x => x.id === s.id);
    return {
      ...m,
      score: Number(s.score.toFixed(4))
    };
  });
  return results;
}

// Build initial index
buildIndex();

// Routes
app.get('/api/movies', (req, res) => {
  res.json(movies);
});

app.get('/api/movies/:id', (req, res) => {
  const id = Number(req.params.id);
  const m = movies.find(x => x.id === id);
  if (!m) return res.status(404).json({ error: 'Movie not found' });
  res.json(m);
});

app.get('/api/genres', (req, res) => {
  const all = Array.from(new Set(movies.flatMap(m => m.genres || []))).sort();
  res.json(all);
});

app.get('/api/recommendations/:id', (req, res) => {
  const id = Number(req.params.id);
  const topN = Number(req.query.topN) || 5;
  const recs = recommendFor(id, topN);
  res.json({ baseId: id, recommendations: recs, builtAt });
});

// Add movie (very small validation)
app.post('/api/movies', (req, res) => {
  const body = req.body;
  if (!body || !body.title) return res.status(400).json({ error: 'Missing title' });
  const newId = movies.reduce((max, m) => Math.max(max, m.id || 0), 0) + 1;
  const movie = {
    id: newId,
    title: body.title,
    year: body.year || null,
    genres: body.genres || [],
    keywords: body.keywords || [],
    poster: body.poster || '',
    desc: body.desc || ''
  };
  movies.push(movie);
  try {
    // persist
    saveMovies(movies);
    // rebuild index in-memory
    buildIndex();
    res.status(201).json(movie);
  } catch (e) {
    console.error('Failed to save movie', e);
    res.status(500).json({ error: 'Failed to save' });
  }
});

// Optional: serve static frontend if you put the site in /public
const publicDir = path.join(__dirname, 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  console.log('Serving static frontend from /public');
}

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(Movie recommender API listening on http://localhost:${PORT});
});