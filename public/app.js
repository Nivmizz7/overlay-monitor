const statusEl = document.getElementById("status");
const updatedEl = document.getElementById("updated");
const contentEl = document.getElementById("content");

let lastMtime = 0;

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderInline(text) {
  let html = escapeHtml(text);
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener">$1</a>',
  );
  return html;
}

function splitTableRow(row) {
  const trimmed = row.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function isTableSeparator(line) {
  return line.includes("|") && /^[\s|:-]+$/.test(line);
}

function renderBlock(text) {
  const lines = text.split(/\r?\n/);
  let i = 0;
  let html = "";

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line);
    if (headingMatch) {
      const level = headingMatch[1].length;
      html += `<h${level}>${renderInline(
        headingMatch[2].trim(),
      )}</h${level}>`;
      i += 1;
      continue;
    }

    if (line.includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headers = splitTableRow(line);
      i += 2;
      const rows = [];

      while (i < lines.length && lines[i].includes("|")) {
        rows.push(splitTableRow(lines[i]));
        i += 1;
      }

      html += "<table><thead><tr>";
      headers.forEach((header) => {
        html += `<th>${renderInline(header)}</th>`;
      });
      html += "</tr></thead><tbody>";
      rows.forEach((row) => {
        html += "<tr>";
        row.forEach((cell) => {
          html += `<td>${renderInline(cell)}</td>`;
        });
        html += "</tr>";
      });
      html += "</tbody></table>";
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      html += "<ul>";
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        html += `<li>${renderInline(lines[i].replace(/^[-*]\s+/, ""))}</li>`;
        i += 1;
      }
      html += "</ul>";
      continue;
    }

    const paragraphLines = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,6})\s+/.test(lines[i]) &&
      !/^[-*]\s+/.test(lines[i]) &&
      !(lines[i].includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1]))
    ) {
      paragraphLines.push(lines[i]);
      i += 1;
    }

    if (paragraphLines.length) {
      html += `<p>${renderInline(paragraphLines.join(" "))}</p>`;
    }
  }

  return html;
}

function renderMarkdown(markdown) {
  const chunks = markdown.split(/```/);
  return chunks
    .map((chunk, index) => {
      if (index % 2 === 1) {
        const code = escapeHtml(chunk.replace(/^\n/, "").replace(/\n$/, ""));
        return `<pre><code>${code}</code></pre>`;
      }
      return renderBlock(chunk);
    })
    .join("");
}

async function loadReadme() {
  try {
    const response = await fetch("/readme", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("readme_fetch_failed");
    }
    const data = await response.json();
    if (data.mtimeMs !== lastMtime) {
      contentEl.innerHTML = renderMarkdown(data.content || "");
      lastMtime = data.mtimeMs;
    }
    statusEl.textContent = "Synchronise";
    const updatedDate = new Date(data.mtimeMs);
    updatedEl.textContent = `Derniere mise a jour : ${updatedDate.toLocaleString()}`;
  } catch (error) {
    statusEl.textContent = "Erreur de chargement";
  }
}

loadReadme();
setInterval(loadReadme, 2000);
