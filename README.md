# Master Set Pokémon TCG

Checklist estático para acompanhar impressões e variantes em português, o histórico internacional ausente na base PT-BR e extras japoneses de:

- Zorua, Zoroark, Zorua de Hisui e Zoroark de Hisui
- Rowlet, Dartrix e Decidueye
- Bidoof e Bibarel

A visualização **Principal** combina PT-BR e histórico internacional, priorizando a edição brasileira quando ela existe. A aba **Histórico Internacional** permite ver somente as lacunas antigas da base portuguesa, incluindo cartas da era Diamante & Pérola. A aba **Extra Japonês** reúne cartas sem versão equivalente em português ou cuja raridade/foil muda na edição japonesa.

## O que o site faz

- separa o catálogo por Pokémon e idioma;
- mostra imagem, coleção, número, raridade e variante;
- permite marcar uma carta como obtida;
- filtra por todas, faltantes ou já adquiridas;
- exibe totais e percentuais da coleção;
- busca e filtra por raridade;
- salva o progresso no navegador;
- exporta e importa um backup em JSON;
- exporta uma lista PNG para cada Pokémon, individualmente ou em um pacote ZIP;
- publica automaticamente no GitHub Pages.

## Catálogo

Os dados vêm da [TCGdex](https://tcgdex.net), da [Pokémon TCG API](https://pokemontcg.io) e de auditorias complementares no [PkmnCards](https://pkmncards.com). O gerador mantém o PT-BR como catálogo principal, usa as bases internacionais para cobrir impressões históricas ausentes, exclui Pokémon TCG Pocket, expande as variantes e compara as versões japonesas por espécie, ilustrador e características da carta.

Para atualizar a base:

```bash
npm run catalog
```

O catálogo é uma ferramenta pessoal e não oficial. Quando um scan em PT-BR não está disponível, o site apresenta uma referência visual internacional claramente identificada.

## Uso local

Sirva a pasta com qualquer servidor estático. O site não precisa de API, conta ou banco de dados.

## GitHub Pages

O fluxo em `.github/workflows/pages.yml` publica o conteúdo automaticamente após cada envio para `main`. No repositório, configure **Settings → Pages → Source → GitHub Actions** na primeira publicação.
