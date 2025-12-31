const statusEl = document.getElementById("status");
const updatedEl = document.getElementById("updated");
const pathEl = document.getElementById("path");
const emptyEl = document.getElementById("empty");
const tableEl = document.getElementById("table");
const tbodyEl = document.getElementById("tbody");
let pollTimer = null;

function formatValue(value) {
  if (value === null || value === undefined) {
    return "--";
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return String(value);
  }
}

function renderTable(changes) {
  tbodyEl.innerHTML = "";
  if (!changes || changes.length === 0) {
    emptyEl.style.display = "block";
    tableEl.style.display = "none";
    return;
  }

  emptyEl.style.display = "none";
  tableEl.style.display = "table";

  changes.forEach((change) => {
    const row = document.createElement("tr");

    const typeCell = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = `badge ${change.type}`;
    badge.textContent = change.type;
    typeCell.appendChild(badge);

    const pathCell = document.createElement("td");
    pathCell.textContent = change.path || "(root)";

    const oldCell = document.createElement("td");
    const oldPre = document.createElement("pre");
    oldPre.className = "value";
    oldPre.textContent = formatValue(change.oldValue);
    oldCell.appendChild(oldPre);

    const newCell = document.createElement("td");
    const newPre = document.createElement("pre");
    newPre.className = "value";
    newPre.textContent = formatValue(change.newValue);
    newCell.appendChild(newPre);

    row.appendChild(typeCell);
    row.appendChild(pathCell);
    row.appendChild(oldCell);
    row.appendChild(newCell);
    tbodyEl.appendChild(row);
  });
}

function updateStatus(state) {
  if (!state) {
    return;
  }
  if (state.error) {
    statusEl.textContent = "Erreur de lecture";
  } else {
    statusEl.textContent = "Synchronise";
  }

  if (state.updatedAt) {
    const updatedDate = new Date(state.updatedAt);
    updatedEl.textContent = `Derniere mise a jour : ${updatedDate.toLocaleString()}`;
  }

  if (state.filePath) {
    pathEl.textContent = state.filePath;
  }

  renderTable(state.changes);
}

async function fetchLatest() {
  try {
    const response = await fetch("/latest", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("latest_fetch_failed");
    }
    const data = await response.json();
    updateStatus(data);
  } catch (error) {
    statusEl.textContent = "Erreur de chargement";
  }
}

function startPolling() {
  if (pollTimer) {
    return;
  }
  pollTimer = window.setInterval(fetchLatest, 2000);
}

function connectEvents() {
  if (!window.EventSource) {
    return false;
  }

  const source = new EventSource("/events");
  source.addEventListener("state", (event) => {
    updateStatus(JSON.parse(event.data));
  });
  source.addEventListener("changes", (event) => {
    updateStatus(JSON.parse(event.data));
  });
  source.addEventListener("error", (event) => {
    updateStatus(JSON.parse(event.data));
  });
  source.onerror = () => {
    statusEl.textContent = "Connexion interrompue";
    source.close();
    startPolling();
    fetchLatest();
  };
  return true;
}

fetchLatest();
if (!connectEvents()) {
  startPolling();
}
