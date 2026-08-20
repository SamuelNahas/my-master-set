const STORAGE_KEY = "master-set-pokemon-tcg-v1";
const PAGE_SIZE = 24;
const collator = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });

const elements = {
  grid: document.querySelector("#card-grid"),
  loading: document.querySelector("#loading-state"),
  empty: document.querySelector("#empty-state"),
  loadMore: document.querySelector("#load-more"),
  pokemonTabs: document.querySelector("#pokemon-tabs"),
  search: document.querySelector("#search-input"),
  rarity: document.querySelector("#rarity-filter"),
  sort: document.querySelector("#sort-select"),
  resultCount: document.querySelector("#result-count"),
  title: document.querySelector("#catalog-title"),
  kicker: document.querySelector("#catalog-kicker"),
  dialog: document.querySelector("#card-dialog"),
  dialogContent: document.querySelector("#dialog-content"),
  toast: document.querySelector("#toast"),
};

const state = {
  catalog: null,
  owned: loadOwned(),
  language: "PT-BR",
  pokemon: "all",
  status: "all",
  search: "",
  rarity: "all",
  sort: "pokemon",
  visible: PAGE_SIZE,
  selectedCardId: null,
};

function loadOwned() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return new Set(Array.isArray(saved) ? saved : []);
  } catch {
    return new Set();
  }
}

function saveOwned() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...state.owned]));
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]);
}

function normalize(value = "") {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function percentage(part, total) {
  if (!total) return "0%";
  const value = (part / total) * 100;
  return `${value < 10 && value % 1 ? value.toFixed(1) : Math.round(value)}%`;
}

function imageReferenceBadge(card) {
  if (!card.imageLanguage || card.imageLanguage === card.language) return "";
  const label = card.imageLanguage.startsWith("PT-BR") ? "PT" : card.imageLanguage.startsWith("InglÃªs") ? "EN" : "REF";
  return `<span class="image-ref">IMAGEM ${label}</span>`;
}

function filteredCards() {
  if (!state.catalog) return [];
  const query = normalize(state.search.trim());
  const cards = state.catalog.cards.filter((card) => {
    if (card.language !== state.language) return false;
    if (state.pokemon !== "all" && card.pokemon !== state.pokemon) return false;
    const owned = state.owned.has(card.id);
    if (state.status === "owned" && !owned) return false;
    if (state.status === "missing" && owned) return false;
    if (state.rarity !== "all" && card.rarity !== state.rarity) return false;
    if (query && !normalize(`${card.name} ${card.set} ${card.number} ${card.rarity} ${card.variant}`).includes(query)) return false;
    return true;
  });

  cards.sort((a, b) => {
    if (state.sort === "set") return collator.compare(a.set, b.set) || collator.compare(a.number, b.number);
    if (state.sort === "name") return collator.compare(a.name, b.name) || collator.compare(a.set, b.set);
    if (state.sort === "missing") return Number(state.owned.has(a.id)) - Number(state.owned.has(b.id)) || collator.compare(a.pokemonLabel, b.pokemonLabel);
    return collator.compare(a.pokemonLabel, b.pokemonLabel) || collator.compare(a.set, b.set) || collator.compare(a.number, b.number);
  });
  return cards;
}

function renderCard(card) {
  const owned = state.owned.has(card.id);
  const image = card.image
    ? `<img src="${escapeHtml(card.image)}" alt="Carta ${escapeHtml(card.name)} da coleÃ§Ã£o ${escapeHtml(card.set)}" loading="lazy" decoding="async"><span class="image-placeholder" hidden><b>?</b><span>Imagem ainda nÃ£o disponÃ­vel</span></span>`
    : `<span class="image-placeholder"><b>?</b><span>Imagem ainda nÃ£o disponÃ­vel</span></span>`;
  return `
    <article class="tcg-card${owned ? " is-owned" : ""}" data-card-id="${escapeHtml(card.id)}">
      <button class="card-image-wrap" type="button" data-view-card="${escapeHtml(card.id)}" aria-label="Ver detalhes de ${escapeHtml(card.name)}">
        ${image}
        <span class="language">${escapeHtml(card.language)}</span>
        ${imageReferenceBadge(card)}
        ${owned ? '<span class="owned-label">âœ“ NA COLEÃ‡ÃƒO</span>' : ""}
        ${card.extraReason ? '<span class="extra-label">EXTRA JP</span>' : ""}
        ${card.sourceNote ? '<span class="extra-label history-label">HISTÃ“RICO</span>' : ""}
      </button>
      <div class="card-info">
        <p>${escapeHtml(card.set)} <span>#${escapeHtml(card.number)}</span></p>
        <h3>${escapeHtml(card.name)}</h3>
        <div class="card-details"><span class="rarity">â—† ${escapeHtml(card.rarity)}<br>${escapeHtml(card.variant)}</span><button class="own-button" type="button" data-toggle-owned="${escapeHtml(card.id)}" aria-label="${owned ? "Remover" : "Marcar"} ${escapeHtml(card.name)} ${owned ? "da" : "na"} coleÃ§Ã£o">${owned ? "âœ“" : "+"}</button></div>
        ${card.extraReason ? `<p class="extra-reason">${escapeHtml(card.extraReason)}</p>` : ""}
        ${card.sourceNote ? `<p class="extra-reason">${escapeHtml(card.sourceNote)}</p>` : ""}
      </div>
    </article>`;
}

function renderPokemonTabs() {
  const cards = state.catalog.cards.filter((card) => card.language === state.language);
  const tabs = [{ id: "all", label: "Todos" }, ...state.catalog.pokemon];
  elements.pokemonTabs.innerHTML = tabs.map((pokemon) => {
    const count = pokemon.id === "all" ? cards.length : cards.filter((card) => card.pokemon === pokemon.id).length;
    const active = state.pokemon === pokemon.id;
    return `<button class="${active ? "active" : ""}" type="button" data-pokemon="${pokemon.id}" aria-pressed="${active}">${escapeHtml(pokemon.label)} <span class="tab-count">${count}</span></button>`;
  }).join("");
}

function renderRarities() {
  const rarities = [...new Set(state.catalog.cards.filter((card) => card.language === state.language).map((card) => card.rarity))].sort(collator.compare);
  elements.rarity.innerHTML = '<option value="all">Todas as raridades</option>' + rarities.map((rarity) => `<option value="${escapeHtml(rarity)}">${escapeHtml(rarity)}</option>`).join("");
  elements.rarity.value = rarities.includes(state.rarity) ? state.rarity : "all";
  state.rarity = elements.rarity.value;
}

function renderStats() {
  const cards = state.catalog.cards;
  const owned = cards.reduce((total, card) => total + Number(state.owned.has(card.id)), 0);
  const missing = cards.length - owned;
  const ownedPercent = percentage(owned, cards.length);
  const missingPercent = percentage(missing, cards.length);
  document.querySelector("#progress-percent").textContent = ownedPercent;
  document.querySelector("#progress-bar").style.width = ownedPercent;
  document.querySelector("#owned-total").textContent = `${owned} na coleÃ§Ã£o`;
  document.querySelector("#missing-total").textContent = `${missing} faltando`;
  document.querySelector("#stat-total").textContent = cards.length;
  document.querySelector("#stat-owned").textContent = owned;
  document.querySelector("#stat-owned-percent").textContent = `${ownedPercent} do total`;
  document.querySelector("#stat-missing").textContent = missing;
  document.querySelector("#stat-missing-percent").textContent = `${missingPercent} do total`;
}

function renderCards() {
  const cards = filteredCards();
  const shown = cards.slice(0, state.visible);
  elements.grid.innerHTML = shown.map(renderCard).join("");
  elements.resultCount.textContent = `${cards.length} ${cards.length === 1 ? "variante encontrada" : "variantes encontradas"}`;
  elements.empty.hidden = cards.length > 0;
  elements.loadMore.hidden = shown.length >= cards.length;
  elements.loadMore.textContent = `Mostrar mais ${Math.min(PAGE_SIZE, cards.length - shown.length)} cartas`;
  attachImageFallbacks();
}

function renderHeadings() {
  const pokemon = state.catalog.pokemon.find((item) => item.id === state.pokemon);
  const languageHeading = {
    "PT-BR": ["Todas as cartas", "FICHÃRIO DIGITAL"],
    "Internacional": ["HistÃ³rico internacional", "EDIÃ‡Ã•ES AUSENTES NA BASE PT-BR"],
    "JaponÃªs": ["Extras japoneses", "EDIÃ‡Ã•ES JAPONESAS"],
  }[state.language];
  elements.title.textContent = pokemon ? pokemon.label : languageHeading[0];
  elements.kicker.textContent = languageHeading[1];
}

function renderAll({ resetVisible = false, refreshTabs = false, refreshRarities = false } = {}) {
  if (resetVisible) state.visible = PAGE_SIZE;
  if (refreshTabs) renderPokemonTabs();
  if (refreshRarities) renderRarities();
  renderHeadings();
  renderStats();
  renderCards();
}

function attachImageFallbacks() {
  elements.grid.querySelectorAll("img").forEach((image) => {
    image.addEventListener("error", () => {
      image.hidden = true;
      const placeholder = image.nextElementSibling;
      if (placeholder) placeholder.hidden = false;
    }, { once: true });
  });
}

function toggleOwned(id) {
  const card = state.catalog.cards.find((item) => item.id === id);
  if (!card) return;
  if (state.owned.has(id)) {
    state.owned.delete(id);
    showToast(`${card.name} voltou para as faltantes.`);
  } else {
    state.owned.add(id);
    showToast(`${card.name} entrou na sua coleÃ§Ã£o!`);
  }
  saveOwned();
  renderAll();
  if (state.selectedCardId === id && elements.dialog.open) openCardDialog(id);
}

function openCardDialog(id) {
  const card = state.catalog.cards.find((item) => item.id === id);
  if (!card) return;
  state.selectedCardId = id;
  const owned = state.owned.has(id);
  const image = card.imageHigh
    ? `<img src="${escapeHtml(card.imageHigh)}" alt="Carta ${escapeHtml(card.name)} em alta resoluÃ§Ã£o">`
    : '<span class="image-placeholder"><b>?</b><span>Imagem ainda nÃ£o disponÃ­vel</span></span>';
  elements.dialogContent.innerHTML = `
    <div class="dialog-layout">
      <div class="dialog-image">${image}</div>
      <div class="dialog-copy">
        <p class="eyebrow">${escapeHtml(card.language)} Â· ${escapeHtml(card.pokemonLabel)}</p>
        <h2 id="dialog-title">${escapeHtml(card.name)}</h2>
        <dl>
          <div><dt>ColeÃ§Ã£o</dt><dd>${escapeHtml(card.set)}</dd></div>
          <div><dt>NÃºmero</dt><dd>#${escapeHtml(card.number)}</dd></div>
          <div><dt>Raridade</dt><dd>${escapeHtml(card.rarity)}</dd></div>
          <div><dt>Variante</dt><dd>${escapeHtml(card.variant)}</dd></div>
          ${card.imageLanguage && card.imageLanguage !== card.language ? `<div><dt>Imagem</dt><dd>Scan em ${escapeHtml(card.imageLanguage.replace(" (referÃªncia visual)", ""))} usado como referÃªncia visual.</dd></div>` : ""}
          ${card.illustrator ? `<div><dt>Ilustrador</dt><dd>${escapeHtml(card.illustrator)}</dd></div>` : ""}
          ${card.extraReason ? `<div><dt>Por que Ã© extra?</dt><dd>${escapeHtml(card.extraReason)}</dd></div>` : ""}
          ${card.sourceNote ? `<div><dt>Por que estÃ¡ no histÃ³rico?</dt><dd>${escapeHtml(card.sourceNote)}</dd></div>` : ""}
        </dl>
        <button class="dialog-action${owned ? " owned" : ""}" type="button" data-dialog-toggle="${escapeHtml(id)}">${owned ? "âœ“ EstÃ¡ na minha coleÃ§Ã£o" : "+ Marcar como obtida"}</button>
      </div>
    </div>`;
  if (!elements.dialog.open) elements.dialog.showModal();
  elements.dialogContent.querySelector("img")?.addEventListener("error", (event) => {
    event.currentTarget.parentElement.innerHTML = '<span class="image-placeholder"><b>?</b><span>Imagem ainda nÃ£o disponÃ­vel</span></span>';
  }, { once: true });
}

let toastTimer;
function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2400);
}

function exportProgress() {
  const payload = { version: 1, exportedAt: new Date().toISOString(), owned: [...state.owned] };
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
  link.download = `master-set-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("Backup da coleÃ§Ã£o exportado.");
}

async function importProgress(file) {
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.owned)) throw new Error("Formato invÃ¡lido");
    const validIds = new Set(state.catalog.cards.map((card) => card.id));
    state.owned = new Set(data.owned.filter((id) => validIds.has(id)));
    saveOwned();
    renderAll();
    showToast(`${state.owned.size} cartas restauradas do backup.`);
  } catch {
    showToast("NÃ£o foi possÃ­vel importar esse arquivo.");
  }
}

document.querySelectorAll("[data-language]").forEach((button) => button.addEventListener("click", () => {
  state.language = button.dataset.language;
  state.pokemon = "all";
  state.rarity = "all";
  document.querySelectorAll("[data-language]").forEach((item) => {
    const active = item === button;
    item.classList.toggle("active", active);
    item.setAttribute("aria-selected", active);
  });
  renderAll({ resetVisible: true, refreshTabs: true, refreshRarities: true });
}));

document.querySelectorAll("[data-status]").forEach((button) => button.addEventListener("click", () => {
  state.status = button.dataset.status;
  document.querySelectorAll("[data-status]").forEach((item) => item.classList.toggle("active", item === button));
  renderAll({ resetVisible: true });
}));

elements.pokemonTabs.addEventListener("click", (event) => {
  const button = event.target.closest("[data-pokemon]");
  if (!button) return;
  state.pokemon = button.dataset.pokemon;
  renderAll({ resetVisible: true, refreshTabs: true });
});

elements.grid.addEventListener("click", (event) => {
  const ownButton = event.target.closest("[data-toggle-owned]");
  if (ownButton) return toggleOwned(ownButton.dataset.toggleOwned);
  const viewButton = event.target.closest("[data-view-card]");
  if (viewButton) openCardDialog(viewButton.dataset.viewCard);
});

elements.search.addEventListener("input", () => { state.search = elements.search.value; renderAll({ resetVisible: true }); });
elements.rarity.addEventListener("change", () => { state.rarity = elements.rarity.value; renderAll({ resetVisible: true }); });
elements.sort.addEventListener("change", () => { state.sort = elements.sort.value; renderAll({ resetVisible: true }); });
elements.loadMore.addEventListener("click", () => { state.visible += PAGE_SIZE; renderCards(); });
document.querySelector("#export-button").addEventListener("click", exportProgress);
document.querySelector("#import-button").addEventListener("click", () => document.querySelector("#import-file").click());
document.querySelector("#import-file").addEventListener("change", (event) => { if (event.target.files[0]) importProgress(event.target.files[0]); event.target.value = ""; });
document.querySelector("#reset-button").addEventListener("click", () => {
  if (!state.owned.size) return showToast("Sua coleÃ§Ã£o jÃ¡ estÃ¡ zerada.");
  if (confirm("Remover todas as marcaÃ§Ãµes de cartas obtidas?")) { state.owned.clear(); saveOwned(); renderAll(); showToast("ColeÃ§Ã£o zerada."); }
});
document.querySelector(".dialog-close").addEventListener("click", () => elements.dialog.close());
elements.dialog.addEventListener("click", (event) => { if (event.target === elements.dialog) elements.dialog.close(); });
elements.dialogContent.addEventListener("click", (event) => { const button = event.target.closest("[data-dialog-toggle]"); if (button) toggleOwned(button.dataset.dialogToggle); });

async function initialize() {
  try {
    const response = await fetch("./data/cards.json");
    if (!response.ok) throw new Error(`Falha ${response.status}`);
    state.catalog = await response.json();
    const validIds = new Set(state.catalog.cards.map((card) => card.id));
    state.owned = new Set([...state.owned].filter((id) => validIds.has(id)));
    saveOwned();
    elements.loading.hidden = true;
    document.querySelector("#extra-count").textContent = state.catalog.meta.checklistEntries.japaneseExtras;
    document.querySelector("#international-count").textContent = state.catalog.meta.checklistEntries.international;
    const updated = new Date(state.catalog.meta.generatedAt);
    document.querySelector("#updated-at").textContent = `CatÃ¡logo atualizado em ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(updated)}`;
    renderPokemonTabs();
    renderRarities();
    renderAll();
  } catch (error) {
    elements.loading.innerHTML = '<p>NÃ£o foi possÃ­vel carregar o catÃ¡logo. Atualize a pÃ¡gina para tentar novamente.</p>';
    console.error(error);
  }
}

initialize();

