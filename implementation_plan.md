# Persist Compiled PDFs in MongoDB

Currently, compiling a markdown document to PDF generates a temporary file on the backend server that is deleted immediately after the browser downloads it. When you switch drafts or reload the website, the PDF preview disappears, showing "No PDF Generated" until you compile again.

This plan outlines the changes to store the compiled PDF directly in MongoDB as a binary buffer, so the website can persist, load, and display the compiled PDF for each draft automatically.

## Proposed Changes

### 1. Backend

#### [MODIFY] [Document.js](file:///d:/Jarvis/MLOps%20Sig/backend/src/models/Document.js)
- Add `pdfData` (`Buffer`) to store the compiled binary PDF.
- Add `hasPdf` (`Boolean`) as a lightweight flag to indicate if a PDF is saved, allowing the sidebar draft list to load fast without transferring large binary files.

#### [MODIFY] [server.js](file:///d:/Jarvis/MLOps%20Sig/backend/src/server.js)
- Update GET `/api/documents` and `/api/documents/:id` to exclude `pdfData` using projection (`-pdfData`) to ensure fast page loads.
- Add a new route `GET /api/documents/:id/pdf` that fetches `pdfData` from MongoDB and serves it directly with the `application/pdf` header. This allows the frontend iframe to display it directly.
- Update POST `/api/convert` to accept an optional `documentId` body parameter. When compilation is successful, read the compiled PDF file into a buffer, write it to MongoDB under `pdfData`, and set `hasPdf = true`.

---

### 2. Frontend

#### [MODIFY] [App.jsx](file:///d:/Jarvis/MLOps%20Sig/frontend/src/App.jsx)
- Update `saveDocument` to automatically perform a `POST` request to create a new document in MongoDB if `currentDocId` is null (rather than doing nothing). This ensures any typing immediately registers a saved draft in the left sidebar.
- Update `loadDocument(doc)` to check if `doc.hasPdf` is true. If it is, set `pdfUrl` to `${API_BASE}/documents/${doc._id}/pdf` so the previously compiled PDF displays instantly.
- Update `handleCompile` to:
  - First, save the document to the database (creating a new draft if `currentDocId` is null) so we have a valid MongoDB document and ID.
  - Second, trigger `/api/convert` passing the `documentId` in the body payload.
  - Third, on success, update the local `documents` list state to set `hasPdf = true` for the active document, and set `pdfUrl` to `${API_BASE}/documents/${currentDocId}/pdf?t=${Date.now()}`.

## Verification Plan

### Automated/Manual Verification
1. Open the application.
2. Select a draft or create a new draft.
3. Write markdown and compile to PDF.
4. Verify the PDF compiles and displays in the preview tab.
5. Click the "LaTeX Code" tab and confirm the LaTeX code matches.
6. Switch to another draft, then switch back to the original draft.
7. Verify the compiled PDF preview loads **instantly** without having to compile again.
8. Reload the browser and verify the PDF preview is still displayed.
