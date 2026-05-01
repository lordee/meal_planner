const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const app = express();
const PORT = 3001;
const DATA_FILE = path.join(__dirname, '../data/meals.md');
const RECIPES_FILE = path.join(__dirname, '../data/recipes.md');
const UPLOADS_DIR = path.join(__dirname, '../uploads');

// Configure Multer for image storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'upload-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Initialize Gemini
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

app.use(cors());
app.use(bodyParser.json());

// Serve static files from the React frontend app
app.use(express.static(path.join(__dirname, '../frontend/dist')));
// Serve uploaded images statically
app.use('/uploads', express.static(UPLOADS_DIR));

// Image Upload Endpoint
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const imageUrl = `/uploads/${req.file.filename}`;
  res.json({ imageUrl });
});

// Helper to wrap JSON in Markdown
const wrapInMarkdown = (data, title = 'Weekly Meal Plan') => {
  return `# ${title}\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`\n`;
};

// Helper to extract JSON from Markdown with migration support
const extractFromJsonMarkdown = (content, type = 'plans') => {
  const match = content.match(/```json\n([\s\S]*?)\n```/);
  if (!match) return [];
  const data = JSON.parse(match[1]);
  
  // Migration: If type is plans and data is the old single-week format (array of days)
  if (type === 'plans' && Array.isArray(data) && data.length > 0 && data[0].day) {
    return [{
      id: 'initial-week',
      name: 'Initial Week',
      archived: false,
      days: data
    }];
  }
  
  return data;
};

app.get('/api/meals', (req, res) => {
  if (!fs.existsSync(DATA_FILE)) {
    return res.json([]);
  }
  const content = fs.readFileSync(DATA_FILE, 'utf8');
  try {
    const data = extractFromJsonMarkdown(content, 'plans');
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
    const data = extractFromJsonMarkdown(content, 'recipes');
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
  if (!genAI) {
    return res.status(400).json({ error: 'Gemini API key not configured. Please add GEMINI_API_KEY to your environment.' });
  }

  const { ingredients } = req.body;
  if (!ingredients) {
    return res.json({ formatted: '' });
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
    const prompt = `Format the following list of ingredients into a clean, standardized list using a strict pipe-separated format: "Quantity | Unit | Product". 
    
    Rules:
    1. Quantity: Use numbers, decimals, or ranges (e.g., 1, 0.5, 2-3). If no quantity is specified, use "1".
    2. Unit: Use standard cooking units (e.g., cups, kg, tsp, g) or leave empty if it's a count (like 3 onions).
    3. Product: The core ingredient name only. EXCLUDE all preparation instructions (e.g., remove "diced", "chopped", "minced", "to taste", "optional").
    
    Examples:
    "two cups of flour" -> "2 | cups | flour"
    "a kilo of chicken diced" -> "1 | kg | chicken"
    "2-3 Medium Potatoes, Diced" -> "2-3 | | medium potatoes"
    "half a cup milk" -> "0.5 | cup | milk"
    
    Return ONLY the formatted list, one per line. No headers or markdown.
    
    Ingredients:
    ${ingredients}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();
    res.json({ formatted: text });
  } catch (err) {
    console.error('Gemini error:', err.message);
    res.status(500).json({ error: `AI formatting failed: ${err.message}` });
  }
});

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
// In Express 5, we use a middleware at the end to catch all remaining requests
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  if (!process.env.GEMINI_API_KEY) {
    console.warn('Warning: GEMINI_API_KEY not found in environment. AI formatting will be disabled.');
  }
});
