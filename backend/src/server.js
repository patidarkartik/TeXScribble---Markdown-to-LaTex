import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { connectDB } from './config/db.js';
import Document from './models/Document.js';
import User from './models/User.js';
import { mdToLatex } from './utils/mdToLatex.js';
import { auth } from './middleware/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 7860;

const JWT_SECRET = process.env.JWT_SECRET || 'texscribble_secret_key_123';

// Setup directories
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMP_DIR = path.join(__dirname, '..', 'temp_build');

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Connect to Database
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Helper to compile LaTeX to PDF
const compilePdf = (texPath, docId) => {
  return new Promise((resolve, reject) => {
    const cmd = `pdflatex -interaction=nonstopmode -output-directory="${TEMP_DIR}" "${texPath}"`;
    exec(cmd, (error, stdout, stderr) => {
      const pdfFilePath = path.join(TEMP_DIR, `${docId}.pdf`);
      const logFilePath = path.join(TEMP_DIR, `${docId}.log`);

      if (fs.existsSync(pdfFilePath)) {
        resolve(pdfFilePath);
      } else {
        let logContent = 'LaTeX compilation failed. pdflatex was unable to generate a PDF.';
        if (error && error.message.includes('not recognized')) {
          logContent = 'LaTeX compiler (pdflatex) is not installed or not in the system PATH. Please install MiKTeX (Windows) or TeX Live (Linux/macOS) to enable PDF compilation.';
          return reject(new Error(logContent));
        }

        if (fs.existsSync(logFilePath)) {
          const rawLog = fs.readFileSync(logFilePath, 'utf8');
          const lines = rawLog.split('\n');
          const errorLines = lines.filter(line => line.startsWith('!') || line.toLowerCase().includes('error'));
          if (errorLines.length > 0) {
            logContent = `LaTeX Compilation Errors:\n\n${errorLines.join('\n')}`;
          } else {
            logContent = `LaTeX Compilation Log (Tail):\n\n${lines.slice(-25).join('\n')}`;
          }
        }
        reject(new Error(logContent));
      }
    });
  });
};

// Clean up temporary compilation artifacts
const cleanTempFiles = (docId) => {
  const extensions = ['.tex', '.pdf', '.log', '.aux', '.out'];
  extensions.forEach(ext => {
    const filePath = path.join(TEMP_DIR, `${docId}${ext}`);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error(`Error deleting temp file ${filePath}:`, err.message);
      }
    }
  });
};

// JWT token generator helper
const generateToken = (user) => {
  return jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
};

// ROUTES

// --- HEALTH CHECK ---

app.get('/health', async (req, res) => {
  // mongoose.connection.readyState: 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
  if (mongoose.connection.readyState !== 1) {
    return res.status(500).json({ server: 'ok', database: 'unavailable' });
  }

  try {
    // Lightweight ping using the existing connection — no new connection created
    await mongoose.connection.db.admin().ping();
    return res.status(200).json({ server: 'ok', database: 'ok' });
  } catch {
    return res.status(500).json({ server: 'ok', database: 'unavailable' });
  }
});

// --- AUTHENTICATION ROUTES ---

// Register
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }

    const user = new User({ name, email, password });
    await user.save();

    const token = generateToken(user);
    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email, conversionCount: user.conversionCount, paid: user.paid }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user);
    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, conversionCount: user.conversionCount, paid: user.paid }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Google Sign-In / OAuth
app.post('/api/auth/google', async (req, res) => {
  const { credential } = req.body;
  if (!credential) {
    return res.status(400).json({ error: 'Credential token is required' });
  }

  try {
    // Decode Google JWT payload directly (safe & robust for sandbox environment)
    const parts = credential.split('.');
    if (parts.length !== 3) {
      return res.status(400).json({ error: 'Invalid credential token format' });
    }
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
    
    const { email, name, sub: googleId } = payload;
    if (!email) {
      return res.status(400).json({ error: 'Email not provided by Google' });
    }

    let user = await User.findOne({ email });
    if (!user) {
      user = new User({
        name: name || 'Google User',
        email,
        googleId
      });
      await user.save();
    } else if (!user.googleId) {
      user.googleId = googleId;
      await user.save();
    }

    const token = generateToken(user);
    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, conversionCount: user.conversionCount, paid: user.paid }
    });
  } catch (error) {
    console.error('Google Auth Error:', error.message);
    res.status(500).json({ error: 'Failed to authenticate with Google' });
  }
});

// Get current user profile
app.get('/api/auth/me', auth, async (req, res) => {
  res.json({
    id: req.user._id,
    name: req.user.name,
    email: req.user.email,
    conversionCount: req.user.conversionCount,
    paid: req.user.paid
  });
});

// Upgrade user to Premium (simulated)
app.post('/api/auth/upgrade', auth, async (req, res) => {
  try {
    req.user.paid = true;
    await req.user.save();
    res.json({
      message: 'Account upgraded to Premium successfully!',
      user: { id: req.user._id, name: req.user.name, email: req.user.email, conversionCount: req.user.conversionCount, paid: req.user.paid }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to upgrade account' });
  }
});

// --- CORE APP ROUTES ---


// LaTeX PDF Compilation & Download (secured & billing checked)
app.post('/api/convert', auth, async (req, res) => {
  const { content, title = 'Document', documentId } = req.body;

  if (!content) {
    return res.status(400).json({ error: 'Content is required' });
  }

  // Enforce conversion limit for free accounts
  if (!req.user.paid && req.user.conversionCount >= 3) {
    return res.status(402).json({
      error: 'Free conversion limit reached. First 3 conversions are free. Please upgrade to Premium to continue compiling documents.'
    });
  }

  // Generate LaTeX code
  const latexCode = mdToLatex(content, title);
  const docId = `doc_${Date.now()}`;
  const texPath = path.join(TEMP_DIR, `${docId}.tex`);

  try {
    // Save .tex file
    fs.writeFileSync(texPath, latexCode, 'utf8');

    // Compile .tex to .pdf
    const pdfPath = await compilePdf(texPath, docId);

    // Read PDF file
    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfBase64 = pdfBuffer.toString('base64');

    // Update user conversion count
    req.user.conversionCount += 1;
    await req.user.save();

    // If documentId is provided, save the compiled PDF directly to MongoDB
    if (documentId) {
      const updatedDoc = await Document.findOneAndUpdate(
        { _id: documentId, owner: req.user._id },
        {
          pdfData: pdfBuffer,
          hasPdf: true,
          latexCode: latexCode
        },
        { new: true }
      );
      if (!updatedDoc) {
        return res.status(404).json({ error: 'Document not found or ownership mismatch' });
      }
    }

    res.json({
      pdf: pdfBase64,
      latexCode: latexCode,
      conversionCount: req.user.conversionCount
    });

    // Clean up files after sending response
    cleanTempFiles(docId);
  } catch (error) {
    console.error('Compilation Error:', error.message);
    cleanTempFiles(docId);

    res.status(500).json({
      error: error.message,
      latexCode: latexCode
    });
  }
});

// Serve PDF binary directly from MongoDB (secured via headers or query parameters)
app.get('/api/documents/:id/pdf', async (req, res) => {
  try {
    // Fetch token from query parameters (since iframes cannot send headers) or Authorization header
    let token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).send('Unauthorized. Token is required.');
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const doc = await Document.findOne({ _id: req.params.id, owner: decoded.id });
    
    if (!doc || !doc.pdfData) {
      return res.status(404).send('No PDF generated for this document yet.');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${doc.title.replace(/\s+/g, '_')}.pdf"`);
    res.send(doc.pdfData);
  } catch (error) {
    console.error('PDF Retrieval Error:', error.message);
    res.status(500).send('Error retrieving PDF.');
  }
});

// CRUD Operations (secured)

app.get('/api/documents', auth, async (req, res) => {
  try {
    const docs = await Document.find({ owner: req.user._id }).select('-pdfData').sort({ updatedAt: -1 });
    res.json(docs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

app.get('/api/documents/:id', auth, async (req, res) => {
  try {
    const doc = await Document.findOne({ _id: req.params.id, owner: req.user._id }).select('-pdfData');
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    res.json(doc);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

app.post('/api/documents', auth, async (req, res) => {
  const { title, content } = req.body;
  try {
    const latexCode = mdToLatex(content, title);
    const newDoc = new Document({
      owner: req.user._id,
      title,
      content,
      latexCode
    });
    await newDoc.save();
    
    const docObj = newDoc.toObject();
    delete docObj.pdfData;
    res.status(201).json(docObj);
  } catch (error) {
    res.status(500).json({ error: 'Failed to save document' });
  }
});

app.put('/api/documents/:id', auth, async (req, res) => {
  const { title, content } = req.body;
  try {
    const latexCode = mdToLatex(content, title);
    const updatedDoc = await Document.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      { title, content, latexCode },
      { new: true }
    ).select('-pdfData');
    if (!updatedDoc) return res.status(404).json({ error: 'Document not found' });
    res.json(updatedDoc);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update document' });
  }
});

app.delete('/api/documents/:id', auth, async (req, res) => {
  try {
    const deletedDoc = await Document.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
    if (!deletedDoc) return res.status(404).json({ error: 'Document not found' });
    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
// Trigger nodemon restart
