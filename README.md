# Breno Multimarcas — Site Institucional

Site estático (HTML/CSS/JS puro, sem build/dependências) pronto para publicar em qualquer
host estático — inclusive Netlify, arrastando a pasta ou via `netlify deploy`.

## Estrutura
```
breno-multimarcas/
├── index.html
├── robots.txt
├── sitemap.xml
└── assets/
    ├── style.css
    ├── script.js
    └── favicon.svg
```

## Pesquisa realizada
- Busquei o Instagram informado (`@breno.multimarcas_reserva_`), Google e Google Maps.
  O Instagram bloqueia acesso automatizado (robots.txt), e não há indexação pública
  (Google/imprensa/avaliações) para uma loja de roupas com esse nome nesse endereço —
  os resultados de "Breno Multimarcas" no Google são negócios diferentes (concessionárias
  de veículos em SP). Não havia imagem de referência de fato anexada nesta conversa.
- **Por isso, segui a regra do próprio briefing**: nada foi inventado. Usei apenas os dados
  que você forneceu no texto (endereço, WhatsApp, Instagram, tagline, categorias de produto).

## O que não pôde ser verificado (e não foi inventado)
- Logo oficial da loja
- Fotos reais de produtos e fachada
- Horário de funcionamento
- Marcas específicas vendidas
- Avaliações, número de seguidores, preços

## Placeholders prontos para receber conteúdo real
Os seguintes blocos têm estrutura, proporção e estilo prontos — basta trocar o placeholder
por uma tag `<img>` real (ou `background-image`) apontando para o arquivo em `assets/`:
- `.product-media` (4 cards em "Destaques")
- `.about-frame` (foto da fachada/interior em "Sobre")
- `.gallery-item` (6 fotos em "Galeria")
- `.ig-cell` (4 posts em "Instagram")
- `assets/favicon.svg` → pode ser substituído pelo logo oficial em SVG/PNG

## Identidade visual
- Preto profundo (`#08080a`) + dourado metálico (`#c9a24a` / `#e8c874`) como destaque, não como fundo
- Tipografia: **Anton** (display, condensada, forte) + **Manrope** (corpo, limpa)
- Textura sutil em grid no hero, glow dourado ambiente, marquee com frases-chave da loja
- Motion: reveal ao scroll via `IntersectionObserver`, sem exageros; `prefers-reduced-motion` respeitado

## Links já configurados e testados
- WhatsApp: `https://wa.me/5598985254539` (com mensagem pré-preenchida)
- Instagram: `https://www.instagram.com/breno.multimarcas_reserva_/`
- Google Maps (busca e rota): montado a partir do endereço informado
- Âncoras internas do menu (`#produtos`, `#sobre`, `#galeria`, `#localizacao`, `#instagram`)

## Antes de publicar
1. Troque `https://brenomultimarcas.com.br/` (canonical, sitemap, schema) pelo domínio real.
2. Substitua os placeholders de imagem pelas fotos reais da loja.
3. Confirme horário de funcionamento, se quiser exibi-lo (não incluído por falta de confirmação).
4. Adicione uma imagem OG real (1200×630) em `assets/og-image.jpg` e reative as tags `og:image`
   removidas no `<head>` (foram removidas para não referenciar um arquivo inexistente).
