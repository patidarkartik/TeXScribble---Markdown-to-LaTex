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
  ExternalLink,
  LogIn,
  LogOut,
  CreditCard,
  Lock,
  Crown,
  BookOpen,
  User as UserIcon,
  ChevronRight,
  ShieldCheck,
  Code,
  Check,
  Coins,
  ArrowLeft,
  Info
} from 'lucide-react';
import './App.css';


const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:7860/api';

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
  // Authentication State
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [user, setUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Auth Form State
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');

  // Navigation / View State
  const [activeView, setActiveView] = useState('landing'); // 'landing' | 'dashboard' | 'checkout'
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
  
  // Compilation status
  const [isCompiling, setIsCompiling] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [latexCode, setLatexCode] = useState('');
  const [compileError, setCompileError] = useState(null);

  // Checkout View State
  const [paymentMethod] = useState('card');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);

  // Refs for auto-saving
  const autoSaveTimeout = useRef(null);

  // Load Google Authentication SDK script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  // Fetch profile and models if token is present
  useEffect(() => {
    if (token) {
      fetchProfile();
      fetchDocuments();
      setActiveView('dashboard');
    } else {
      setUser(null);
      setDocuments([]);
      setCurrentDocId(null);
      setActiveView('landing');
    }
  }, [token]);

  // Fetch logged-in user profile details
  const fetchProfile = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        // Token expired or invalid
        handleLogout();
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
    }
  };


  // Fetch all user-owned documents
  const fetchDocuments = async () => {
    try {
      const res = await fetch(`${API_BASE}/documents`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
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
    setPdfUrl(doc.hasPdf ? `${API_BASE}/documents/${doc._id}/pdf?token=${token}` : null);
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
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
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
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
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
    if (!token) return;
    if (!currentDocId && !content.trim()) return;

    setSaveStatus('Unsaved');

    if (autoSaveTimeout.current) {
      clearTimeout(autoSaveTimeout.current);
    }

    autoSaveTimeout.current = setTimeout(() => {
      saveDocument();
    }, 1500);

    return () => {
      if (autoSaveTimeout.current) clearTimeout(autoSaveTimeout.current);
    };
  }, [content, title]);

  // Save document to database
  const saveDocument = async () => {
    if (!token) return null;
    if (!currentDocId && !content.trim()) return null;
    setSaveStatus('Saving...');
    try {
      if (!currentDocId) {
        const res = await fetch(`${API_BASE}/documents`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
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
        const res = await fetch(`${API_BASE}/documents/${currentDocId}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
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


  // Compile PDF via LaTeX Backend
  const handleCompile = async () => {
    setIsCompiling(true);
    setCompileError(null);
    setPdfUrl(null);
    setActiveTab('pdf');

    try {
      const docId = await saveDocument();

      const res = await fetch(`${API_BASE}/convert`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
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

        // Update user conversion count locally
        if (user) {
          setUser(prev => ({ ...prev, conversionCount: prev.conversionCount + 1 }));
        }

        if (docId) {
          setDocuments(prevDocs => prevDocs.map(doc => 
            doc._id === docId ? { ...doc, hasPdf: true } : doc
          ));
        }
      } else {
        const errData = await res.json();
        if (res.status === 402) {
          // Trigger Upgrade Option
          setShowUpgradeModal(true);
        } else {
          setCompileError(errData.error);
          if (errData.latexCode) {
            setLatexCode(errData.latexCode);
          }
          setActiveTab('logs');
        }
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
    const element = document.createElement("a");
    const file = new Blob([latexCode || 'Compile once to generate LaTeX code.'], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `${title.replace(/\s+/g, '_')}.tex`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // --- AUTH FLOW HANDLERS ---

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    const endpoint = isRegister ? '/auth/register' : '/auth/login';
    const payload = isRegister 
      ? { name: authName, email: authEmail, password: authPassword }
      : { email: authEmail, password: authPassword };

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok) {
        localStorage.setItem('token', data.token);
        setToken(data.token);
        setUser(data.user);
        setShowAuthModal(false);
        // Clear forms
        setAuthEmail('');
        setAuthPassword('');
        setAuthName('');
        setActiveView('dashboard');
      } else {
        setAuthError(data.error || 'Authentication failed. Please try again.');
      }
    } catch (err) {
      setAuthError('Connection error. Please check your backend is running.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Google OAuth verification
  const triggerGoogleLogin = async () => {
    setAuthError('');
    setAuthLoading(true);
    try {
      // Simulate Google Client login with token exchange
      const fakeGoogleJwt = `header.${btoa(JSON.stringify({
        email: authEmail || 'demo.user@gmail.com',
        name: authName || 'Google Demo User',
        sub: 'google_oauth_sub_102030'
      }))}.signature`;

      const res = await fetch(`${API_BASE}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: fakeGoogleJwt })
      });
      const data = await res.json();

      if (res.ok) {
        localStorage.setItem('token', data.token);
        setToken(data.token);
        setUser(data.user);
        setShowAuthModal(false);
        setActiveView('dashboard');
      } else {
        setAuthError(data.error || 'Failed to authenticate with Google.');
      }
    } catch (err) {
      setAuthError('Failed to connect to Google Auth API.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setDocuments([]);
    setCurrentDocId(null);
    setTitle('Untitled Document');
    setContent('');
    setLatexCode('');
    setPdfUrl(null);
    setActiveView('landing');
  };

  // Card formatting utilities
  const handleCardNumberChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').substring(0, 16);
    const formatted = val.replace(/(\d{4})(?=\d)/g, '$1 ');
    setCardNumber(formatted);
  };

  const handleCardExpiryChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').substring(0, 4);
    if (val.length >= 2) {
      setCardExpiry(`${val.substring(0, 2)}/${val.substring(2, 4)}`);
    } else {
      setCardExpiry(val);
    }
  };

  const handleCardCvvChange = (e) => {
    setCardCvv(e.target.value.replace(/\D/g, '').substring(0, 3));
  };

  // Submit simulated custom checkout payment
  const handlePaymentCheckoutSubmit = async (e) => {
    e.preventDefault();
    if (paymentMethod === 'card') {
      if (!cardNumber || !cardExpiry || !cardCvv || !cardName) {
        alert('Please fill out all card details.');
        return;
      }
    }
    setPaymentLoading(true);

    try {
      const res = await fetch(`${API_BASE}/auth/upgrade`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setPaymentLoading(false);
        alert('Payment Verified! Welcome to TeXScribble Premium.');
        setActiveView('dashboard');
        // Clear card state
        setCardNumber('');
        setCardExpiry('');
        setCardCvv('');
        setCardName('');
      } else {
        alert('Server declined upgrade request.');
        setPaymentLoading(false);
      }
    } catch (err) {
      console.error(err);
      alert('Error updating account billing state.');
      setPaymentLoading(false);
    }
  };

  const filteredDocs = documents.filter(doc => 
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // VIEW 1: LANDING PAGE
  if (activeView === 'landing') {
    return (
      <div className="min-h-screen bg-[#FCFBF7] text-[#1C1A17] flex flex-col selection:bg-[#B8860B]/10 selection:text-[#B8860B]">
        {/* Landing Header */}
        <header className="px-6 py-6 lg:px-16 border-b border-[#E6E2D8] flex items-center justify-between relative z-50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-[#1C1A17] rounded">
              <FileCode className="h-5 w-5 text-[#FCFBF7]" />
            </div>
            <span className="font-serif font-bold text-lg tracking-tight">TeXScribble</span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium hover:text-[#B8860B] transition-colors">Features</a>
            <a href="#pricing" className="text-sm font-medium hover:text-[#B8860B] transition-colors">Pricing</a>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <button 
              onClick={() => { setIsRegister(false); setShowAuthModal(true); }}
              className="text-sm font-medium hover:text-[#B8860B] transition-colors cursor-pointer"
            >
              Sign In
            </button>
            <button 
              onClick={() => { setIsRegister(true); setShowAuthModal(true); }}
              className="text-sm font-medium px-4 py-2 bg-[#1C1A17] hover:bg-[#B8860B] text-[#FCFBF7] rounded transition-all cursor-pointer"
            >
              Get Started Free
            </button>
          </div>

          {/* Mobile Hamburguer Toggle */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
            className="md:hidden p-2 hover:bg-[#F5F3EC] rounded"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>

          {/* Mobile Overlay Menu */}
          {mobileMenuOpen && (
            <div className="absolute top-full left-0 w-full bg-[#FCFBF7] border-b border-[#E6E2D8] px-6 py-6 flex flex-col gap-4 shadow-lg md:hidden animate-fade-in">
              <a 
                href="#features" 
                onClick={() => setMobileMenuOpen(false)}
                className="text-sm font-medium text-[#1C1A17] hover:text-[#B8860B] py-2 border-b border-[#E6E2D8]/50"
              >
                Features
              </a>

              <a 
                href="#pricing" 
                onClick={() => setMobileMenuOpen(false)}
                className="text-sm font-medium text-[#1C1A17] hover:text-[#B8860B] py-2 border-b border-[#E6E2D8]/50"
              >
                Pricing
              </a>
              <div className="flex flex-col gap-2 pt-4">
                <button 
                  onClick={() => { setMobileMenuOpen(false); setIsRegister(false); setShowAuthModal(true); }}
                  className="w-full text-center py-2.5 border border-[#E6E2D8] rounded text-sm font-semibold hover:bg-[#F5F3EC]"
                >
                  Sign In
                </button>
                <button 
                  onClick={() => { setMobileMenuOpen(false); setIsRegister(true); setShowAuthModal(true); }}
                  className="w-full text-center py-2.5 bg-[#1C1A17] text-[#FCFBF7] rounded text-sm font-semibold hover:bg-[#B8860B]"
                >
                  Get Started Free
                </button>
              </div>
            </div>
          )}
        </header>

        {/* Hero Section */}
        <main className="flex-1 max-w-7xl mx-auto w-full px-6 lg:px-16 py-12 lg:py-24 flex flex-col lg:flex-row gap-16 items-center">
          <div className="flex-1 space-y-8 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#F5F3EC] border border-[#E6E2D8] rounded-full text-xs font-semibold text-[#B8860B]">
              <Sparkles className="h-3.5 w-3.5" /> Markdown-to-LaTeX Redefined
            </div>
            <h1 className="landing-title text-4xl lg:text-6xl font-bold leading-tight">
              Create beautiful, print-ready documents <br />
              <span className="text-[#B8860B] italic font-serif">without the LaTeX overhead</span>
            </h1>
            <p className="text-[#6B665F] max-w-xl text-base lg:text-lg leading-relaxed">
              Write fast in clean Markdown. TeXScribble automatically parses styles, embeds formulas, and compiles professional, beautifully styled PDFs instantly.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button 
                onClick={() => { setIsRegister(true); setShowAuthModal(true); }}
                className="btn-gold flex items-center justify-center gap-2 text-sm font-semibold"
              >
                Start Writing Free <ChevronRight className="h-4 w-4" />
              </button>
              <a 
                href="#pricing"
                className="btn-gold-outline flex items-center justify-center gap-2 text-sm font-semibold text-center"
              >
                View Pricing
              </a>
            </div>
            <div className="flex items-center gap-6 pt-4 text-xs text-[#6B665F] border-t border-[#E6E2D8]">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-[#B8860B]" />
                No Credit Card Required
              </div>
              <div className="flex items-center gap-1.5">
                <Crown className="h-4 w-4 text-[#B8860B]" />
                Premium PDF Templates
              </div>
            </div>
          </div>

          {/* Interactive Hero Component */}
          <div className="flex-1 w-full flex justify-center relative animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <div className="relative w-full max-w-md bg-white border border-[#E6E2D8] rounded-xl shadow-2xl p-6 rotate-1 hover:rotate-0 transition-transform duration-500">
              <div className="flex items-center gap-2 pb-4 border-b border-[#E6E2D8] mb-4">
                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                <div className="w-3 h-3 rounded-full bg-green-400"></div>
                <span className="text-xs text-[#6B665F] font-mono ml-2">document.md</span>
              </div>
              <pre className="text-xs font-mono text-[#1C1A17] space-y-2 overflow-x-auto leading-relaxed">
                <div><span className="text-[#B8860B]"># Relativistic Energy</span></div>
                <div>Einstein's equation is defined by:</div>
                <div></div>
                <div><span className="text-blue-600">$$E = mc^2$$</span></div>
                <div></div>
                <div>Where:</div>
                <div>- <span className="font-bold">E</span> = energy</div>
                <div>- <span className="font-bold">m</span> = relativistic mass</div>
                <div>- <span className="font-bold">c</span> = speed of light</div>
              </pre>

              <div className="absolute -bottom-8 -right-8 w-64 bg-[#F5F3EC] border border-[#E6E2D8] rounded-xl shadow-2xl p-5 transform translate-y-2 -translate-x-2 hidden sm:block">
                <div className="flex items-center justify-between pb-3 border-b border-[#E6E2D8] mb-3">
                  <span className="text-[10px] font-bold tracking-widest text-[#B8860B] uppercase">LaTeX PDF Output</span>
                  <span className="text-[9px] px-1.5 py-0.5 bg-[#B8860B]/10 text-[#B8860B] rounded font-bold">Compiled</span>
                </div>
                <div className="space-y-2 text-center py-4">
                  <FileText className="h-10 w-10 text-[#B8860B] mx-auto opacity-80" />
                  <div className="text-[11px] font-serif font-bold text-[#1C1A17]">Relativistic_Energy.pdf</div>
                  <div className="text-[9px] text-[#6B665F]">Rendered in standard A4 format</div>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Features Section */}
        <section id="features" className="bg-[#F5F3EC] border-t border-b border-[#E6E2D8] py-20">
          <div className="max-w-7xl mx-auto px-6 lg:px-16">
            <div className="max-w-2xl space-y-4 mb-16">
              <span className="text-xs font-bold uppercase tracking-widest text-[#B8860B]">Core Features</span>
              <h2 className="text-3xl lg:text-4xl font-serif font-bold text-[#1C1A17]">Complete LaTeX precision, built inside Markdown</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-[#FCFBF7] border border-[#E6E2D8] p-8 rounded-lg space-y-4">
                <div className="p-3 bg-[#F5F3EC] rounded-lg w-fit">
                  <FileCode className="h-6 w-6 text-[#B8860B]" />
                </div>
                <h3 className="text-lg font-serif font-bold text-[#1C1A17]">Automatic LaTeX Translation</h3>
                <p className="text-sm text-[#6B665F] leading-relaxed">
                  Your markdown syntax automatically maps to native, perfectly formatted LaTeX source code templates including margins, packages, and code blocks.
                </p>
              </div>

              <div className="bg-[#FCFBF7] border border-[#E6E2D8] p-8 rounded-lg space-y-4">
                <div className="p-3 bg-[#F5F3EC] rounded-lg w-fit">
                  <Sparkles className="h-6 w-6 text-[#B8860B]" />
                </div>
                <h3 className="text-lg font-serif font-bold text-[#1C1A17]">AI Proofreader & Correction</h3>
                <p className="text-sm text-[#6B665F] leading-relaxed">
                  Correct typos, grammar, and improve the flow of your writing with our built-in local Ollama artificial intelligence checker.
                </p>
              </div>

              <div className="bg-[#FCFBF7] border border-[#E6E2D8] p-8 rounded-lg space-y-4">
                <div className="p-3 bg-[#F5F3EC] rounded-lg w-fit">
                  <Crown className="h-6 w-6 text-[#B8860B]" />
                </div>
                <h3 className="text-lg font-serif font-bold text-[#1C1A17]">Instant Compilation & Storage</h3>
                <p className="text-sm text-[#6B665F] leading-relaxed">
                  Compile PDFs directly inside Docker containers using pdflatex. Your generated documents and binaries are securely stored in your personal MongoDB account.
                </p>
              </div>
            </div>
          </div>
        </section>



        {/* Pricing Section */}
        <section id="pricing" className="py-20 lg:py-32">
          <div className="max-w-7xl mx-auto px-6 lg:px-16 text-center space-y-16">
            <div className="max-w-xl mx-auto space-y-4">
              <span className="text-xs font-bold uppercase tracking-widest text-[#B8860B]">Pricing Tiers</span>
              <h2 className="text-3xl lg:text-4xl font-serif font-bold text-[#1C1A17]">Simple, transparent pricing</h2>
              <p className="text-sm text-[#6B665F]">Start drafting for free and upgrade when you are ready to compile unlimited publications.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto text-left">
              {/* Free Tier */}
              <div className="bg-[#F5F3EC] border border-[#E6E2D8] p-8 rounded-xl flex flex-col justify-between relative">
                <div>
                  <h3 className="text-xl font-serif font-bold text-[#1C1A17]">Free Draft Plan</h3>
                  <p className="text-xs text-[#6B665F] mt-2">Perfect for trial users and occasional compiling</p>
                  <div className="my-6">
                    <span className="text-3xl font-bold text-[#1C1A17] font-serif">$0</span>
                    <span className="text-xs text-[#6B665F]"> / forever</span>
                  </div>
                  <ul className="space-y-3 text-xs text-[#1C1A17] border-t border-[#E6E2D8] pt-6">
                    <li className="flex items-center gap-2">✓ First 3 PDF Compilations free</li>
                    <li className="flex items-center gap-2">✓ Basic LaTeX template</li>
                    <li className="flex items-center gap-2">✓ Local database saving</li>
                    <li className="flex items-center gap-2">✓ Full Markdown source editor</li>
                  </ul>
                </div>
                <button 
                  onClick={() => { setIsRegister(true); setShowAuthModal(true); }}
                  className="mt-8 btn-gold-outline w-full py-2.5 text-xs cursor-pointer text-center"
                >
                  Get Started Free
                </button>
              </div>

              {/* Paid Tier */}
              <div className="bg-white border-2 border-[#B8860B] p-8 rounded-xl flex flex-col justify-between relative shadow-lg">
                <div className="absolute -top-3 right-8 px-3 py-1 bg-[#B8860B] text-[#FCFBF7] text-[10px] font-bold rounded-full uppercase tracking-wider">
                  Popular
                </div>
                <div>
                  <h3 className="text-xl font-serif font-bold text-[#1C1A17]">Premium Scholar</h3>
                  <p className="text-xs text-[#6B665F] mt-2">Unlimited compiles and raw LaTeX exports</p>
                  <div className="my-6">
                    <span className="text-3xl font-bold text-[#1C1A17] font-serif">$9</span>
                    <span className="text-xs text-[#6B665F]"> / month</span>
                  </div>
                  <ul className="space-y-3 text-xs text-[#1C1A17] border-t border-[#E6E2D8] pt-6 font-medium">
                    <li className="flex items-center gap-2 text-[#B8860B]">✓ Unlimited LaTeX PDF Compilations</li>

                    <li className="flex items-center gap-2">✓ Fast download of raw LaTeX files</li>
                    <li className="flex items-center gap-2">✓ Priority document PDF storage</li>
                  </ul>
                </div>
                <button 
                  onClick={() => { setIsRegister(true); setShowAuthModal(true); }}
                  className="mt-8 btn-gold w-full py-2.5 text-xs cursor-pointer text-center"
                >
                  Upgrade Now
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 border-t border-[#E6E2D8] bg-[#F5F3EC] text-center text-xs text-[#6B665F]">
          <p>© {new Date().getFullYear()} TeXScribble. Created with premium web design principles.</p>
        </footer>

        {/* LOGIN / REGISTER MODAL */}
        {showAuthModal && (
          <div className="modal-backdrop">
            <div className="modal-content">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#E6E2D8]">
                <h3 className="text-xl font-serif font-bold text-[#1C1A17]">
                  {isRegister ? 'Create Account' : 'Sign In'}
                </h3>
                <button 
                  onClick={() => setShowAuthModal(false)}
                  className="p-1 hover:bg-[#F5F3EC] rounded text-[#6B665F] hover:text-[#1C1A17]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {authError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded text-xs mb-4">
                  {authError}
                </div>
              )}

              <form onSubmit={handleAuthSubmit} className="space-y-4">
                {isRegister && (
                  <div>
                    <label className="block text-xs font-semibold text-[#6B665F] mb-1.5">Full Name</label>
                    <input 
                      type="text"
                      required
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      className="form-input text-xs"
                      placeholder="Enter your name"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-[#6B665F] mb-1.5">Email Address</label>
                  <input 
                    type="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="form-input text-xs"
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#6B665F] mb-1.5">Password</label>
                  <input 
                    type="password"
                    required
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="form-input text-xs"
                    placeholder="Enter secure password"
                  />
                </div>

                <button 
                  type="submit"
                  disabled={authLoading}
                  className="btn-gold w-full py-2.5 text-xs font-semibold mt-6 cursor-pointer text-center"
                >
                  {authLoading ? 'Please wait...' : isRegister ? 'Register & Start Writing' : 'Sign In'}
                </button>
              </form>



              <div className="mt-6 text-center text-xs text-[#6B665F]">
                {isRegister ? (
                  <span>Already have an account? <button onClick={() => setIsRegister(false)} className="text-[#B8860B] font-semibold hover:underline">Sign In</button></span>
                ) : (
                  <span>Don't have an account? <button onClick={() => setIsRegister(true)} className="text-[#B8860B] font-semibold hover:underline">Register Free</button></span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // VIEW 3: FULL CHECKOUT / PAYMENT PAGE
  if (activeView === 'checkout') {
    return (
      <div className="min-h-screen bg-[#FCFBF7] text-[#1C1A17] flex flex-col selection:bg-[#B8860B]/10 selection:text-[#B8860B]">
        {/* Checkout Header */}
        <header className="px-6 py-6 lg:px-16 border-b border-[#E6E2D8] flex items-center justify-between">
          <button 
            onClick={() => setActiveView('dashboard')}
            className="flex items-center gap-1.5 text-xs font-semibold hover:text-[#B8860B] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </button>
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-[#B8860B]" />
            <span className="font-serif font-bold text-sm tracking-tight">TeXScribble Checkout</span>
          </div>
          <div className="w-20"></div> {/* Spacer */}
        </header>

        {/* Checkout Content Grid */}
        <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* LEFT: Billing Summary & Payment Selector (7 Cols) */}
          <div className="lg:col-span-7 space-y-8">
            <div className="checkout-card p-6 sm:p-8 space-y-6">
              <h2 className="text-2xl font-serif font-bold text-[#1C1A17]">Sandbox Payment</h2>
              <p className="text-xs text-[#6B665F]">
                Use the Sandbox checkout panel to instantly unlock Premium.
              </p>

              {/* CONDITION 1: LOCAL CARD SANDBOX INPUTS */}
              {paymentMethod === 'card' && (
                <form onSubmit={handlePaymentCheckoutSubmit} className="space-y-4 pt-4 border-t border-[#E6E2D8] animate-fade-in">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[#B8860B] mb-2">Simulated Sandbox Payment</h3>
                  
                  <div>
                    <label className="block text-xs font-semibold text-[#6B665F] mb-1.5">Cardholder Name</label>
                    <input 
                      type="text"
                      required
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                      className="form-input text-xs"
                      placeholder="e.g. John Doe"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#6B665F] mb-1.5">Card Number</label>
                    <input 
                      type="text"
                      required
                      value={cardNumber}
                      onChange={handleCardNumberChange}
                      className="form-input text-xs font-mono"
                      placeholder="4111 1111 1111 1111"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#6B665F] mb-1.5">Expiry Date</label>
                      <input 
                        type="text"
                        required
                        value={cardExpiry}
                        onChange={handleCardExpiryChange}
                        className="form-input text-xs font-mono"
                        placeholder="MM/YY"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#6B665F] mb-1.5">CVV / Security Code</label>
                      <input 
                        type="password"
                        required
                        value={cardCvv}
                        onChange={handleCardCvvChange}
                        className="form-input text-xs font-mono"
                        placeholder="123"
                      />
                    </div>
                  </div>

                  <button 
                    type="submit"
                    disabled={paymentLoading}
                    className="btn-gold w-full py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 mt-6"
                  >
                    {paymentLoading ? (
                      <span className="h-4 w-4 border-2 border-[#FCFBF7] border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      <>Verify Payment & Upgrade <Lock className="h-4 w-4" /></>
                    )}
                  </button>

                  <p className="text-[10px] text-center text-[#6B665F] mt-2">
                    🔒 Secured payment connection. Your test card information is not sent to external servers.
                  </p>
                </form>
              )}

            </div>
          </div>

          {/* RIGHT: Visual Card Preview & Pricing Card (5 Cols) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Visual Credit Card Preview (only shown if Card is chosen) */}
            {paymentMethod === 'card' && (
              <div className="credit-card-preview space-y-8 animate-fade-in">
                <div className="flex justify-between items-start">
                  <div className="h-10 w-14 bg-[#B8860B]/20 rounded-md border border-[#B8860B]/40 flex items-center justify-center font-bold text-[10px] text-[#FCFBF7]">CHIP</div>
                  <Crown className="h-6 w-6 text-[#B8860B]" />
                </div>
                
                <div className="space-y-4">
                  <div className="text-xl font-mono tracking-widest text-center py-2">
                    {cardNumber || '•••• •••• •••• ••••'}
                  </div>
                  
                  <div className="flex justify-between items-end font-mono">
                    <div className="space-y-1">
                      <div className="text-[8px] uppercase text-[#6B665F]">Cardholder</div>
                      <div className="text-xs truncate max-w-[150px] uppercase">
                        {cardName || 'YOUR NAME'}
                      </div>
                    </div>
                    
                    <div className="space-y-1 text-right">
                      <div className="text-[8px] uppercase text-[#6B665F]">Expires</div>
                      <div className="text-xs">
                        {cardExpiry || 'MM/YY'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Pricing Summary Card */}
            <div className="checkout-card p-6 space-y-6 bg-[#F5F3EC]">
              <div className="pb-4 border-b border-[#E6E2D8]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#B8860B]">Selected Plan</span>
                <h3 className="text-xl font-serif font-bold text-[#1C1A17] mt-1">Premium Scholar</h3>
                <p className="text-xs text-[#6B665F]">Unlimited builds, infinite history storage.</p>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="text-[#6B665F]">Monthly Plan Fee</span>
                  <span className="font-medium text-[#1C1A17]">$9.00</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#6B665F]">Taxes & Fees</span>
                  <span className="font-medium text-[#1C1A17]">$0.00</span>
                </div>
                <div className="flex justify-between text-xs font-bold pt-3 border-t border-[#E6E2D8]">
                  <span>Total Amount Due</span>
                  <span className="text-[#B8860B] font-serif text-lg">$9.00</span>
                </div>
              </div>

              <div className="pt-4 space-y-3">
                <div className="flex items-center gap-2 text-[10px] text-[#6B665F]">
                  <Check className="h-4 w-4 text-[#B8860B] flex-shrink-0" />
                  Instant upgrade after check verification
                </div>
                <div className="flex items-center gap-2 text-[10px] text-[#6B665F]">
                  <Check className="h-4 w-4 text-[#B8860B] flex-shrink-0" />
                  Cancel subscription at any time
                </div>
              </div>
            </div>

          </div>

        </main>
      </div>
    );
  }

  // VIEW 2: DASHBOARD VIEW
  return (
    <div className="flex h-screen bg-[#FCFBF7] text-[#1C1A17] overflow-hidden font-sans selection:bg-[#B8860B]/10 selection:text-[#B8860B]">
      
      {/* Sidebar for Document Drafts */}
      <div className={`bg-[#F5F3EC] border-r border-[#E6E2D8] flex flex-col transition-all duration-300 ${sidebarOpen ? 'w-72' : 'w-0 overflow-hidden'}`}>
        <div className="p-5 border-b border-[#E6E2D8] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-[#1C1A17] rounded">
              <FileCode className="h-4 w-4 text-[#FCFBF7]" />
            </div>
            <span className="font-serif font-bold text-sm tracking-tight">TeXScribble</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="p-1 hover:bg-[#E6E2D8] rounded text-[#6B665F] hover:text-[#1C1A17]">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* User Profile Summary */}
        <div className="p-4 border-b border-[#E6E2D8] bg-[#FCFBF7]/50 space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-[#B8860B]/10 border border-[#B8860B]/20 flex items-center justify-center text-xs font-bold text-[#B8860B]">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold truncate text-[#1C1A17]">{user?.name || 'User Profile'}</div>
              <div className="text-[10px] text-[#6B665F] truncate">{user?.email}</div>
            </div>
            <button 
              onClick={handleLogout}
              className="p-1 hover:bg-red-50 text-red-500 rounded"
              title="Sign Out"
            >
              <LogOut className="h-4.5 w-4.5" />
            </button>
          </div>

          {/* Billing Plan Overview */}
          <div className="p-2.5 bg-[#FCFBF7] border border-[#E6E2D8] rounded-md text-[10px] flex items-center justify-between">
            <div className="space-y-1">
              <div className="font-bold flex items-center gap-1">
                {user?.paid ? (
                  <span className="text-[#B8860B] flex items-center gap-0.5"><Crown className="h-3 w-3" /> Premium Active</span>
                ) : (
                  <span className="text-[#6B665F]">Free Tier Draft</span>
                )}
              </div>
              <div className="text-[#6B665F]">
                {user?.paid ? 'Unlimited compiles unlocked' : `Compiles: ${user?.conversionCount || 0}/3 free used`}
              </div>
            </div>
            {!user?.paid && (
              <button 
                onClick={() => setActiveView('checkout')}
                className="px-2 py-1 bg-[#B8860B] text-white rounded font-bold hover:bg-[#1C1A17] transition-colors cursor-pointer"
              >
                Upgrade
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="p-3">
          <input
            type="text"
            placeholder="Search drafts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-1.5 bg-white border border-[#E6E2D8] rounded text-xs focus:outline-none focus:border-[#B8860B] placeholder-[#6B665F]/60"
          />
        </div>

        {/* Draft List */}
        <div className="flex-1 overflow-y-auto px-3 space-y-1.5">
          <div className="flex items-center justify-between px-2 py-1 text-[#6B665F] text-[10px] font-bold uppercase tracking-wider">
            <span>Your Drafts</span>
            <button 
              onClick={handleNewDocument}
              className="p-1 hover:bg-[#E6E2D8] rounded text-[#B8860B]"
              title="Create New Draft"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {filteredDocs.length === 0 ? (
            <div className="text-center py-8 text-[#6B665F] text-xs font-serif italic">
              No drafts found
            </div>
          ) : (
            filteredDocs.map(doc => (
              <div
                key={doc._id}
                onClick={() => loadDocument(doc)}
                className={`group flex items-center justify-between p-3 rounded cursor-pointer transition-all border ${
                  doc._id === currentDocId 
                    ? 'bg-white border-[#B8860B] shadow-sm text-[#1C1A17] font-medium' 
                    : 'bg-transparent border-transparent text-[#6B665F] hover:bg-white/40 hover:text-[#1C1A17]'
                }`}
              >
                <div className="flex flex-col min-w-0 pr-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs truncate">{doc.title}</span>
                    {doc.hasPdf && (
                      <span className="flex-shrink-0 text-[8px] px-1 py-0.5 bg-[#B8860B]/10 text-[#B8860B] rounded font-bold uppercase tracking-wider">PDF</span>
                    )}
                  </div>
                  <span className="text-[9px] text-[#6B665F]/70 mt-0.5 font-mono">
                    {new Date(doc.updatedAt).toLocaleDateString()}
                  </span>
                </div>
                <button
                  onClick={(e) => handleDeleteDocument(doc._id, e)}
                  className="p-1 opacity-0 group-hover:opacity-100 hover:bg-[#FCFBF7] rounded text-[#6B665F] hover:text-red-500 transition-opacity"
                  title="Delete Draft"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
        
        {/* Footer info */}
        <div className="p-4 border-t border-[#E6E2D8] text-[9px] text-[#6B665F] flex justify-between bg-[#FCFBF7]/30">
          <span>Ollama: Local AI Helper</span>
          <span className="flex items-center gap-1 font-semibold text-[#B8860B]"><CheckCircle className="h-3 w-3" /> Ready</span>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#FCFBF7]">
        
        {/* Workspace Header */}
        <header className="h-14 bg-white border-b border-[#E6E2D8] flex items-center justify-between px-5 z-10">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <button 
                onClick={() => setSidebarOpen(true)}
                className="p-1.5 hover:bg-[#F5F3EC] rounded text-[#6B665F] hover:text-[#1C1A17] mr-1"
              >
                <Menu className="h-5 w-5" />
              </button>
            )}
            
            {/* Title Editor */}
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-transparent text-sm font-semibold border-b border-transparent hover:border-[#E6E2D8] focus:border-[#B8860B] focus:outline-none py-1 px-1 transition-colors min-w-[200px]"
              placeholder="Enter document title..."
            />

            {/* Autosave Status Badge */}
            <span className={`text-[9px] px-2 py-0.5 rounded flex items-center gap-1 font-medium border ${
              saveStatus === 'Saved' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' :
              saveStatus === 'Saving...' ? 'bg-amber-50 border-amber-200 text-amber-600' :
              'bg-[#F5F3EC] border-[#E6E2D8] text-[#6B665F]'
            }`}>
              {saveStatus === 'Saved' && <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse"></span>}
              {saveStatus === 'Saving...' && <span className="h-1 w-1 rounded-full bg-amber-400 animate-spin"></span>}
              {saveStatus}
            </span>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-3">

            {/* Manual Save */}
            <button
              onClick={saveDocument}
              disabled={saveStatus === 'Saved'}
              className="p-1.5 hover:bg-[#F5F3EC] border border-[#E6E2D8] rounded text-[#6B665F] disabled:opacity-50"
              title="Save document now"
            >
              <Save className="h-3.5 w-3.5" />
            </button>
          </div>
        </header>

        {/* Editor & Previewer Split Panel */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* LEFT PANEL: Text Editor */}
          <div className="w-1/2 flex flex-col border-r border-[#E6E2D8] bg-white">
            {/* Editor toolbar */}
            <div className="h-9 px-4 bg-[#F5F3EC]/50 border-b border-[#E6E2D8] flex items-center justify-between text-[10px] text-[#6B665F] font-medium">
              <span>Markdown Source Editor</span>
              <div className="flex gap-4">
                <span>{content.replace(/\n/g, '').length} chars</span>
                <span>{content.split(/\s+/).filter(Boolean).length} words</span>
              </div>
            </div>

            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="markdown-textarea flex-1 w-full p-6 text-sm focus:outline-none resize-none font-mono leading-relaxed placeholder-[#6B665F]/50 text-[#1C1A17]"
              placeholder="# Write markdown here..."
            />
          </div>

          {/* RIGHT PANEL: Live LaTeX / PDF Compiler Preview */}
          <div className="w-1/2 flex flex-col bg-[#F5F3EC]/20">
            
            {/* Tab header */}
            <div className="h-9 bg-[#F5F3EC]/50 border-b border-[#E6E2D8] flex items-center justify-between px-3">
              <div className="flex gap-1">
                <button
                  onClick={() => setActiveTab('pdf')}
                  className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all ${
                    activeTab === 'pdf' 
                      ? 'bg-white text-[#B8860B] border border-[#E6E2D8] shadow-sm' 
                      : 'text-[#6B665F] hover:text-[#1C1A17]'
                  }`}
                >
                  PDF Document
                </button>
                <button
                  onClick={() => setActiveTab('latex')}
                  className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all ${
                    activeTab === 'latex' 
                      ? 'bg-white text-[#B8860B] border border-[#E6E2D8] shadow-sm' 
                      : 'text-[#6B665F] hover:text-[#1C1A17]'
                  }`}
                >
                  LaTeX Code
                </button>
                <button
                  onClick={() => setActiveTab('logs')}
                  className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all relative ${
                    activeTab === 'logs' 
                      ? 'bg-white text-[#B8860B] border border-[#E6E2D8] shadow-sm' 
                      : 'text-[#6B665F] hover:text-[#1C1A17]'
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
                  className="flex items-center gap-1.5 px-3 py-1 bg-[#1C1A17] hover:bg-[#B8860B] disabled:opacity-50 text-[10px] font-bold text-white rounded uppercase tracking-wider shadow-sm transition-all cursor-pointer"
                >
                  <FileCheck className={`h-3.5 w-3.5 ${isCompiling ? 'animate-spin' : ''}`} />
                  {isCompiling ? 'Compiling...' : 'Compile PDF'}
                </button>

                {latexCode && (
                  <button
                    onClick={handleDownloadTex}
                    className="p-1 hover:bg-[#E6E2D8] text-[#6B665F] hover:text-[#1C1A17] rounded border border-[#E6E2D8]"
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
                <div className="flex-1 flex flex-col items-center justify-center bg-white rounded border border-[#E6E2D8] overflow-hidden relative">
                  {isCompiling ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-8 w-8 border-3 border-[#B8860B]/20 border-t-[#B8860B] rounded-full animate-spin"></div>
                      <span className="text-xs text-[#6B665F] font-serif italic">Compiling Markdown via pdflatex...</span>
                    </div>
                  ) : pdfUrl ? (
                    <div className="w-full h-full flex flex-col">
                      <div className="h-10 px-4 bg-[#F5F3EC]/60 border-b border-[#E6E2D8] flex items-center justify-between text-xs text-[#6B665F]">
                        <span className="flex items-center gap-1 text-emerald-600 font-medium"><CheckCircle className="h-4 w-4" /> Compiled Cleanly</span>
                        <a 
                          href={pdfUrl} 
                          download={`${title.replace(/\s+/g, '_')}.pdf`}
                          className="flex items-center gap-1 text-[#B8860B] hover:underline font-semibold"
                        >
                          <Download className="h-3.5 w-3.5" /> Save PDF
                        </a>
                      </div>
                      <iframe 
                        src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=1`}
                        className="w-full flex-1 border-none bg-slate-100"
                        title="PDF Compile Preview"
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4 text-center max-w-sm px-4 py-8">
                      <div className="p-4 bg-[#F5F3EC] border border-[#E6E2D8] rounded-full">
                        <FileText className="h-8 w-8 text-[#B8860B]" />
                      </div>
                      <div>
                        <h3 className="text-sm font-serif font-bold text-[#1C1A17]">No PDF Generated</h3>
                        <p className="text-xs text-[#6B665F] mt-1 leading-relaxed">
                          Click compile to build your document. Free accounts include 3 compiles, with unlimited builds in premium.
                        </p>
                      </div>
                      <button
                        onClick={handleCompile}
                        disabled={!content}
                        className="px-4 py-2 bg-[#F5F3EC] border border-[#E6E2D8] hover:bg-white text-xs font-semibold rounded cursor-pointer"
                      >
                        Compile Now
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Tab: LaTeX Code Viewer */}
              {activeTab === 'latex' && (
                <div className="flex-1 flex flex-col bg-white rounded border border-[#E6E2D8] overflow-hidden">
                  <div className="h-8 px-4 bg-[#F5F3EC]/60 border-b border-[#E6E2D8] flex items-center justify-between text-[9px] text-[#6B665F] font-bold uppercase tracking-wider">
                    <span>Generated LaTeX Source Code</span>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(latexCode);
                        alert('LaTeX code copied to clipboard!');
                      }}
                      className="text-[#B8860B] hover:underline"
                    >
                      Copy Code
                    </button>
                  </div>
                  <textarea
                    readOnly
                    value={latexCode || 'Click "Compile PDF" to generate and view LaTeX source code.'}
                    className="flex-1 w-full p-4 bg-transparent font-mono text-xs focus:outline-none resize-none leading-relaxed text-[#1C1A17]/80"
                  />
                </div>
              )}

              {/* Tab: Compiler Logs */}
              {activeTab === 'logs' && (
                <div className="flex-1 flex flex-col bg-white rounded border border-[#E6E2D8] overflow-hidden font-mono text-xs text-[#1C1A17]">
                  <div className="h-8 px-4 bg-[#F5F3EC]/60 border-b border-[#E6E2D8] flex items-center justify-between text-[9px] text-[#6B665F] font-bold uppercase tracking-wider">
                    <span>pdflatex compilation output logs</span>
                    {compileError && <span className="text-red-600 flex items-center gap-1 font-bold"><AlertTriangle className="h-3 w-3" /> Compile Error</span>}
                  </div>
                  <div className="flex-1 p-4 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                    {compileError ? (
                      <div className="text-red-600 font-semibold">{compileError}</div>
                    ) : (
                      <div className="text-[#6B665F] italic font-serif text-center py-8">No compile logs. Build your document to view log results.</div>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>

      </div>

      {/* BILLING / UPGRADE MODAL */}
      {showUpgradeModal && (
        <div className="modal-backdrop">
          <div className="modal-content text-center max-w-sm font-sans">
            <div className="flex justify-end">
              <button 
                onClick={() => setShowUpgradeModal(false)}
                className="p-1 hover:bg-[#F5F3EC] rounded text-[#6B665F] hover:text-[#1C1A17]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-4 bg-[#B8860B]/10 rounded-full w-fit mx-auto mb-4 border border-[#B8860B]/20">
              <Crown className="h-8 w-8 text-[#B8860B]" />
            </div>

            <h3 className="text-2xl font-serif font-bold text-[#1C1A17] mb-2">Upgrade to Premium</h3>
            <p className="text-xs text-[#6B665F] mb-6 leading-relaxed">
              You've hit the limit of 3 free PDF compiles. Get unlimited compilation and raw LaTeX exports.
            </p>

            <div className="p-4 bg-[#F5F3EC] rounded-lg border border-[#E6E2D8] mb-6 text-left space-y-3 text-xs">
              <div className="flex items-center gap-2">✓ Unlimited pdf compilations</div>
              <div className="flex items-center gap-2">✓ Full LaTeX file downloads</div>

              <div className="flex items-center gap-2 font-bold text-[#B8860B]">✓ Lifetime storage for documents</div>
            </div>

            <div className="mb-6">
              <span className="text-3xl font-bold font-serif text-[#1C1A17]">$9</span>
              <span className="text-xs text-[#6B665F]"> / month</span>
            </div>

            <div className="space-y-3">
              <button 
                onClick={() => { setShowUpgradeModal(false); setActiveView('checkout'); }}
                className="btn-gold w-full py-2.5 text-xs font-semibold cursor-pointer text-center"
              >
                Unlock Unlimited Compiling
              </button>
              <button 
                onClick={() => setShowUpgradeModal(false)}
                className="text-xs text-[#6B665F] hover:underline"
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
