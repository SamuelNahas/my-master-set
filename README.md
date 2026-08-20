# Master Set PokÃ©mon TCG

Checklist estÃ¡tico para acompanhar impressÃµes e variantes em portuguÃªs, o histÃ³rico internacional ausente na base PT-BR e extras japoneses de:

- Zorua, Zoroark, Zorua de Hisui e Zoroark de Hisui
- Rowlet, Dartrix e Decidueye
- Bidoof e Bibarel

A aba **HistÃ³rico Internacional** completa lacunas antigas da base portuguesa, incluindo cartas da era Diamante & PÃ©rola. A aba **Extra JaponÃªs** reÃºne cartas sem versÃ£o equivalente em portuguÃªs ou cuja raridade/foil muda na ediÃ§Ã£o japonesa, incluindo variantes PokÃ© Ball e Master Ball quando registradas na base.

## O que o site faz

- separa o catÃ¡logo por PokÃ©mon e idioma;
- mostra imagem, coleÃ§Ã£o, nÃºmero, raridade e variante;
- permite marcar uma carta como obtida;
- filtra por todas, faltantes ou jÃ¡ adquiridas;
- exibe totais e percentuais da coleÃ§Ã£o;
- busca e filtra por raridade;
- salva o progresso no navegador;
- exporta e importa um backup em JSON;
- publica automaticamente no GitHub Pages.

## CatÃ¡logo

Os dados vÃªm da [TCGdex](https://tcgdex.net) e da [PokÃ©mon TCG API](https://pokemontcg.io). O gerador mantÃ©m o PT-BR como catÃ¡logo principal, usa a base internacional para cobrir impressÃµes histÃ³ricas ausentes, exclui PokÃ©mon TCG Pocket, expande as variantes e compara as versÃµes japonesas por espÃ©cie, ilustrador e caracterÃ­sticas da carta.

Para atualizar a base:

```bash
npm run catalog
```

O catÃ¡logo Ã© uma ferramenta pessoal e nÃ£o oficial. Quando um scan em PT-BR nÃ£o estÃ¡ disponÃ­vel, o site apresenta uma referÃªncia visual internacional claramente identificada.

## Uso local

Sirva a pasta com qualquer servidor estÃ¡tico. O site nÃ£o precisa de API, conta ou banco de dados.

## GitHub Pages

O fluxo em `.github/workflows/pages.yml` publica o conteÃºdo automaticamente apÃ³s cada envio para `main`. No repositÃ³rio, configure **Settings â†’ Pages â†’ Source â†’ GitHub Actions** na primeira publicaÃ§Ã£o.

