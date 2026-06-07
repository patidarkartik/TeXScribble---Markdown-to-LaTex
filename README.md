# TeXScribble | Markdown-to-LaTeX Document Converter

TeXScribble is a modern, premium split-screen web application built on the MERN stack. It allows users to write simple Markdown or plain text and automatically compiles it into highly professional LaTeX code and PDF documents using a system LaTeX compiler. The app also features an AI-powered proofreader that hooks into your local, 100% free Ollama AI instance to clean up spelling and grammar errors.

---

## Key Features

- **Sleek Split-Screen Workspace**: Modern dark-theme editor on the left pane and dynamic tabbed compiler preview (PDF, LaTeX Code, Compiler Logs) on the right.
- **Dynamic PDF Live Preview**: Builds the PDF on-the-fly via system processes and renders it in an interactive browser container.
- **Free Local AI Proofreader**: Integrated grammar, punctuation, and spelling checker utilizing a local Ollama instance (no API keys required).
- **Auto-Saving Drafts**: Keeps your work synced to a local MongoDB database with debounced automatic saving.
- **Clean Document Downloads**: Download files directly as compiled PDFs (`.pdf`) or export the raw LaTeX source (`.tex`) for external compilers.
- **Gracious Fallbacks**: If a LaTeX compiler is not installed on the system, compilation errors/logs are captured, highlighting errors, and the generated LaTeX code is still returned so your work is never lost.

---

## Tech Stack & Dependencies

- **Frontend**: React.js (Vite), Tailwind CSS v4, Lucide React
- **Backend**: Node.js, Express.js
- **Database**: MongoDB (Mongoose ORM)
- **AI Integration**: Local Ollama (http://localhost:11434)
- **LaTeX Compiler**: `pdflatex` (System-wide binary)
- **Containerization**: Docker & Docker Compose

---

## Getting Started

### Prerequisites

To run the application locally on your host machine, you will need:

1. **Node.js** (v18 or higher recommended)
2. **MongoDB** (Local instance running at `mongodb://localhost:27017`)
3. **Ollama** (Running locally at `http://localhost:11434` with `llama3` or another preferred model pulled)
   - Install from [ollama.com](https://ollama.com/)
   - Pull the default model: `ollama pull llama3`
4. **LaTeX Compiler** (Required for PDF generation on the host machine):
   - **Windows**: Install [MiKTeX](https://miktex.org/download) or [TeX Live](https://www.tug.org/texlive/). Ensure `pdflatex` is added to your environment `PATH`.
   - **macOS**: Install [MacTeX](https://www.tug.org/mactex/).
   - **Linux**: Install `texlive-latex-base` and `texlive-fonts-recommended` (e.g., `sudo apt-get install texlive-latex-base texlive-fonts-recommended`).

---

## Deployment Option 1: Docker Compose (Easiest)

Docker Compose automatically encapsulates the MongoDB database, the Express backend, and the React frontend. It **automatically installs the LaTeX compiler inside the backend container**, meaning you do not need to install LaTeX on your host machine!

1. Open a terminal in the root directory.
2. Build and run the containers:
   ```bash
   docker-compose up --build
   ```
3. Open your browser and navigate to:
   - **Frontend**: [http://localhost:5173](http://localhost:5173)
   - **Backend API**: [http://localhost:5000](http://localhost:5000)

*Note: The backend container uses `host.docker.internal` to talk directly to the Ollama instance running on your host machine.*

---

## Deployment Option 2: Host Local Run (For Development)

If you wish to run the app directly on your host machine (outside Docker):

### 1. Start MongoDB & Ollama
- Ensure local MongoDB is running on port `27017`.
- Start Ollama and verify it is accessible at `http://localhost:11434`.

### 2. Run the Backend Server
1. Navigate to the `backend/` directory:
   ```bash
   cd backend
   ```
2. Install npm packages:
   ```bash
   npm install
   ```
3. Configure environment variables (a default `.env` is provided, edit if needed):
   ```env
   PORT=5000
   MONGODB_URI=mongodb://127.0.0.1:27017/markdown_latex
   ```
4. Start the server in development mode (using nodemon):
   ```bash
   npm run dev
   ```

### 3. Run the Frontend App
1. Open a new terminal and navigate to the `frontend/` directory:
   ```bash
   cd frontend
   ```
2. Install npm packages:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Open the displayed URL in your browser (usually `http://localhost:5173`).

---

## Project Structure

```
MLOps Sig/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js            # MongoDB database connection configuration
│   │   ├── models/
│   │   │   └── Document.js      # Mongoose schema mapping drafts
│   │   ├── utils/
│   │   │   └── mdToLatex.js     # Custom Markdown-to-LaTeX syntax translator
│   │   └── server.js            # Express server handling compiler, AI & DB logic
│   ├── package.json             # Backend dependencies
│   ├── .env                     # Server environment variables configuration
│   └── Dockerfile               # Node.js slim + LaTeX compiler build definition
├── frontend/
│   ├── src/
│   │   ├── App.jsx              # Main workspace and UI controller
│   │   ├── index.css            # Stylesheets with Google Fonts & Tailwind imports
│   │   └── main.jsx             # React entrypoint
│   ├── index.html               # Main page layout and viewport metadata
│   ├── vite.config.js           # Vite server configuration with Tailwind v4
│   ├── package.json             # Frontend dependencies
│   └── Dockerfile               # Production Nginx multi-stage build definition
├── docker-compose.yml           # Multi-container deployment orchestrator
└── README.md                    # This documentation file
```

---

## LaTeX Syntax Formatting Support

Our parser translates standard Markdown tags to their corresponding LaTeX commands:

| Markdown Element | LaTeX Output |
| :--- | :--- |
| `# Heading 1` | `\section{Heading 1}` |
| `## Heading 2` | `\subsection{Heading 2}` |
| `### Heading 3` | `\subsubsection{Heading 3}` |
| `**bold text**` | `\textbf{bold text}` |
| `*italic text*` | `\textit{italic text}` |
| `- Item 1` | `\begin{itemize} \item Item 1 \end{itemize}` |
| `1. First` | `\begin{enumerate} \item First \end{enumerate}` |
| `` `inline code` `` | `\texttt{inline code}` |
| ` ```code block``` ` | `\begin{verbatim} code block \end{verbatim}` |
| `[text](url)` | `\href{url}{text}` |
| `$E = mc^2$` (inline math) | `$E = mc^2$` (preserved mathematical block) |
| `$$formula$$` (block math) | `$$formula$$` (preserved mathematical block) |
