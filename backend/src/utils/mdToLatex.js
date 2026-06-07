/**
 * Utility to convert Markdown text to LaTeX format.
 * Preserves inline LaTeX math expressions like $e = mc^2$ while formatting standard markdown elements.
 */
export function mdToLatex(markdown, title = 'Untitled Document') {
  if (!markdown) return '';

  const lines = markdown.split('\n');
  const latexBody = [];
  let inList = null; // 'itemize', 'enumerate', 'listings' or null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Handle code blocks
    if (line.trim().startsWith('```')) {
      if (inList === 'listings') {
        latexBody.push('\\end{lstlisting}');
        inList = null;
      } else {
        // Close other list if open
        if (inList) {
          latexBody.push(`\\end{${inList}}`);
        }
        latexBody.push('\\begin{lstlisting}');
        inList = 'listings';
      }
      continue;
    }

    if (inList === 'listings') {
      latexBody.push(line);
      continue;
    }

    // Handle empty lines (paragraphs)
    if (line.trim() === '') {
      if (inList === 'itemize' || inList === 'enumerate') {
        latexBody.push(`\\end{${inList}}`);
        inList = null;
      }
      latexBody.push('\n'); // Paragraph break
      continue;
    }

    // Handle lists
    // Unordered list item
    const itemizeMatch = line.match(/^(\s*)[-\*]\s+(.*)$/);
    if (itemizeMatch) {
      const content = itemizeMatch[2];
      if (inList !== 'itemize') {
        if (inList === 'enumerate') {
          latexBody.push('\\end{enumerate}');
        }
        latexBody.push('\\begin{itemize}');
        inList = 'itemize';
      }
      latexBody.push(`  \\item ${parseInline(content)}`);
      continue;
    }

    // Ordered list item
    const enumerateMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);
    if (enumerateMatch) {
      const content = enumerateMatch[2];
      if (inList !== 'enumerate') {
        if (inList === 'itemize') {
          latexBody.push('\\end{itemize}');
        }
        latexBody.push('\\begin{enumerate}');
        inList = 'enumerate';
      }
      latexBody.push(`  \\item ${parseInline(content)}`);
      continue;
    }

    // Close list if we exit listing context
    if (inList === 'itemize' || inList === 'enumerate') {
      latexBody.push(`\\end{${inList}}`);
      inList = null;
    }

    // Handle headers with starred sections to disable auto-numbering
    if (line.startsWith('# ')) {
      latexBody.push(`\\section*{${parseInline(line.substring(2))}}`);
    } else if (line.startsWith('## ')) {
      latexBody.push(`\\subsection*{${parseInline(line.substring(3))}}`);
    } else if (line.startsWith('### ')) {
      latexBody.push(`\\subsubsection*{${parseInline(line.substring(4))}}`);
    } else if (line.startsWith('#### ')) {
      latexBody.push(`\\paragraph*{${parseInline(line.substring(5))}}`);
    } else if (line.startsWith('> ')) {
      latexBody.push(`\\begin{quote}\n${parseInline(line.substring(2))}\n\\end{quote}`);
    } else {
      latexBody.push(parseInline(line));
    }
  }

  // Clean up remaining open list
  if (inList) {
    if (inList === 'listings') {
      latexBody.push('\\end{lstlisting}');
    } else {
      latexBody.push(`\\end{${inList}}`);
    }
  }

  const bodyText = latexBody.join('\n');

  return `\\documentclass[11pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[margin=1in]{geometry}
\\usepackage{hyperref}
\\usepackage{amsmath}
\\usepackage{amsfonts}
\\usepackage{graphicx}
\\usepackage{booktabs}
\\usepackage{listings}
\\usepackage{xcolor}

\\lstset{
    basicstyle=\\ttfamily\\small,
    backgroundcolor=\\color{gray!10},
    frame=single,
    breaklines=true,
    keepspaces=true,
    showstringspaces=false
}

\\hypersetup{
    colorlinks=true,
    linkcolor=blue,
    filecolor=magenta,      
    urlcolor=blue,
}

\\title{${title}}
\\author{Markdown-to-LaTeX Converter}
\\date{\\today}

\\begin{document}

\\maketitle

${bodyText}

\\end{document}`;
}

function parseInline(text) {
  let parsed = text;

  // Handle single $ signs count to keep math modes safe
  const dollarCount = (parsed.match(/(?<!\\)\$/g) || []).length;
  if (dollarCount % 2 !== 0) {
    parsed = parsed.replace(/(?<!\\)\$/g, '\\$');
  }

  // Escape percentage and ampersand
  parsed = parsed.replace(/%/g, '\\%');
  parsed = parsed.replace(/&/g, '\\&');

  // Split by math formula delimiter to avoid escaping valid LaTeX math
  const parts = parsed.split(/(?<!\\)\$/);
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      // Apply markdown parse and escapes only to non-math blocks
      let block = parts[i];

      // Split by inline code delimiter ` to protect inline code from other rules
      const codeParts = block.split('`');
      for (let j = 0; j < codeParts.length; j++) {
        if (j % 2 === 0) {
          // Outside inline code: parse markdown formatting
          let sub = codeParts[j];
          sub = sub.replace(/\*\*(.*?)\*\*/g, '\u0001$1\u0002');
          sub = sub.replace(/__(.*?)__/g, '\u0001$1\u0002');
          sub = sub.replace(/\*(.*?)\*/g, '\u0003$1\u0004');
          sub = sub.replace(/_(.*?)_/g, '\u0003$1\u0004');
          sub = sub.replace(/\[(.*?)\]\((.*?)\)/g, '\u0007$2\u0008$1\u0009');

          // Escape LaTeX special characters
          sub = sub
            .replace(/_/g, '\\_')
            .replace(/#/g, '\\#')
            .replace(/{/g, '\\{')
            .replace(/}/g, '\\}');

          codeParts[j] = sub;
        } else {
          // Inside inline code: just escape special characters and wrap in \texttt
          let sub = codeParts[j];
          sub = sub
            .replace(/_/g, '\\_')
            .replace(/#/g, '\\#')
            .replace(/{/g, '\\{')
            .replace(/}/g, '\\}');
          codeParts[j] = `\\texttt{${sub}}`;
        }
      }
      block = codeParts.join('');

      // Map safe control tokens back to proper LaTeX macros
      block = block
        .replace(/\u0001/g, '\\textbf{')
        .replace(/\u0002/g, '}')
        .replace(/\u0003/g, '\\textit{')
        .replace(/\u0004/g, '}')
        .replace(/\u0007/g, '\\href{')
        .replace(/\u0008/g, '}{')
        .replace(/\u0009/g, '}');

      parts[i] = block;
    }
  }

  return parts.join('$');
}
