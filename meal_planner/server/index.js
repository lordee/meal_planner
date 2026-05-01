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

// Home Assistant detection
const IS_HA_ADDON = fs.existsSync('/data/options.json');
const DATA_DIR = IS_HA_ADDON ? '/data' : path.join(__dirname, '../data');
const UPLOADS_DIR = IS_HA_ADDON ? '/data/uploads' : path.join(__dirname, '../uploads');

const DATA_FILE = path.join(DATA_DIR, 'meals.md');
const RECIPES_FILE = path.join(DATA_DIR, 'recipes.md');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Load Home Assistant Add-on Options if available
let config = {};
try {
  if (fs.existsSync('/data/options.json')) {
    config = JSON.parse(fs.readFileSync('/data/options.json', 'utf8'));
    console.log('Home Assistant options loaded');
  }
} catch (err) {
  console.warn('Could not load Home Assistant options:', err.message);
}

// Configuration priority: HA Options > Environment Variables > Defaults
const GEMINI_API_KEY = config.gemini_api_key || process.env.GEMINI_API_KEY;

// Initialize Gemini
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;


app.use(cors());
app.use(bodyParser.json());

// API Endpoints
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const imageUrl = `/uploads/${req.file.filename}`;
  res.json({ imageUrl });
});

// Image Upload from URL Endpoint
app.post('/api/upload-url', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
    
    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type');
    let extension = '.jpg';
    if (contentType && contentType.includes('/')) {
      extension = `.${contentType.split('/')[1].split(';')[0]}`;
    }
    
    const filename = `${Date.now()}${extension}`;
    const filePath = path.join(UPLOADS_DIR, filename);
    
    fs.writeFileSync(filePath, Buffer.from(buffer));
    
    const imageUrl = `/uploads/${filename}`;
    res.json({ imageUrl });
  } catch (err) {
    console.error('URL upload error:', err.message);
    res.status(500).json({ error: 'Failed to download image' });
  }
});

// List Local Images Endpoint
app.get('/api/images', (req, res) => {
  if (!fs.existsSync(UPLOADS_DIR)) {
    return res.json([]);
  }
  try {
    const files = fs.readdirSync(UPLOADS_DIR);
    const images = files
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
      })
      .map(file => `/uploads/${file}`);
    res.json(images);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list images' });
  }
});

// Delete Local Image Endpoint
app.post('/api/delete-image', (req, res) => {
  const { imageUrl } = req.body;
  if (!imageUrl || !imageUrl.startsWith('/uploads/')) {
    return res.status(400).json({ error: 'Valid image URL required' });
  }

  const filename = path.basename(imageUrl);
  const filePath = path.join(UPLOADS_DIR, filename);

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Image not found' });
    }
  } catch (err) {
    console.error('Delete error:', err.message);
    res.status(500).json({ error: 'Failed to delete image' });
  }
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
    return res.status(400).json({ error: 'Gemini API key not configured. Please add gemini_api_key to your Home Assistant Add-on configuration or environment.' });
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

// Static files and Catch-all
// Serve static files from the React frontend app
app.use(express.static(path.join(__dirname, '../frontend/dist')));
// Serve uploaded images statically
app.use('/uploads', express.static(UPLOADS_DIR));

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get(/^(?!\/api\/|\/uploads\/).*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});



// Explicitly handle 404s for API and Uploads that fall through
app.use('/api', (req, res) => res.status(404).json({ error: 'API route not found' }));
app.use('/uploads', (req, res) => res.status(404).json({ error: 'Image not found' }));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  if (!GEMINI_API_KEY) {
    console.warn('Warning: Gemini API key not found. AI formatting will be disabled.');
  }
});
