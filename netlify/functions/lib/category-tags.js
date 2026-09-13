'use strict';

// Mesma lista de public/js/category-tags.js — mantenha os slugs em sincronia.
const CATEGORY_TAGS = [
  { slug: 'tenis', label: 'Tênis' },
  { slug: 'camisas', label: 'Camisas' },
  { slug: 'moletom', label: 'Moletom' },
  { slug: 'calcas', label: 'Calças' },
  { slug: 'sapatos', label: 'Sapatos' },
  { slug: 'shorts', label: 'Shorts' },
  { slug: 'acessorios', label: 'Acessórios' },
  { slug: 'bones', label: 'Bonés' },
  { slug: 'cordoes', label: 'Cordões' },
  { slug: 'aneis', label: 'Anéis' },
];

const VALID_CATEGORY_SLUGS = new Set(CATEGORY_TAGS.map((c) => c.slug));

module.exports = { CATEGORY_TAGS, VALID_CATEGORY_SLUGS };
