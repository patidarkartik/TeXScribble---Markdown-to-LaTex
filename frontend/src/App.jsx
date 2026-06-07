import { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  Sparkles, 
  Download, 
  Trash2, 
  Plus, 
  Menu, 
  X, 
  Save, 
  RotateCcw, 
  FileCode, 
  AlertTriangle, 
  CheckCircle,
  FileCheck,
  ExternalLink
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

// Helper to convert base64 to Blob
const b64toBlob = (b64Data, contentType = '', sliceSize = 512) => {
  const byteCharacters = atob(b64Data);
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
    const slice = byteCharacters.slice(offset, offset + sliceSize);

    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }

  return new Blob(byteArrays, { type: contentType });
};

function App() {
  // Documents state
  const [documents, setDocuments] = useState([]);
  const [currentDocId, setCurrentDocId] = useState(null);
  const [title, setTitle] = useState('Untitled Document');
  const [content, setContent] = useState('');
  
  // App UI state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('pdf'); // 'pdf' | 'latex' | 'logs'
  const [saveStatus, setSaveStatus] = useState('Saved'); // 'Saved' | 'Unsaved' | 'Saving...'
  const [history, setHistory] = useState([]); // for undoing AI grammar corrections
  
  // Compilation and AI status
  const [isCompiling, setIsCompiling] = useState(false);
  const [isProofreading, setIsProofreading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [latexCode, setLatexCode] = useState('');
  const [compileError, setCompileError] = useState(null);
  const [availableModels, setAvailableModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');

  // Refs for auto-saving
  const autoSaveTimeout = useRef(null);

  // Fetch initial documents and Ollama models
  useEffect(() => {
    fetchDocuments();
    fetchModels();
  }, []);

  // Fetch Ollama models
  const fetchModels = async () => {
    try {
      const res = await fetch(`${API_BASE}/models`);
      if (res.ok) {
        const data = await res.json();
        setAvailableModels(data);
        if (data.length > 0) {
          // Default to llama3 or the first available model
          const hasLlama3 = data.find(m => m.name.startsWith('llama3'));
          setSelectedModel(hasLlama3 ? hasLlama3.name : data[0].name);
        }
      }
    } catch (err) {
      console.error('Failed to load Ollama models:', err);
    }
  };

  // Fetch all documents
  const fetchDocuments = async () => {
    try {
      const res = await fetch(`${API_BASE}/documents`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
        // Load the most recent document if none is selected
        if (data.length > 0 && !currentDocId) {
          loadDocument(data[0]);
        }
      }
    } catch (err) {
      console.error('Error fetching documents:', err);
    }
  };

  // Load a document into editor
  const loadDocument = (doc) => {
    setCurrentDocId(doc._id);
    setTitle(doc.title);
    setContent(doc.content);
    setLatexCode(doc.latexCode || '');
    setPdfUrl(doc.hasPdf ? `${API_BASE}/documents/${doc._id}/pdf` : null);
    setCompileError(null);
    setHistory([]);
    setSaveStatus('Saved');
  };

  // Handle new document creation
  const handleNewDocument = async () => {
    const defaultDoc = {
      title: 'Untitled Document',
      content: `# New Document\n\nStart writing your markdown here...\n\n- Bullet item 1\n- Bullet item 2\n\nInline math: $E = mc^2$\n\nBlock math:\n$$\\int_{a}^{b} x^2 \\, dx$$`
    };

    try {
      const res = await fetch(`${API_BASE}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(defaultDoc)
      });
      if (res.ok) {
        const newDoc = await res.json();
        setDocuments([newDoc, ...documents]);
        loadDocument(newDoc);
      }
    } catch (err) {
      console.error('Error creating document:', err);
    }
  };

  // Handle document deletion
  const handleDeleteDocument = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this draft?')) return;

    try {
      const res = await fetch(`${API_BASE}/documents/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        const updatedDocs = documents.filter(doc => doc._id !== id);
        setDocuments(updatedDocs);
        if (currentDocId === id) {
          if (updatedDocs.length > 0) {
            loadDocument(updatedDocs[0]);
          } else {
            setCurrentDocId(null);
            setTitle('Untitled Document');
            setContent('');
            setLatexCode('');
            setPdfUrl(null);
          }
        }
      }
    } catch (err) {
      console.error('Error deleting document:', err);
    }
  };

  // Debounced auto-save effect
  useEffect(() => {
    // Only autosave if there is a current ID OR if the user has typed something
    if (!currentDocId && !content.trim()) return;

    // Mark as unsaved as soon as changes occur
    setSaveStatus('Unsaved');

    if (autoSaveTimeout.current) {
      clearTimeout(autoSaveTimeout.current);
    }

    autoSaveTimeout.current = setTimeout(() => {
      saveDocument();
    }, 1500); // Save after 1.5 seconds of silence

    return () => {
      if (autoSaveTimeout.current) clearTimeout(autoSaveTimeout.current);
    };
  }, [content, title]);

  // Save document to database
  const saveDocument = async () => {
    if (!currentDocId && !content.trim()) return null;
    setSaveStatus('Saving...');
    try {
      if (!currentDocId) {
        // Create new document in database
        const res = await fetch(`${API_BASE}/documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, content })
        });
        if (res.ok) {
          const newDoc = await res.json();
          setCurrentDocId(newDoc._id);
          setDocuments([newDoc, ...documents]);
          setSaveStatus('Saved');
          return newDoc._id;
        } else {
          setSaveStatus('Error saving');
        }
      } else {
        // Update existing document
        const res = await fetch(`${API_BASE}/documents/${currentDocId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, content })
        });
        if (res.ok) {
          const updatedDoc = await res.json();
          setSaveStatus('Saved');
          setDocuments(documents.map(doc => doc._id === currentDocId ? { ...updatedDoc, hasPdf: doc.hasPdf } : doc));
          return currentDocId;
        } else {
          setSaveStatus('Error saving');
        }
      }
    } catch (err) {
      console.error('Error saving document:', err);
      setSaveStatus('Error saving');
    }
    return null;
  };

  // Trigger Ollama AI proofreading
  const handleProofread = async () => {
    if (!content.trim()) return;
    setIsProofreading(true);
    try {
      const res = await fetch(`${API_BASE}/proofread`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content,
          model: selectedModel
        })
      });

      const data = await res.json();
      if (res.ok) {
        // Save current content to history for undo capability
        setHistory([...history, content]);
        setContent(data.correctedText);
      } else {
        alert(data.error || 'Failed to connect to Ollama proofreader.');
      }
    } catch (err) {
      console.error('Proofreading failed:', err);
      alert('Network error. Make sure backend is running and Ollama is active.');
    } finally {
      setIsProofreading(false);
    }
  };

  // Undo AI changes
  const handleUndoProofread = () => {
    if (history.length === 0) return;
    const prevContent = history[history.length - 1];
    setContent(prevContent);
    setHistory(history.slice(0, -1));
  };

  // Compile PDF via LaTeX Backend
  const handleCompile = async () => {
    setIsCompiling(true);
    setCompileError(null);
    setPdfUrl(null);
    setActiveTab('pdf');

    try {
      // 1. Save document first to ensure we have a valid MongoDB document and ID
      const docId = await saveDocument();

      // 2. Call convert endpoint with the saved documentId
      const res = await fetch(`${API_BASE}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content,
          title: title,
          documentId: docId
        })
      });

      if (res.ok) {
        const data = await res.json();
        const pdfBlob = b64toBlob(data.pdf, 'application/pdf');
        const url = URL.createObjectURL(pdfBlob);
        setPdfUrl(url);
        setLatexCode(data.latexCode);

        // 3. Mark document as having a compiled PDF in the local sidebar list
        if (docId) {
          setDocuments(prevDocs => prevDocs.map(doc => 
            doc._id === docId ? { ...doc, hasPdf: true } : doc
          ));
        }
      } else {
        const errData = await res.json();
        setCompileError(errData.error);
        if (errData.latexCode) {
          setLatexCode(errData.latexCode);
        }
        setActiveTab('logs');
      }
    } catch (err) {
      console.error('Compilation failed:', err);
      setCompileError('Network error connecting to compiler backend. Make sure the Node server is running.');
      setActiveTab('logs');
    } finally {
      setIsCompiling(false);
    }
  };

  // Download LaTeX File Directly
  const handleDownloadTex = () => {
    // Generate LaTeX frontend-side or use last fetched latex code
    const element = document.createElement("a");
    const file = new Blob([latexCode || 'Compile once to generate LaTeX code.'], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `${title.replace(/\s+/g, '_')}.tex`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Filtered documents list
  const filteredDocs = documents.filter(doc => 
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      
      {/* Sidebar for Document Drafts */}
      <div className={`bg-slate-900 border-r border-slate-800 flex flex-col transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-0 overflow-hidden'}`}>
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-600 rounded-lg">
              <FileCode className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-sm tracking-wide bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">TeXScribble</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="p-1 hover:bg-slate-800 rounded-md text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3">
          <input
            type="text"
            placeholder="Search drafts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs focus:outline-none focus:border-indigo-500 placeholder-slate-500"
          />
        </div>

        {/* Draft List */}
        <div className="flex-1 overflow-y-auto px-2 space-y-1">
          <div className="flex items-center justify-between px-2 py-1 text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Saved Drafts</span>
            <button 
              onClick={handleNewDocument}
              className="p-1 hover:bg-slate-800 rounded text-indigo-400 hover:text-indigo-300"
              title="Create New Draft"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {filteredDocs.length === 0 ? (
            <div className="text-center py-8 text-slate-600 text-xs">
              No drafts found
            </div>
          ) : (
            filteredDocs.map(doc => (
              <div
                key={doc._id}
                onClick={() => loadDocument(doc)}
                className={`group flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all ${
                  doc._id === currentDocId 
                    ? 'bg-slate-800 border-l-2 border-indigo-500 text-white' 
                    : 'hover:bg-slate-800/50 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex flex-col min-w-0 pr-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-medium truncate">{doc.title}</span>
                    {doc.hasPdf && (
                      <span className="flex-shrink-0 text-[8px] px-1 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-900 rounded font-bold uppercase tracking-wider" title="PDF generated">PDF</span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-0.5">
                    {new Date(doc.updatedAt).toLocaleDateString()}
                  </span>
                </div>
                <button
                  onClick={(e) => handleDeleteDocument(doc._id, e)}
                  className="p-1 opacity-0 group-hover:opacity-100 hover:bg-slate-700 rounded text-slate-500 hover:text-red-400 transition-opacity"
                  title="Delete Draft"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
        
        {/* Footer info */}
        <div className="p-3 border-t border-slate-800 text-[10px] text-slate-500 flex justify-between">
          <span>Ollama Mode: Local AI</span>
          <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3 text-green-500" /> Connected</span>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
        
        {/* Workspace Header */}
        <header className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 z-10">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <button 
                onClick={() => setSidebarOpen(true)}
                className="p-1.5 hover:bg-slate-800 rounded-md text-slate-400 hover:text-white mr-1"
              >
                <Menu className="h-5 w-5" />
              </button>
            )}
            
            {/* Title Editor */}
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-transparent text-sm font-semibold border-b border-transparent hover:border-slate-700 focus:border-indigo-500 focus:outline-none py-1 px-1.5 transition-colors min-w-[200px]"
              placeholder="Enter document title..."
            />

            {/* Autosave Status Badge */}
            <span className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 ${
              saveStatus === 'Saved' ? 'bg-emerald-500/10 text-emerald-400' :
              saveStatus === 'Saving...' ? 'bg-amber-500/10 text-amber-400' :
              'bg-slate-500/10 text-slate-400'
            }`}>
              {saveStatus === 'Saved' && <span className="h-1 w-1 rounded-full bg-emerald-400 animate-pulse"></span>}
              {saveStatus === 'Saving...' && <span className="h-1 w-1 rounded-full bg-amber-400 animate-spin"></span>}
              {saveStatus}
            </span>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-3">
            {/* Ollama Model selector */}
            <div className="flex items-center gap-2 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="bg-transparent border-none text-xs text-slate-300 focus:ring-0 focus:outline-none cursor-pointer max-w-[120px]"
              >
                {availableModels.length === 0 ? (
                  <option value="llama3">llama3 (offline)</option>
                ) : (
                  availableModels.map(m => (
                    <option key={m.name} value={m.name} className="bg-slate-900 text-slate-200">
                      {m.name.length > 12 ? m.name.substring(0, 12) + '..' : m.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* AI Proofreader Actions */}
            <div className="flex items-center gap-1">
              <button
                onClick={handleProofread}
                disabled={isProofreading || !content}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800/40 disabled:text-slate-500 text-xs font-semibold rounded-lg transition-colors"
                title="Use local AI to clean spelling and grammar errors"
              >
                <Sparkles className={`h-3.5 w-3.5 ${isProofreading ? 'animate-spin' : ''}`} />
                {isProofreading ? 'Fixing...' : 'Fix Grammar'}
              </button>
              
              {history.length > 0 && (
                <button
                  onClick={handleUndoProofread}
                  className="p-1.5 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-400 hover:text-white"
                  title="Undo AI corrections"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Manual Save */}
            <button
              onClick={saveDocument}
              disabled={saveStatus === 'Saved'}
              className="p-1.5 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-400 hover:text-white disabled:opacity-50"
              title="Save document now"
            >
              <Save className="h-3.5 w-3.5" />
            </button>
          </div>
        </header>

        {/* Editor & Previewer Split Panel */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* LEFT PANEL: Text Editor */}
          <div className="w-1/2 flex flex-col border-r border-slate-800 bg-slate-950">
            {/* Editor toolbar */}
            <div className="h-9 px-4 bg-slate-900/50 border-b border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span>Markdown Source Editor</span>
              <div className="flex gap-4">
                <span>{content.replace(/\n/g, '').length} chars</span>
                <span>{content.split(/\s+/).filter(Boolean).length} words</span>
              </div>
            </div>

            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="flex-1 w-full p-5 bg-transparent text-sm focus:outline-none resize-none font-mono leading-relaxed placeholder-slate-600 text-slate-300"
              placeholder="# Markdown Cheatsheet

Write text here. LaTeX formulas can be added using $inline$ or $$block$$ formatting:

- Use **bold** and *italic*
- Use `- list items`
- Use `inline code` or ```code block``` 

Click 'Compile PDF' on the right to compile using local pdflatex."
            />
          </div>

          {/* RIGHT PANEL: Live LaTeX / PDF Compiler Preview */}
          <div className="w-1/2 flex flex-col bg-slate-900/40">
            
            {/* Tab header */}
            <div className="h-9 bg-slate-900/50 border-b border-slate-800 flex items-center justify-between px-3">
              <div className="flex gap-1">
                <button
                  onClick={() => setActiveTab('pdf')}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
                    activeTab === 'pdf' 
                      ? 'bg-slate-800 text-indigo-400 shadow-sm' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  PDF Document
                </button>
                <button
                  onClick={() => setActiveTab('latex')}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
                    activeTab === 'latex' 
                      ? 'bg-slate-800 text-indigo-400 shadow-sm' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  LaTeX Code
                </button>
                <button
                  onClick={() => setActiveTab('logs')}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all relative ${
                    activeTab === 'logs' 
                      ? 'bg-slate-800 text-indigo-400 shadow-sm' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Compiler Logs
                  {compileError && <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-red-500 animate-ping"></span>}
                </button>
              </div>

              {/* PDF Compiler & Action Trigger */}
              <div className="flex gap-2">
                <button
                  onClick={handleCompile}
                  disabled={isCompiling || !content}
                  className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-[11px] font-semibold text-white rounded-md shadow-lg shadow-indigo-900/30 transition-all"
                >
                  <FileCheck className={`h-3.5 w-3.5 ${isCompiling ? 'animate-spin' : ''}`} />
                  {isCompiling ? 'Compiling...' : 'Compile PDF'}
                </button>

                {latexCode && (
                  <button
                    onClick={handleDownloadTex}
                    className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-md border border-slate-800"
                    title="Download LaTeX Source File (.tex)"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Tab Body */}
            <div className="flex-1 p-4 overflow-hidden flex flex-col">
              
              {/* Tab: PDF Preview */}
              {activeTab === 'pdf' && (
                <div className="flex-1 flex flex-col items-center justify-center bg-slate-950/40 rounded-xl border border-slate-800/60 overflow-hidden relative">
                  {isCompiling ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-10 w-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                      <span className="text-xs text-slate-400">Compiling document template via pdflatex...</span>
                    </div>
                  ) : pdfUrl ? (
                    <div className="w-full h-full flex flex-col">
                      <div className="h-10 px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
                        <span className="flex items-center gap-1 text-emerald-400"><CheckCircle className="h-4 w-4" /> PDF Compiled Successfully</span>
                        <a 
                          href={pdfUrl} 
                          download={`${title.replace(/\s+/g, '_')}.pdf`}
                          className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-semibold"
                        >
                          <Download className="h-3.5 w-3.5" /> Save File
                        </a>
                      </div>
                      <iframe 
                        src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=1`}
                        className="w-full flex-1 border-none bg-slate-800"
                        title="PDF Compile Preview"
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4 text-center max-w-sm px-4">
                      <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
                        <FileText className="h-10 w-10 text-indigo-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-200">No PDF Generated</h3>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                          Save your markdown, write some sections, and click the Compile PDF button to build a LaTeX document.
                        </p>
                      </div>
                      <button
                        onClick={handleCompile}
                        disabled={!content}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-lg border border-slate-700 transition-colors"
                      >
                        Compile Preview
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Tab: LaTeX Code Viewer */}
              {activeTab === 'latex' && (
                <div className="flex-1 flex flex-col bg-slate-950 rounded-xl border border-slate-800/80 overflow-hidden">
                  <div className="h-8 px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                    <span>Generated LaTeX Source Code</span>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(latexCode);
                        alert('LaTeX code copied to clipboard!');
                      }}
                      className="text-indigo-400 hover:text-indigo-300"
                    >
                      Copy Code
                    </button>
                  </div>
                  <textarea
                    readOnly
                    value={latexCode || 'Click "Compile PDF" to generate and view LaTeX source code.'}
                    className="flex-1 w-full p-4 bg-transparent font-mono text-xs focus:outline-none resize-none leading-relaxed text-indigo-300/80"
                  />
                </div>
              )}

              {/* Tab: Compiler Logs */}
              {activeTab === 'logs' && (
                <div className="flex-1 flex flex-col bg-slate-950 rounded-xl border border-slate-800/80 overflow-hidden font-mono text-xs text-slate-300">
                  <div className="h-8 px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                    <span>pdflatex compilation output logs</span>
                    {compileError && <span className="text-red-400 flex items-center gap-1 font-semibold"><AlertTriangle className="h-3 w-3" /> Error Found</span>}
                  </div>
                  <div className="flex-1 p-4 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                    {compileError ? (
                      <div className="text-red-400">{compileError}</div>
                    ) : (
                      <div className="text-slate-500">No logs generated. Compile your document to view terminal output.</div>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>

      </div>

    </div>
  );
}

export default App;
