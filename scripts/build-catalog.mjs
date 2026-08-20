import { mkdir, writeFile } from "node:fs/promises";

const API = "https://api.tcgdex.net/v2";
const POKEMON_TCG_API = "https://api.pokemontcg.io/v2";
const generatedAt = new Date().toISOString();

const species = [
  { id: "zorua", label: "Zorua", pt: /zorua/i, en: /zorua/i, ja: /ã‚¾ãƒ­ã‚¢/, dex: 570 },
  { id: "zoroark", label: "Zoroark", pt: /zoroark/i, en: /zoroark/i, ja: /ã‚¾ãƒ­ã‚¢ãƒ¼ã‚¯/, dex: 571 },
  { id: "zorua-hisui", label: "Zorua de Hisui", pt: /zorua de hisui/i, en: /hisuian zorua/i, ja: /ãƒ’ã‚¹ã‚¤ã‚¾ãƒ­ã‚¢/, dex: 570, hisui: true },
  { id: "zoroark-hisui", label: "Zoroark de Hisui", pt: /zoroark de hisui/i, en: /hisuian zoroark/i, ja: /ãƒ’ã‚¹ã‚¤ã‚¾ãƒ­ã‚¢ãƒ¼ã‚¯/, dex: 571, hisui: true },
  { id: "rowlet", label: "Rowlet", pt: /rowlet/i, en: /rowlet/i, ja: /ãƒ¢ã‚¯ãƒ­ãƒ¼/, dex: 722 },
  { id: "dartrix", label: "Dartrix", pt: /dartrix/i, en: /dartrix/i, ja: /ãƒ•ã‚¯ã‚¹ãƒ­ãƒ¼/, dex: 723 },
  { id: "decidueye", label: "Decidueye", pt: /decidueye/i, en: /decidueye/i, ja: /ã‚¸ãƒ¥ãƒŠã‚¤ãƒ‘ãƒ¼/, dex: 724 },
  { id: "bidoof", label: "Bidoof", pt: /bidoof/i, en: /bidoof/i, ja: /ãƒ“ãƒƒãƒ‘/, dex: 399 },
  { id: "bibarel", label: "Bibarel", pt: /bibarel/i, en: /bibarel/i, ja: /ãƒ“ãƒ¼ãƒ€ãƒ«/, dex: 400 },
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
  if (language === "pt" || language === "en") {
    const pattern = language === "pt" ? "pt" : "en";
    const hisui = species.find((item) => item.hisui && item[pattern].test(name));
    if (hisui) return hisui;
    return species.find((item) => !item.hisui && item[pattern].test(name));
  }
  if (/ãƒ’ã‚¹ã‚¤ã‚¾ãƒ­ã‚¢ãƒ¼ã‚¯/.test(name)) return species.find((item) => item.id === "zoroark-hisui");
  if (/ãƒ’ã‚¹ã‚¤ã‚¾ãƒ­ã‚¢/.test(name)) return species.find((item) => item.id === "zorua-hisui");
  if (/ã‚¾ãƒ­ã‚¢ãƒ¼ã‚¯/.test(name)) return species.find((item) => item.id === "zoroark");
  if (/ã‚¾ãƒ­ã‚¢/.test(name)) return species.find((item) => item.id === "zorua");
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
    illustrator: normalizeText(card.illustrator ?? card.artist),
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
  return parts.join(" Â· ");
}

async function getJson(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const response = await fetch(url, { headers: { "user-agent": "my-master-set/1.0" } });
    if (response.ok) return response.json();
    if (attempt === retries) throw new Error(`${response.status} ao acessar ${url}`);
    await new Promise((resolve) => setTimeout(resolve, Math.min(1000 * attempt, 5000)));
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

async function fetchPokemonTcgCards() {
  const queries = ["Zorua", "Zoroark", "Rowlet", "Dartrix", "Decidueye", "Bidoof", "Bibarel"];
  const pages = await mapLimit(queries, 1, async (name) => {
    const url = `${POKEMON_TCG_API}/cards?q=${encodeURIComponent(`name:${name}`)}&pageSize=250&orderBy=set.releaseDate,number`;
    return getJson(url, 8);
  });
  const unique = new Map();
  for (const card of pages.flatMap((page) => page.data ?? [])) {
    const pokemon = identifySpecies(card, "en");
    if (pokemon && normalizeText(card.supertype) === "pokemon") unique.set(card.id, card);
  }
  return [...unique.values()];
}

function normalizePrintingId(id = "") {
  const separator = id.indexOf("-");
  if (separator < 0) return normalizeText(id);
  let setId = id.slice(0, separator).toLowerCase();
  const localId = id.slice(separator + 1).toLowerCase();
  setId = setId.replace(/^swsh45/, "swsh4.5").replace(/pt5/g, ".5");
  return `${setId}-${localId}`;
}

function pokemonTcgVariants(card) {
  const mapping = {
    normal: { type: "normal", size: "standard" },
    holofoil: { type: "holo", size: "standard" },
    reverseHolofoil: { type: "reverse", size: "standard" },
    firstEditionNormal: { type: "normal", size: "standard", stamp: ["1st edition"] },
    firstEditionHolofoil: { type: "holo", size: "standard", stamp: ["1st edition"] },
    unlimited: { type: "normal", size: "standard", stamp: ["unlimited"] },
  };
  const variants = Object.keys(card.tcgplayer?.prices ?? {}).map((key) => mapping[key]).filter(Boolean);
  if (variants.length) return variants;
  return [{ type: normalizeText(card.rarity).includes("holo") ? "holo" : "normal", size: "standard" }];
}

function imageReference(card, language) {
  if (card.image) {
    return {
      low: `${card.image}/low.webp`,
      high: `${card.image}/high.webp`,
      language: language === "pt" ? "PT-BR" : language === "ja" ? "JaponÃªs" : "InglÃªs",
    };
  }
  if (card.images?.small) {
    return { low: card.images.small, high: card.images.large ?? card.images.small, language: "InglÃªs" };
  }
  return null;
}

const knownImageFallbacks = new Map([
  ["pt:mep-043", { low: "https://pkmncards.com/wp-content/uploads/mebsp_en_043_std.png", high: "https://pkmncards.com/wp-content/uploads/mebsp_en_043_std.png", language: "InglÃªs" }],
  ["ja:SM8b-162", { low: "https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpc/SM8b/SM8b_162_R_JP.png", high: "https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpc/SM8b/SM8b_162_R_JP.png", language: "JaponÃªs" }],
  ["ja:SM8b-163", { low: "https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpc/SM8b/SM8b_163_R_JP.png", high: "https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpc/SM8b/SM8b_163_R_JP.png", language: "JaponÃªs" }],
  ["ja:SM8b-185", { low: "https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpc/SM8b/SM8b_185_R_JP.png", high: "https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpc/SM8b/SM8b_185_R_JP.png", language: "JaponÃªs" }],
  ["ja:SM1p-059", { low: "https://images.pokemontcg.io/sm1/146.png", high: "https://images.pokemontcg.io/sm1/146_hires.png", language: "InglÃªs" }],
  ["ja:SM10b-063", { low: "https://images.pokemontcg.io/sm11/237.png", high: "https://images.pokemontcg.io/sm11/237_hires.png", language: "InglÃªs" }],
  ["ja:SM9a-066", { low: "https://images.pokemontcg.io/sm10/222.png", high: "https://images.pokemontcg.io/sm10/222_hires.png", language: "InglÃªs" }],
  ["ja:SM3p-081", { low: "https://images.pokemontcg.io/sm35/77.png", high: "https://images.pokemontcg.io/sm35/77_hires.png", language: "InglÃªs" }],
  ["ja:SV11W-059", { low: "https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpc/SV11W/SV11W_59_R_JP_LG.png", high: "https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpc/SV11W/SV11W_59_R_JP_LG.png", language: "JaponÃªs" }],
  ["ja:SV11W-141", { low: "https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpc/SV11W/SV11W_141_R_JP.png", high: "https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpc/SV11W/SV11W_141_R_JP.png", language: "JaponÃªs" }],
]);

function knownImageFallback(language, card) {
  return knownImageFallbacks.get(`${language}:${card.id}`) ?? null;
}

function baseRecord(card, language, pokemon, variant, extraReason = null, fallbackImage = null) {
  const variantKey = [variant.type, variant.subtype, variant.foil, variant.size, ...(variant.stamp ?? [])].filter(Boolean).join("-");
  const ownImage = imageReference(card, language);
  const resolvedImage = ownImage ?? fallbackImage;
  return {
    id: `${language}-${card.id}-${variantKey || "normal"}`,
    cardId: card.id,
    pokemon: pokemon.id,
    pokemonLabel: pokemon.label,
    name: card.name,
    set: card.set?.name ?? "ColeÃ§Ã£o nÃ£o informada",
    setId: card.set?.id ?? "",
    number: card.localId ?? "",
    language: language === "pt" ? "PT-BR" : "JaponÃªs",
    rarity: card.rarity && card.rarity !== "None" ? card.rarity : "NÃ£o informada",
    variant: variantLabel(variant, language),
    foil: variant.foil ?? null,
    image: resolvedImage?.low ?? null,
    imageHigh: resolvedImage?.high ?? null,
    imageLanguage: resolvedImage ? (ownImage ? resolvedImage.language : `${resolvedImage.language} (referÃªncia visual)`) : null,
    illustrator: card.illustrator ?? null,
    releaseDate: card.set?.releaseDate ?? null,
    extraReason,
  };
}

function internationalRecord(card, pokemon, variant) {
  const variantKey = [variant.type, variant.subtype, variant.foil, variant.size, ...(variant.stamp ?? [])].filter(Boolean).join("-");
  const image = imageReference(card, "en");
  return {
    id: `intl-${card.id}-${variantKey || "normal"}`,
    cardId: card.id,
    pokemon: pokemon.id,
    pokemonLabel: pokemon.label,
    name: card.name,
    set: card.set?.name ?? "ColeÃ§Ã£o nÃ£o informada",
    setId: card.set?.id ?? "",
    number: card.number ?? "",
    language: "Internacional",
    rarity: card.rarity ?? "NÃ£o informada",
    variant: variantLabel(variant, "en"),
    foil: variant.foil ?? null,
    image: image?.low ?? null,
    imageHigh: image?.high ?? null,
    imageLanguage: image?.language ?? null,
    illustrator: card.artist ?? null,
    releaseDate: card.set?.releaseDate ?? null,
    sourceNote: "ImpressÃ£o histÃ³rica nÃ£o encontrada na base PT-BR; referÃªncia internacional em inglÃªs.",
  };
}

const [ptCards, jaCards, internationalCards] = await Promise.all([
  fetchCards("pt"),
  fetchCards("ja"),
  fetchPokemonTcgCards(),
]);

const internationalByPrintingId = new Map(internationalCards.map((card) => [normalizePrintingId(card.id), card]));
const internationalByFingerprint = new Map();
for (const card of internationalCards) {
  const pokemon = identifySpecies(card, "en");
  const key = mechanicsFingerprint(card, pokemon.id);
  if (!internationalByFingerprint.has(key)) internationalByFingerprint.set(key, []);
  internationalByFingerprint.get(key).push(card);
}

const ptByFingerprint = new Map();
for (const card of ptCards) {
  const pokemon = identifySpecies(card, "pt");
  const key = mechanicsFingerprint(card, pokemon.id);
  if (!ptByFingerprint.has(key)) ptByFingerprint.set(key, []);
  ptByFingerprint.get(key).push(card);
}

const primary = ptCards.flatMap((card) => {
  const pokemon = identifySpecies(card, "pt");
  const samePrinting = internationalByPrintingId.get(normalizePrintingId(card.id));
  const sameCard = samePrinting ?? (internationalByFingerprint.get(mechanicsFingerprint(card, pokemon.id)) ?? []).find((candidate) => candidate.images?.small);
  const fallbackImage = knownImageFallback("pt", card) ?? (sameCard ? imageReference(sameCard, "en") : null);
  return variantsOf(card).map((variant) => baseRecord(card, "pt", pokemon, variant, null, fallbackImage));
});

const primaryImageByCardId = new Map();
for (const card of primary) {
  if (!card.image || primaryImageByCardId.has(card.cardId)) continue;
  primaryImageByCardId.set(card.cardId, {
    low: card.image,
    high: card.imageHigh,
    language: (card.imageLanguage ?? "PT-BR").replace(/ \(referÃªncia visual\)$/, ""),
  });
}

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
      ? "Sem versÃ£o equivalente em portuguÃªs"
      : exclusiveFoil
        ? `Foil ${variant.foil} exclusivo da ediÃ§Ã£o japonesa`
        : "Raridade diferente da versÃ£o em portuguÃªs";
    const internationalMatch = (internationalByFingerprint.get(mechanicsFingerprint(card, pokemon.id)) ?? []).find((candidate) => candidate.images?.small);
    const portugueseMatch = matches.map((match) => primaryImageByCardId.get(match.id)).find(Boolean);
    const fallbackImage = knownImageFallback("ja", card) ?? (internationalMatch ? imageReference(internationalMatch, "en") : portugueseMatch ?? null);
    extras.push(baseRecord(card, "ja", pokemon, variant, reason, fallbackImage));
  }
}

const ptPrintingIds = new Set(ptCards.map((card) => normalizePrintingId(card.id)));
const international = internationalCards
  .filter((card) => !ptPrintingIds.has(normalizePrintingId(card.id)))
  .flatMap((card) => {
    const pokemon = identifySpecies(card, "en");
    return pokemonTcgVariants(card).map((variant) => internationalRecord(card, pokemon, variant));
  });

const cards = [...primary, ...international, ...extras].sort((a, b) => (
  a.language.localeCompare(b.language, "pt-BR") ||
  a.pokemonLabel.localeCompare(b.pokemonLabel, "pt-BR") ||
  a.set.localeCompare(b.set, "pt-BR", { numeric: true }) ||
  String(a.number).localeCompare(String(b.number), "pt-BR", { numeric: true }) ||
  a.variant.localeCompare(b.variant, "pt-BR")
));

const catalog = {
  meta: {
    generatedAt,
    source: "TCGdex + PokÃ©mon TCG API",
    sourceUrl: "https://tcgdex.net",
    internationalSourceUrl: "https://pokemontcg.io",
    primaryLanguage: "PortuguÃªs (base TCGdex pt, exibida como PT-BR)",
    scope: "PokÃ©mon TCG fÃ­sico; PokÃ©mon TCG Pocket nÃ£o incluÃ­do",
    cardPrintings: { portuguese: ptCards.length, internationalChecked: internationalCards.length, japaneseChecked: jaCards.length },
    checklistEntries: { portuguese: primary.length, international: international.length, japaneseExtras: extras.length, total: cards.length },
  },
  pokemon: species.map(({ id, label }) => ({ id, label })),
  cards,
};

await mkdir("data", { recursive: true });
const json = `${JSON.stringify(catalog, null, 2)}\n`;
await writeFile("data/cards.json", json, "utf8");

console.log(JSON.stringify(catalog.meta, null, 2));

