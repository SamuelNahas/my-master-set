import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, app, styles, catalog] = await Promise.all([
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../app.js", import.meta.url), "utf8"),
  readFile(new URL("../styles.css", import.meta.url), "utf8"),
  readFile(new URL("../data/cards.json", import.meta.url), "utf8").then(JSON.parse),
]);

test("a página oferece os controles principais da coleção", () => {
  for (const marker of ["pokemon-tabs", "rarity-filter", "search-input", "stat-missing", "data-language=\"Principal\"", "data-language=\"Internacional\"", "data-language=\"Japonês\"", "import-file", "image-export-button", "export-dialog", "export-all-images"]) {
    assert.match(html, new RegExp(marker));
  }
  assert.match(app, /localStorage/);
  assert.match(app, /data-toggle-owned/);
  assert.match(styles, /\[hidden\]\s*\{\s*display:none!important;/);
});

test("a exportação cria uma lista PNG por Pokémon e um pacote ZIP", () => {
  for (const marker of ["createPokemonExportCanvas", "createPokemonExport", "exportOnePokemon", "exportAllPokemon", "createZip", "application/zip", "image/png", "data-export-pokemon"]) {
    assert.match(app, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(app, /state\.catalog\.pokemon\.entries\(\)/);
  assert.match(app, /card\.language === group\.language/);
  assert.match(app, /state\.owned\.has\(card\.id\)/);
});

test("os textos permanecem em UTF-8 sem caracteres corrompidos", () => {
  const text = `${html}\n${app}\n${JSON.stringify(catalog)}`;
  assert.doesNotMatch(text, /PortuguÃ|coleÃ|PokÃ|JaponÃ|ImpressÃ|HistÃ|â€”|â†|âœ|ðŸ/);
});

test("o catálogo tem registros únicos e completos", () => {
  assert.equal(catalog.cards.length, catalog.meta.checklistEntries.total);
  assert.equal(new Set(catalog.cards.map((card) => card.id)).size, catalog.cards.length);
  assert.equal(catalog.pokemon.length, 9);
  for (const card of catalog.cards) {
    assert.ok(card.id && card.name && card.set && card.language && card.rarity && card.variant);
    assert.ok(["PT-BR", "Internacional", "Japonês"].includes(card.language));
    assert.ok(card.image && card.imageHigh, `${card.id} precisa ter imagem`);
  }
});

test("a cobertura internacional inclui a era Diamante & Pérola", () => {
  const international = catalog.cards.filter((card) => card.language === "Internacional");
  assert.equal(international.length, catalog.meta.checklistEntries.international);
  assert.ok(international.some((card) => card.cardId === "dp1-70" && card.pokemon === "bidoof"));
  assert.ok(international.some((card) => card.cardId === "tk7a-12" && card.pokemon === "bidoof"));
  const bidoofPrintings = new Set(catalog.cards.filter((card) => card.pokemon === "bidoof" && card.language !== "Japonês").map((card) => card.cardId));
  assert.equal(bidoofPrintings.size, 17);
});

test("a aba extra contém apenas registros japoneses justificados", () => {
  const extras = catalog.cards.filter((card) => card.language === "Japonês");
  assert.equal(extras.length, catalog.meta.checklistEntries.japaneseExtras);
  assert.ok(extras.length > 0);
  assert.ok(extras.every((card) => card.extraReason));
});

test("Pokémon TCG Pocket não entra no escopo físico", () => {
  assert.ok(catalog.cards.every((card) => !/^(A\d|P-[A-Z]|PROMO-A)/i.test(card.setId)));
});
