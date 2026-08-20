import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, app, styles, catalog] = await Promise.all([
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../app.js", import.meta.url), "utf8"),
  readFile(new URL("../styles.css", import.meta.url), "utf8"),
  readFile(new URL("../data/cards.json", import.meta.url), "utf8").then(JSON.parse),
]);

test("a pÃ¡gina oferece os controles principais da coleÃ§Ã£o", () => {
  for (const marker of ["pokemon-tabs", "rarity-filter", "search-input", "stat-missing", "data-language=\"Internacional\"", "data-language=\"JaponÃªs\"", "import-file"]) {
    assert.match(html, new RegExp(marker));
  }
  assert.match(app, /localStorage/);
  assert.match(app, /data-toggle-owned/);
  assert.match(styles, /\[hidden\]\s*\{\s*display:none!important;/);
});

test("o catÃ¡logo tem registros Ãºnicos e completos", () => {
  assert.equal(catalog.cards.length, catalog.meta.checklistEntries.total);
  assert.equal(new Set(catalog.cards.map((card) => card.id)).size, catalog.cards.length);
  assert.equal(catalog.pokemon.length, 9);
  for (const card of catalog.cards) {
    assert.ok(card.id && card.name && card.set && card.language && card.rarity && card.variant);
    assert.ok(["PT-BR", "Internacional", "JaponÃªs"].includes(card.language));
    assert.ok(card.image && card.imageHigh, `${card.id} precisa ter imagem`);
  }
});

test("a cobertura internacional inclui a era Diamante & PÃ©rola", () => {
  const international = catalog.cards.filter((card) => card.language === "Internacional");
  assert.equal(international.length, catalog.meta.checklistEntries.international);
  assert.ok(international.some((card) => card.cardId === "dp1-70" && card.pokemon === "bidoof"));
});

test("a aba extra contÃ©m apenas registros japoneses justificados", () => {
  const extras = catalog.cards.filter((card) => card.language === "JaponÃªs");
  assert.equal(extras.length, catalog.meta.checklistEntries.japaneseExtras);
  assert.ok(extras.length > 0);
  assert.ok(extras.every((card) => card.extraReason));
});

test("PokÃ©mon TCG Pocket nÃ£o entra no escopo fÃ­sico", () => {
  assert.ok(catalog.cards.every((card) => !/^(A\d|P-[A-Z]|PROMO-A)/i.test(card.setId)));
});

