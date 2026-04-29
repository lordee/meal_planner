const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const app = express();
const PORT = 3001;
const DATA_FILE = path.join(__dirname, '../data/meals.md');
const RECIPES_FILE = path.join(__dirname, '../data/recipes.md');

// Initialize Gemini
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

app.use(cors());
app.use(bodyParser.json());

// Serve static files from the React frontend app
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Helper to wrap JSON in Markdown
const wrapInMarkdown = (data, title = 'Weekly Meal Plan') => {
  return `# ${title}\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`\n`;
};

// Helper to extract JSON from Markdown
const extractFromJsonMarkdown = (content) => {
  const match = content.match(/```json\n([\s\S]*?)\n```/);
  return match ? JSON.parse(match[1]) : [];
};

app.get('/api/meals', (req, res) => {
  if (!fs.existsSync(DATA_FILE)) {
    return res.json([]);
  }
  const content = fs.readFileSync(DATA_FILE, 'utf8');
  try {
    const data = extractFromJsonMarkdown(content);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to parse meal data' });
  }
});

app.post('/api/meals', (req, res) => {
  const data = req.body;
  const content = wrapInMarkdown(data, 'Weekly Meal Plan');
  fs.writeFileSync(DATA_FILE, content, 'utf8');
  res.json({ success: true });
});

app.get('/api/recipes', (req, res) => {
  if (!fs.existsSync(RECIPES_FILE)) {
    return res.json([]);
  }
  const content = fs.readFileSync(RECIPES_FILE, 'utf8');
  try {
    const data = extractFromJsonMarkdown(content);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to parse recipe data' });
  }
});

app.post('/api/recipes', (req, res) => {
  const data = req.body;
  const content = wrapInMarkdown(data, 'Saved Recipes');
  fs.writeFileSync(RECIPES_FILE, content, 'utf8');
  res.json({ success: true });
});

// Gemini Ingredient Formatting Endpoint
app.post('/api/format-ingredients', async (req, res) => {
// ... existing logic ...
});

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

app.listen(PORT, () => {

  console.log(`Server running on http://localhost:${PORT}`);
  if (!process.env.GEMINI_API_KEY) {
    console.warn('Warning: GEMINI_API_KEY not found in environment. AI formatting will be disabled.');
  }
});
