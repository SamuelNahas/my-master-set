import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, app, catalog] = await Promise.all([
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../app.js", import.meta.url), "utf8"),
  readFile(new URL("../data/cards.json", import.meta.url), "utf8").then(JSON.parse),
]);

test("a página oferece os controles principais da coleção", () => {
  for (const marker of ["pokemon-tabs", "rarity-filter", "search-input", "stat-missing", "data-language=\"Japonês\"", "import-file"]) {
    assert.match(html, new RegExp(marker));
  }
  assert.match(app, /localStorage/);
  assert.match(app, /data-toggle-owned/);
});

test("o catálogo tem registros únicos e completos", () => {
  assert.equal(catalog.cards.length, catalog.meta.checklistEntries.total);
  assert.equal(new Set(catalog.cards.map((card) => card.id)).size, catalog.cards.length);
  assert.equal(catalog.pokemon.length, 9);
  for (const card of catalog.cards) {
    assert.ok(card.id && card.name && card.set && card.language && card.rarity && card.variant);
    assert.ok(["PT-BR", "Japonês"].includes(card.language));
  }
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
