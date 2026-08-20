import { mkdir, writeFile } from "node:fs/promises";

const API = "https://api.tcgdex.net/v2";
const generatedAt = new Date().toISOString();

const species = [
  { id: "zorua", label: "Zorua", pt: /zorua/i, ja: /ゾロア/, dex: 570 },
  { id: "zoroark", label: "Zoroark", pt: /zoroark/i, ja: /ゾロアーク/, dex: 571 },
  { id: "zorua-hisui", label: "Zorua de Hisui", pt: /zorua de hisui/i, ja: /ヒスイゾロア/, dex: 570, hisui: true },
  { id: "zoroark-hisui", label: "Zoroark de Hisui", pt: /zoroark de hisui/i, ja: /ヒスイゾロアーク/, dex: 571, hisui: true },
  { id: "rowlet", label: "Rowlet", pt: /rowlet/i, ja: /モクロー/, dex: 722 },
  { id: "dartrix", label: "Dartrix", pt: /dartrix/i, ja: /フクスロー/, dex: 723 },
  { id: "decidueye", label: "Decidueye", pt: /decidueye/i, ja: /ジュナイパー/, dex: 724 },
  { id: "bidoof", label: "Bidoof", pt: /bidoof/i, ja: /ビッパ/, dex: 399 },
  { id: "bibarel", label: "Bibarel", pt: /bibarel/i, ja: /ビーダル/, dex: 400 },
];

const rarityAliases = new Map([
  ["comum", "common"], ["incomum", "uncommon"], ["rara", "rare"],
  ["rara holo", "rare holo"], ["holo rare", "rare holo"], ["rara secreta", "secret rare"], ["rare secreta", "secret rare"],
  ["ultra rara", "ultra rare"], ["ilustracao rara", "illustration rare"],
  ["ilustracao rara especial", "special illustration rare"],
  ["rara dupla", "double rare"], ["hiper rara", "hyper rare"],
  ["promo", "promo"], ["promocional", "promo"], ["rara radiante", "radiant rare"],
  ["raras incriveis", "amazing rare"], ["shiny rara", "shiny rare"],
  ["brilhante ultra rara", "shiny ultra rare"], ["mega hiper raro", "mega hyper rare"],
  ["rara preto e branco", "black white rare"],
  ["rara holo v", "holo rare v"], ["rara holo vmax", "holo rare vmax"],
  ["rara holo vstar", "holo rare vstar"], ["rara holo v-astro", "holo rare vstar"],
]);

function normalizeText(value = "") {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

function normalizeRarity(value = "") {
  const normalized = normalizeText(value);
  return rarityAliases.get(normalized) ?? normalized;
}

function identifySpecies(card, language) {
  const name = card.name ?? "";
  if (language === "pt") {
    const hisui = species.find((item) => item.hisui && item.pt.test(name));
    if (hisui) return hisui;
    return species.find((item) => !item.hisui && item.pt.test(name));
  }
  if (/ヒスイゾロアーク/.test(name)) return species.find((item) => item.id === "zoroark-hisui");
  if (/ヒスイゾロア/.test(name)) return species.find((item) => item.id === "zorua-hisui");
  if (/ゾロアーク/.test(name)) return species.find((item) => item.id === "zoroark");
  if (/ゾロア/.test(name)) return species.find((item) => item.id === "zorua");
  return species.find((item) => !item.hisui && item.ja.test(name));
}

function isPocketCard(card) {
  const setId = card.set?.id ?? card.id?.split("-")[0] ?? "";
  return /^(A\d|P-[A-Z]|PROMO-A)/i.test(setId);
}

function mechanicsFingerprint(card, speciesId) {
  const attacks = (card.attacks ?? []).map((attack) => ({
    cost: (attack.cost ?? []).length,
    damage: String(attack.damage ?? ""),
  }));
  return JSON.stringify({
    speciesId,
    illustrator: normalizeText(card.illustrator),
    hp: card.hp ?? null,
    attacks,
    abilities: (card.abilities ?? []).length,
  });
}

function fallbackVariants(card) {
  const variants = card.variants ?? {};
  const rows = [];
  if (variants.normal) rows.push({ type: "normal", size: "standard" });
  if (variants.holo) rows.push({ type: "holo", size: "standard" });
  if (variants.reverse) rows.push({ type: "reverse", size: "standard" });
  if (variants.firstEdition) rows.push({ type: "normal", size: "standard", stamp: ["1st-edition"] });
  if (variants.preRelease) rows.push({ type: "normal", size: "standard", stamp: ["pre-release"] });
  if (variants.wPromo) rows.push({ type: "normal", size: "standard", stamp: ["w-promo"] });
  if (variants.jumbo) rows.push({ type: "normal", size: "jumbo" });
  return rows.length ? rows : [{ type: "normal", size: "standard" }];
}

function variantsOf(card) {
  return Array.isArray(card.variants_detailed) && card.variants_detailed.length
    ? card.variants_detailed
    : fallbackVariants(card);
}

function variantLabel(variant, language) {
  const parts = [variant.type ?? (language === "pt" ? "Normal" : "normal")];
  if (variant.subtype) parts.push(variant.subtype);
  if (variant.foil) parts.push(`foil ${variant.foil}`);
  if (variant.stamp?.length) parts.push(`selo ${variant.stamp.join(", ")}`);
  if (normalizeText(variant.size) === "jumbo") parts.push("jumbo");
  return parts.join(" · ");
}

async function getJson(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const response = await fetch(url, { headers: { "user-agent": "my-master-set/1.0" } });
    if (response.ok) return response.json();
    if (attempt === retries) throw new Error(`${response.status} ao acessar ${url}`);
    await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
  }
}

async function mapLimit(items, limit, mapper) {
  const output = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      output[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return output;
}

async function fetchCards(language) {
  const briefCards = await getJson(`${API}/${language}/cards`);
  const candidates = briefCards.filter((card) => identifySpecies(card, language));
  const details = await mapLimit(candidates, 10, (card) => getJson(`${API}/${language}/cards/${encodeURIComponent(card.id)}`));
  return details.filter((card) => normalizeText(card?.category) === "pokemon" && !isPocketCard(card) && identifySpecies(card, language));
}

function baseRecord(card, language, pokemon, variant, extraReason = null, fallbackImage = null) {
  const variantKey = [variant.type, variant.subtype, variant.foil, variant.size, ...(variant.stamp ?? [])].filter(Boolean).join("-");
  const imageBase = card.image ?? fallbackImage;
  return {
    id: `${language}-${card.id}-${variantKey || "normal"}`,
    cardId: card.id,
    pokemon: pokemon.id,
    pokemonLabel: pokemon.label,
    name: card.name,
    set: card.set?.name ?? "Coleção não informada",
    setId: card.set?.id ?? "",
    number: card.localId ?? "",
    language: language === "pt" ? "PT-BR" : "Japonês",
    rarity: card.rarity && card.rarity !== "None" ? card.rarity : "Não informada",
    variant: variantLabel(variant, language),
    foil: variant.foil ?? null,
    image: imageBase ? `${imageBase}/low.webp` : null,
    imageHigh: imageBase ? `${imageBase}/high.webp` : null,
    imageLanguage: card.image ? (language === "pt" ? "PT-BR" : "Japonês") : fallbackImage ? "Inglês (referência visual)" : null,
    illustrator: card.illustrator ?? null,
    releaseDate: card.set?.releaseDate ?? null,
    extraReason,
  };
}

const [ptCards, jaCards, enBriefCards] = await Promise.all([
  fetchCards("pt"),
  fetchCards("ja"),
  getJson(`${API}/en/cards`),
]);
const englishImages = new Map(enBriefCards.filter((card) => card.image).map((card) => [card.id, card.image]));

const ptByFingerprint = new Map();
for (const card of ptCards) {
  const pokemon = identifySpecies(card, "pt");
  const key = mechanicsFingerprint(card, pokemon.id);
  if (!ptByFingerprint.has(key)) ptByFingerprint.set(key, []);
  ptByFingerprint.get(key).push(card);
}

const primary = ptCards.flatMap((card) => {
  const pokemon = identifySpecies(card, "pt");
  return variantsOf(card).map((variant) => baseRecord(card, "pt", pokemon, variant, null, englishImages.get(card.id) ?? null));
});

const extras = [];
for (const card of jaCards) {
  const pokemon = identifySpecies(card, "ja");
  const matches = ptByFingerprint.get(mechanicsFingerprint(card, pokemon.id)) ?? [];
  const ptVariantSignatures = new Set(matches.flatMap((match) => variantsOf(match).map((variant) => `${normalizeText(variant.type)}|${normalizeText(variant.subtype)}|${normalizeText(variant.foil)}|${normalizeText(variant.size)}`)));
  const sameRarity = matches.some((match) => normalizeRarity(match.rarity) === normalizeRarity(card.rarity));
  const cardIsExclusive = matches.length === 0;
  const japaneseRarity = normalizeRarity(card.rarity);
  const rarityChanged = !cardIsExclusive && Boolean(japaneseRarity) && japaneseRarity !== "none" && !sameRarity;

  for (const variant of variantsOf(card)) {
    const signature = `${normalizeText(variant.type)}|${normalizeText(variant.subtype)}|${normalizeText(variant.foil)}|${normalizeText(variant.size)}`;
    const exclusiveFoil = Boolean(variant.foil) && !ptVariantSignatures.has(signature);
    if (!cardIsExclusive && !rarityChanged && !exclusiveFoil) continue;
    const reason = cardIsExclusive
      ? "Sem versão equivalente em português"
      : exclusiveFoil
        ? `Foil ${variant.foil} exclusivo da edição japonesa`
        : "Raridade diferente da versão em português";
    extras.push(baseRecord(card, "ja", pokemon, variant, reason));
  }
}

const cards = [...primary, ...extras].sort((a, b) => (
  a.language.localeCompare(b.language, "pt-BR") ||
  a.pokemonLabel.localeCompare(b.pokemonLabel, "pt-BR") ||
  a.set.localeCompare(b.set, "pt-BR", { numeric: true }) ||
  String(a.number).localeCompare(String(b.number), "pt-BR", { numeric: true }) ||
  a.variant.localeCompare(b.variant, "pt-BR")
));

const catalog = {
  meta: {
    generatedAt,
    source: "TCGdex",
    sourceUrl: "https://tcgdex.net",
    primaryLanguage: "Português (base TCGdex pt, exibida como PT-BR)",
    scope: "Pokémon TCG físico; Pokémon TCG Pocket não incluído",
    cardPrintings: { portuguese: ptCards.length, japaneseChecked: jaCards.length },
    checklistEntries: { portuguese: primary.length, japaneseExtras: extras.length, total: cards.length },
  },
  pokemon: species.map(({ id, label }) => ({ id, label })),
  cards,
};

await mkdir("data", { recursive: true });
const json = `${JSON.stringify(catalog, null, 2)}\n`;
await writeFile("data/cards.json", json, "utf8");

console.log(JSON.stringify(catalog.meta, null, 2));
