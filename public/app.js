const statusEl = document.getElementById("status");
const updatedEl = document.getElementById("updated");
const pathEl = document.getElementById("path");
const emptyEl = document.getElementById("empty");
const sectionsEl = document.getElementById("sections");
const titleEl = document.getElementById("page-title");
const ledeEl = document.getElementById("page-lede");
const navEl = document.getElementById("nav");
let pollTimer = null;

const typeMap = {
  tasks: {
    title: "Tasks",
    lede: "Corrections sur les taches.",
  },
  hideout: {
    title: "Hideout",
    lede: "Corrections sur le hideout.",
  },
  items: {
    title: "Items",
    lede: "Corrections sur les items.",
  },
  traders: {
    title: "Traders",
    lede: "Corrections sur les traders.",
  },
};

function getPageType() {
  const path = window.location.pathname.replace("/", "");
  if (!path) {
    return "tasks";
  }
  return typeMap[path] ? path : "tasks";
}

const pageType = getPageType();

if (titleEl && typeMap[pageType]) {
  titleEl.textContent = typeMap[pageType].title;
}
if (ledeEl && typeMap[pageType]) {
  ledeEl.textContent = typeMap[pageType].lede;
}
if (navEl) {
  navEl.querySelectorAll("a").forEach((link) => {
    if (link.dataset.type === pageType) {
      link.classList.add("active");
    }
  });
}

function renderSections(sections) {
  sectionsEl.innerHTML = "";
  let hasRows = false;

  (sections || []).forEach((section) => {
    if (!section.rows || section.rows.length === 0) {
      return;
    }
    hasRows = true;
    const wrapper = document.createElement("div");
    wrapper.className = "section";

    const title = document.createElement("h2");
    title.textContent = section.title;
    wrapper.appendChild(title);

    if (section.truncated) {
      const note = document.createElement("div");
      note.className = "note";
      note.textContent = "Affichage limite. Augmente MAX_ROWS si besoin.";
      wrapper.appendChild(note);
    }

    const table = document.createElement("table");
    table.className = "table";
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    section.columns.forEach((column) => {
      const th = document.createElement("th");
      th.textContent = column;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    section.rows.forEach((rowValues) => {
      const row = document.createElement("tr");
      rowValues.forEach((value) => {
        const td = document.createElement("td");
        td.textContent = value;
        row.appendChild(td);
      });
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    wrapper.appendChild(table);
    sectionsEl.appendChild(wrapper);
  });

  emptyEl.style.display = hasRows ? "none" : "block";
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

  renderSections(state.sections);
}

async function fetchLatest() {
  try {
    const response = await fetch(`/latest?type=${pageType}`, { cache: "no-store" });
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

  const source = new EventSource(`/events?type=${pageType}`);
  source.addEventListener("summary", (event) => {
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
