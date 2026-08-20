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
  exportDialog: document.querySelector("#export-dialog"),
  exportPokemonList: document.querySelector("#export-pokemon-list"),
  exportStatus: document.querySelector("#export-status"),
  toast: document.querySelector("#toast"),
};

const state = {
  catalog: null,
  owned: loadOwned(),
  language: "Principal",
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
  const label = card.imageLanguage.startsWith("PT-BR") ? "PT" : card.imageLanguage.startsWith("Inglês") ? "EN" : "REF";
  return `<span class="image-ref">IMAGEM ${label}</span>`;
}

function cardInSelectedLanguage(card) {
  if (state.language === "Principal") return card.language === "PT-BR" || card.language === "Internacional";
  return card.language === state.language;
}

function filteredCards() {
  if (!state.catalog) return [];
  const query = normalize(state.search.trim());
  const cards = state.catalog.cards.filter((card) => {
    if (!cardInSelectedLanguage(card)) return false;
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
    ? `<img src="${escapeHtml(card.image)}" alt="Carta ${escapeHtml(card.name)} da coleção ${escapeHtml(card.set)}" loading="lazy" decoding="async"><span class="image-placeholder" hidden><b>?</b><span>Imagem ainda não disponível</span></span>`
    : `<span class="image-placeholder"><b>?</b><span>Imagem ainda não disponível</span></span>`;
  return `
    <article class="tcg-card${owned ? " is-owned" : ""}" data-card-id="${escapeHtml(card.id)}">
      <button class="card-image-wrap" type="button" data-view-card="${escapeHtml(card.id)}" aria-label="Ver detalhes de ${escapeHtml(card.name)}">
        ${image}
        <span class="language">${escapeHtml(card.language)}</span>
        ${imageReferenceBadge(card)}
        ${owned ? '<span class="owned-label">✓ NA COLEÇÃO</span>' : ""}
        ${card.extraReason ? '<span class="extra-label">EXTRA JP</span>' : ""}
        ${card.sourceNote ? '<span class="extra-label history-label">HISTÓRICO</span>' : ""}
      </button>
      <div class="card-info">
        <p>${escapeHtml(card.set)} <span>#${escapeHtml(card.number)}</span></p>
        <h3>${escapeHtml(card.name)}</h3>
        <div class="card-details"><span class="rarity">◆ ${escapeHtml(card.rarity)}<br>${escapeHtml(card.variant)}</span><button class="own-button" type="button" data-toggle-owned="${escapeHtml(card.id)}" aria-label="${owned ? "Remover" : "Marcar"} ${escapeHtml(card.name)} ${owned ? "da" : "na"} coleção">${owned ? "✓" : "+"}</button></div>
        ${card.extraReason ? `<p class="extra-reason">${escapeHtml(card.extraReason)}</p>` : ""}
        ${card.sourceNote ? `<p class="extra-reason">${escapeHtml(card.sourceNote)}</p>` : ""}
      </div>
    </article>`;
}

function renderPokemonTabs() {
  const cards = state.catalog.cards.filter(cardInSelectedLanguage);
  const tabs = [{ id: "all", label: "Todos" }, ...state.catalog.pokemon];
  elements.pokemonTabs.innerHTML = tabs.map((pokemon) => {
    const count = pokemon.id === "all" ? cards.length : cards.filter((card) => card.pokemon === pokemon.id).length;
    const active = state.pokemon === pokemon.id;
    return `<button class="${active ? "active" : ""}" type="button" data-pokemon="${pokemon.id}" aria-pressed="${active}">${escapeHtml(pokemon.label)} <span class="tab-count">${count}</span></button>`;
  }).join("");
}

function renderRarities() {
  const rarities = [...new Set(state.catalog.cards.filter(cardInSelectedLanguage).map((card) => card.rarity))].sort(collator.compare);
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
  document.querySelector("#owned-total").textContent = `${owned} na coleção`;
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
    "Principal": ["Todas as cartas", "FICHÁRIO COMPLETO"],
    "Internacional": ["Histórico internacional", "EDIÇÕES AUSENTES NA BASE PT-BR"],
    "Japonês": ["Extras japoneses", "EDIÇÕES JAPONESAS"],
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
    showToast(`${card.name} entrou na sua coleção!`);
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
    ? `<img src="${escapeHtml(card.imageHigh)}" alt="Carta ${escapeHtml(card.name)} em alta resolução">`
    : '<span class="image-placeholder"><b>?</b><span>Imagem ainda não disponível</span></span>';
  elements.dialogContent.innerHTML = `
    <div class="dialog-layout">
      <div class="dialog-image">${image}</div>
      <div class="dialog-copy">
        <p class="eyebrow">${escapeHtml(card.language)} · ${escapeHtml(card.pokemonLabel)}</p>
        <h2 id="dialog-title">${escapeHtml(card.name)}</h2>
        <dl>
          <div><dt>Coleção</dt><dd>${escapeHtml(card.set)}</dd></div>
          <div><dt>Número</dt><dd>#${escapeHtml(card.number)}</dd></div>
          <div><dt>Raridade</dt><dd>${escapeHtml(card.rarity)}</dd></div>
          <div><dt>Variante</dt><dd>${escapeHtml(card.variant)}</dd></div>
          ${card.imageLanguage && card.imageLanguage !== card.language ? `<div><dt>Imagem</dt><dd>Scan em ${escapeHtml(card.imageLanguage.replace(" (referência visual)", ""))} usado como referência visual.</dd></div>` : ""}
          ${card.illustrator ? `<div><dt>Ilustrador</dt><dd>${escapeHtml(card.illustrator)}</dd></div>` : ""}
          ${card.extraReason ? `<div><dt>Por que é extra?</dt><dd>${escapeHtml(card.extraReason)}</dd></div>` : ""}
          ${card.sourceNote ? `<div><dt>Por que está no histórico?</dt><dd>${escapeHtml(card.sourceNote)}</dd></div>` : ""}
        </dl>
        <button class="dialog-action${owned ? " owned" : ""}" type="button" data-dialog-toggle="${escapeHtml(id)}">${owned ? "✓ Está na minha coleção" : "+ Marcar como obtida"}</button>
      </div>
    </div>`;
  if (!elements.dialog.open) elements.dialog.showModal();
  elements.dialogContent.querySelector("img")?.addEventListener("error", (event) => {
    event.currentTarget.parentElement.innerHTML = '<span class="image-placeholder"><b>?</b><span>Imagem ainda não disponível</span></span>';
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
  showToast("Backup da coleção exportado.");
}

function exportCardsForPokemon(pokemonId) {
  const languageOrder = { "PT-BR": 0, "Internacional": 1, "Japonês": 2 };
  return state.catalog.cards
    .filter((card) => card.pokemon === pokemonId)
    .sort((a, b) => languageOrder[a.language] - languageOrder[b.language]
      || collator.compare(a.set, b.set)
      || collator.compare(a.number, b.number)
      || collator.compare(a.variant, b.variant));
}

function exportFileSlug(value) {
  return normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function fitCanvasText(context, value, maxWidth) {
  const text = String(value);
  if (context.measureText(text).width <= maxWidth) return text;
  let shortened = text;
  while (shortened.length > 1 && context.measureText(`${shortened}…`).width > maxWidth) shortened = shortened.slice(0, -1);
  return `${shortened}…`;
}

function exportGroups(cards) {
  return [
    { language: "PT-BR", label: "PORTUGUÊS BR" },
    { language: "Internacional", label: "HISTÓRICO INTERNACIONAL" },
    { language: "Japonês", label: "EXTRA JAPONÊS" },
  ].map((group) => ({ ...group, cards: cards.filter((card) => card.language === group.language) }))
    .filter((group) => group.cards.length);
}

function distributeExportGroups(groups, columnCount) {
  const columns = Array.from({ length: columnCount }, () => ({ groups: [], rows: 0 }));
  groups.forEach((group) => {
    const target = columns.reduce((best, column) => column.rows < best.rows ? column : best, columns[0]);
    target.groups.push(group);
    target.rows += group.cards.length + 0.75;
  });
  return columns;
}

function drawExportCheckbox(context, x, y, owned) {
  context.lineWidth = 3;
  context.strokeStyle = owned ? "#2e7153" : "#bb4a42";
  context.fillStyle = owned ? "#2e7153" : "#f4f0e7";
  context.fillRect(x, y, 28, 28);
  context.strokeRect(x, y, 28, 28);
  if (!owned) return;
  context.strokeStyle = "#ffffff";
  context.lineWidth = 3;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(x + 7, y + 14);
  context.lineTo(x + 12, y + 20);
  context.lineTo(x + 22, y + 8);
  context.stroke();
}

function createPokemonExportCanvas(pokemon) {
  const cards = exportCardsForPokemon(pokemon.id);
  const ownedCount = cards.filter((card) => state.owned.has(card.id)).length;
  const missingCount = cards.length - ownedCount;
  const progress = percentage(ownedCount, cards.length);
  const groups = exportGroups(cards);
  const columnCount = cards.length > 32 ? 2 : 1;
  const columns = distributeExportGroups(groups, columnCount);
  const rowHeight = 70;
  const groupHeight = 54;
  const tallestContent = Math.max(...columns.map((column) => column.groups.reduce((height, group) => height + groupHeight + group.cards.length * rowHeight, 0)));
  const width = 1600;
  const headerHeight = 360;
  const footerHeight = 96;
  const height = headerHeight + tallestContent + footerHeight;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  context.fillStyle = "#f4f0e7";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#171c24";
  context.fillRect(0, 0, width, 288);
  context.fillStyle = "#db3f35";
  context.fillRect(width - 34, 0, 34, 288);

  context.fillStyle = "#db3f35";
  context.font = "700 24px Arial, sans-serif";
  context.letterSpacing = "5px";
  context.fillText("MASTER SET · POKÉMON TCG", 88, 76);
  context.letterSpacing = "0px";
  context.fillStyle = "#ffffff";
  context.font = "400 76px Georgia, serif";
  context.fillText(fitCanvasText(context, pokemon.label, 870), 88, 170);
  context.fillStyle = "#aeb0b1";
  context.font = "400 23px Arial, sans-serif";
  context.fillText("Lista completa de impressões e variantes", 91, 215);

  const summaryX = 1030;
  context.fillStyle = "#aeb0b1";
  context.font = "700 18px Arial, sans-serif";
  context.fillText("PROGRESSO", summaryX, 72);
  context.fillStyle = "#ffffff";
  context.font = "400 64px Georgia, serif";
  context.fillText(progress, summaryX, 142);
  context.font = "700 19px Arial, sans-serif";
  context.fillText(`${ownedCount} tenho`, summaryX, 194);
  context.fillStyle = "#aeb0b1";
  context.fillText(`·  ${missingCount} faltam  ·  ${cards.length} total`, summaryX + 108, 194);
  context.fillStyle = "#424750";
  context.fillRect(summaryX, 226, 420, 8);
  context.fillStyle = "#db3f35";
  context.fillRect(summaryX, 226, 420 * (ownedCount / Math.max(cards.length, 1)), 8);

  context.fillStyle = "#e7dfd2";
  context.fillRect(0, 288, width, 72);
  context.fillStyle = "#5f615f";
  context.font = "700 18px Arial, sans-serif";
  context.fillText("✓ TENHO", 88, 333);
  context.fillStyle = "#2e7153";
  context.fillRect(62, 315, 14, 14);
  context.fillStyle = "#5f615f";
  context.fillText("□ FALTA", 235, 333);
  context.fillText("PT-BR · HISTÓRICO INTERNACIONAL · EXTRA JAPONÊS", 1010, 333);

  const margin = 88;
  const gap = 54;
  const columnWidth = columnCount === 2 ? (width - margin * 2 - gap) / 2 : width - margin * 2;
  columns.forEach((column, columnIndex) => {
    const x = margin + columnIndex * (columnWidth + gap);
    let y = headerHeight + 25;
    column.groups.forEach((group) => {
      context.fillStyle = "#db3f35";
      context.font = "700 19px Arial, sans-serif";
      context.fillText(`${group.label}  ·  ${group.cards.length}`, x, y + 24);
      context.fillStyle = "#d3cabb";
      context.fillRect(x, y + 39, columnWidth, 2);
      y += groupHeight;

      group.cards.forEach((card) => {
        const owned = state.owned.has(card.id);
        drawExportCheckbox(context, x, y + 6, owned);
        context.fillStyle = "#171c24";
        context.font = "700 20px Arial, sans-serif";
        const mainLine = `${card.set} · #${card.number}`;
        context.fillText(fitCanvasText(context, mainLine, columnWidth - 58), x + 48, y + 24);
        context.fillStyle = "#77756f";
        context.font = "400 17px Arial, sans-serif";
        const detailLine = `${card.variant} · ${card.rarity}`;
        context.fillText(fitCanvasText(context, detailLine, columnWidth - 58), x + 48, y + 50);
        context.fillStyle = "#ded6ca";
        context.fillRect(x, y + rowHeight - 2, columnWidth, 1);
        y += rowHeight;
      });
    });
  });

  context.fillStyle = "#171c24";
  context.fillRect(0, height - footerHeight, width, footerHeight);
  context.fillStyle = "#ffffff";
  context.font = "700 18px Arial, sans-serif";
  context.fillText("SAMUEL NAHAS · MASTER SET", 88, height - 40);
  context.fillStyle = "#aeb0b1";
  context.font = "400 16px Arial, sans-serif";
  const exportedDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date());
  context.fillText(`Exportado em ${exportedDate}`, 1215, height - 40);
  return canvas;
}

function canvasToPng(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Falha ao gerar PNG")), "image/png"));
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function createPokemonExport(pokemon) {
  return canvasToPng(createPokemonExportCanvas(pokemon));
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(bytes) {
  let crc = 0xffffffff;
  bytes.forEach((byte) => { crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8); });
  return (crc ^ 0xffffffff) >>> 0;
}

function zipDateTime(date = new Date()) {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    date: ((Math.max(date.getFullYear(), 1980) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

function joinByteArrays(parts) {
  const output = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  parts.forEach((part) => { output.set(part, offset); offset += part.length; });
  return output;
}

async function createZip(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;
  const stamp = zipDateTime();

  for (const file of files) {
    const name = encoder.encode(file.name);
    const bytes = new Uint8Array(await file.blob.arrayBuffer());
    const checksum = crc32(bytes);
    const localHeader = new Uint8Array(30 + name.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(10, stamp.time, true);
    localView.setUint16(12, stamp.date, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, bytes.length, true);
    localView.setUint32(22, bytes.length, true);
    localView.setUint16(26, name.length, true);
    localHeader.set(name, 30);
    localParts.push(localHeader, bytes);

    const centralHeader = new Uint8Array(46 + name.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(12, stamp.time, true);
    centralView.setUint16(14, stamp.date, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, bytes.length, true);
    centralView.setUint32(24, bytes.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint32(42, localOffset, true);
    centralHeader.set(name, 46);
    centralParts.push(centralHeader);
    localOffset += localHeader.length + bytes.length;
  }

  const centralDirectory = joinByteArrays(centralParts);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralDirectory.length, true);
  endView.setUint32(16, localOffset, true);
  return new Blob([...localParts, centralDirectory, end], { type: "application/zip" });
}

function renderExportPokemonList() {
  elements.exportPokemonList.innerHTML = state.catalog.pokemon.map((pokemon) => {
    const cards = exportCardsForPokemon(pokemon.id);
    const owned = cards.filter((card) => state.owned.has(card.id)).length;
    return `<div class="export-pokemon-row"><div><strong>${escapeHtml(pokemon.label)}</strong><span>${owned} de ${cards.length} variantes · ${percentage(owned, cards.length)}</span></div><button type="button" data-export-pokemon="${escapeHtml(pokemon.id)}">Baixar PNG</button></div>`;
  }).join("");
}

function openExportDialog() {
  renderExportPokemonList();
  elements.exportStatus.textContent = "";
  elements.exportDialog.showModal();
}

async function exportOnePokemon(pokemonId, button) {
  const pokemon = state.catalog.pokemon.find((item) => item.id === pokemonId);
  if (!pokemon) return;
  const previousText = button.textContent;
  button.disabled = true;
  button.textContent = "Gerando…";
  try {
    const blob = await createPokemonExport(pokemon);
    downloadBlob(blob, `master-set-${exportFileSlug(pokemon.label)}.png`);
    showToast(`Lista de ${pokemon.label} exportada.`);
  } catch (error) {
    console.error(error);
    showToast("Não foi possível gerar essa imagem.");
  } finally {
    button.disabled = false;
    button.textContent = previousText;
  }
}

async function exportAllPokemon() {
  const button = document.querySelector("#export-all-images");
  button.disabled = true;
  try {
    const files = [];
    for (const [index, pokemon] of state.catalog.pokemon.entries()) {
      elements.exportStatus.textContent = `Gerando imagem ${index + 1} de ${state.catalog.pokemon.length}: ${pokemon.label}…`;
      const blob = await createPokemonExport(pokemon);
      files.push({ name: `master-set-${exportFileSlug(pokemon.label)}.png`, blob });
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    elements.exportStatus.textContent = "Preparando o pacote…";
    const zip = await createZip(files);
    downloadBlob(zip, `master-set-listas-${new Date().toISOString().slice(0, 10)}.zip`);
    elements.exportStatus.textContent = "Pronto: as 9 imagens foram baixadas.";
    showToast("Pacote com as 9 listas exportado.");
  } catch (error) {
    console.error(error);
    elements.exportStatus.textContent = "Não foi possível gerar o pacote. Tente baixar as imagens individualmente.";
  } finally {
    button.disabled = false;
  }
}

async function importProgress(file) {
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.owned)) throw new Error("Formato inválido");
    const validIds = new Set(state.catalog.cards.map((card) => card.id));
    state.owned = new Set(data.owned.filter((id) => validIds.has(id)));
    saveOwned();
    renderAll();
    showToast(`${state.owned.size} cartas restauradas do backup.`);
  } catch {
    showToast("Não foi possível importar esse arquivo.");
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
document.querySelector("#image-export-button").addEventListener("click", openExportDialog);
document.querySelector("#export-button").addEventListener("click", exportProgress);
document.querySelector("#export-all-images").addEventListener("click", exportAllPokemon);
elements.exportPokemonList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-export-pokemon]");
  if (button) exportOnePokemon(button.dataset.exportPokemon, button);
});
document.querySelector("#import-button").addEventListener("click", () => document.querySelector("#import-file").click());
document.querySelector("#import-file").addEventListener("change", (event) => { if (event.target.files[0]) importProgress(event.target.files[0]); event.target.value = ""; });
document.querySelector("#reset-button").addEventListener("click", () => {
  if (!state.owned.size) return showToast("Sua coleção já está zerada.");
  if (confirm("Remover todas as marcações de cartas obtidas?")) { state.owned.clear(); saveOwned(); renderAll(); showToast("Coleção zerada."); }
});
document.querySelector(".dialog-close").addEventListener("click", () => elements.dialog.close());
elements.dialog.addEventListener("click", (event) => { if (event.target === elements.dialog) elements.dialog.close(); });
elements.dialogContent.addEventListener("click", (event) => { const button = event.target.closest("[data-dialog-toggle]"); if (button) toggleOwned(button.dataset.dialogToggle); });
elements.exportDialog.querySelector(".dialog-close").addEventListener("click", () => elements.exportDialog.close());
elements.exportDialog.addEventListener("click", (event) => { if (event.target === elements.exportDialog) elements.exportDialog.close(); });

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
    document.querySelector("#updated-at").textContent = `Catálogo atualizado em ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(updated)}`;
    renderPokemonTabs();
    renderRarities();
    renderAll();
  } catch (error) {
    elements.loading.innerHTML = '<p>Não foi possível carregar o catálogo. Atualize a página para tentar novamente.</p>';
    console.error(error);
  }
}

initialize();
