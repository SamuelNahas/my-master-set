# Master Set Pokémon TCG

Checklist estático para acompanhar todas as impressões e variantes disponíveis em português de:

- Zorua, Zoroark, Zorua de Hisui e Zoroark de Hisui
- Rowlet, Dartrix e Decidueye
- Bidoof e Bibarel

A aba **Extra Japonês** reúne cartas sem versão equivalente em português ou cuja raridade/foil muda na edição japonesa, incluindo variantes Poké Ball e Master Ball quando registradas na base.

## O que o site faz

- separa o catálogo por Pokémon e idioma;
- mostra imagem, coleção, número, raridade e variante;
- permite marcar uma carta como obtida;
- filtra por todas, faltantes ou já adquiridas;
- exibe totais e percentuais da coleção;
- busca e filtra por raridade;
- salva o progresso no navegador;
- exporta e importa um backup em JSON;
- publica automaticamente no GitHub Pages.

## Catálogo

Os dados e as imagens vêm da [TCGdex](https://tcgdex.net). O gerador consulta os catálogos em português e japonês, exclui Pokémon TCG Pocket, expande cada impressão por variante e compara as versões japonesas por espécie, ilustrador e características da carta.

Para atualizar a base:

```bash
npm run catalog
```

O catálogo é uma ferramenta pessoal e não oficial. A cobertura depende dos registros e scans disponíveis na TCGdex; cartas sem imagem continuam no checklist com um marcador visual.

## Uso local

Sirva a pasta com qualquer servidor estático. O site não precisa de API, conta ou banco de dados.

## GitHub Pages

O fluxo em `.github/workflows/pages.yml` publica o conteúdo automaticamente após cada envio para `main`. No repositório, configure **Settings → Pages → Source → GitHub Actions** na primeira publicação.
