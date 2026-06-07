import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import Document from './models/Document.js';
import { mdToLatex } from './utils/mdToLatex.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

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
    // Run pdflatex in the temp directory
    const cmd = `pdflatex -interaction=nonstopmode -output-directory="${TEMP_DIR}" "${texPath}"`;
    exec(cmd, (error, stdout, stderr) => {
      const pdfFilePath = path.join(TEMP_DIR, `${docId}.pdf`);
      const logFilePath = path.join(TEMP_DIR, `${docId}.log`);

      if (fs.existsSync(pdfFilePath)) {
        resolve(pdfFilePath);
      } else {
        // PDF compilation failed
        let logContent = 'LaTeX compilation failed. pdflatex was unable to generate a PDF.';
        if (error && error.message.includes('not recognized')) {
          logContent = 'LaTeX compiler (pdflatex) is not installed or not in the system PATH. Please install MiKTeX (Windows) or TeX Live (Linux/macOS) to enable PDF compilation.';
          return reject(new Error(logContent));
        }

        if (fs.existsSync(logFilePath)) {
          const rawLog = fs.readFileSync(logFilePath, 'utf8');
          // Filter log to find actual errors (lines beginning with !)
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

// ROUTES

// 1. Fetch available Ollama models
app.get('/api/models', async (req, res) => {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!response.ok) {
      throw new Error('Ollama server is unreachable');
    }
    const data = await response.json();
    res.json(data.models || []);
  } catch (error) {
    // Graceful fallback with standard models if local Ollama is not active
    res.json([
      { name: 'llama3', details: { parameter_size: '8B' } },
      { name: 'mistral', details: { parameter_size: '7B' } },
      { name: 'gemma:2b', details: { parameter_size: '2B' } },
      { name: 'phi3', details: { parameter_size: '3.8B' } }
    ]);
  }
});

// 2. Grammar correction via Ollama
app.post('/api/proofread', async (req, res) => {
  const { content, model = 'llama3' } = req.body;

  if (!content) {
    return res.status(400).json({ error: 'Content is required for proofreading' });
  }

  try {
    const prompt = `You are a professional proofreader. Read the following text, correct any grammar, spelling, or punctuation errors, and return ONLY the corrected text. Do NOT add any introductory text, explanation, or conversational fillers. Preserve all markdown formatting exactly:\n\n${content}`;

    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        prompt: prompt,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error('Ollama service failed to respond');
    }

    const data = await response.json();
    res.json({ correctedText: data.response.trim() });
  } catch (error) {
    console.error('Proofreader Error:', error.message);
    res.status(500).json({
      error: `Failed to connect to local Ollama. Please make sure Ollama is running at ${OLLAMA_URL} and the selected model is downloaded.`
    });
  }
});

// 3. LaTeX PDF Compilation & Download
app.post('/api/convert', async (req, res) => {
  const { content, title = 'Document', documentId } = req.body;

  if (!content) {
    return res.status(400).json({ error: 'Content is required' });
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

    // If documentId is provided, save the compiled PDF directly to MongoDB
    if (documentId) {
      await Document.findByIdAndUpdate(documentId, {
        pdfData: pdfBuffer,
        hasPdf: true,
        latexCode: latexCode
      });
    }

    res.json({
      pdf: pdfBase64,
      latexCode: latexCode
    });

    // Clean up files after sending response
    cleanTempFiles(docId);
  } catch (error) {
    console.error('Compilation Error:', error.message);
    
    // Clean up files in case of error
    cleanTempFiles(docId);

    res.status(500).json({
      error: error.message,
      latexCode: latexCode // Return LaTeX source code so the user doesn't lose their work and can copy it
    });
  }
});

// Serve PDF binary directly from MongoDB
app.get('/api/documents/:id/pdf', async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
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

// 4. Document CRUD operations (MongoDB)
app.get('/api/documents', async (req, res) => {
  try {
    const docs = await Document.find().select('-pdfData').sort({ updatedAt: -1 });
    res.json(docs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

app.get('/api/documents/:id', async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id).select('-pdfData');
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    res.json(doc);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

app.post('/api/documents', async (req, res) => {
  const { title, content } = req.body;
  try {
    const latexCode = mdToLatex(content, title);
    const newDoc = new Document({ title, content, latexCode });
    await newDoc.save();
    const docObj = newDoc.toObject();
    delete docObj.pdfData;
    res.status(201).json(docObj);
  } catch (error) {
    res.status(500).json({ error: 'Failed to save document' });
  }
});

app.put('/api/documents/:id', async (req, res) => {
  const { title, content } = req.body;
  try {
    const latexCode = mdToLatex(content, title);
    const updatedDoc = await Document.findByIdAndUpdate(
      req.params.id,
      { title, content, latexCode },
      { new: true }
    ).select('-pdfData');
    if (!updatedDoc) return res.status(404).json({ error: 'Document not found' });
    res.json(updatedDoc);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update document' });
  }
});

app.delete('/api/documents/:id', async (req, res) => {
  try {
    const deletedDoc = await Document.findByIdAndDelete(req.params.id);
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
// Nodemon restart trigger comment
