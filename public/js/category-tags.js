// Lista fixa de categorias que um produto pode receber (multi-seleção).
// Usada tanto no formulário de produto do admin quanto no filtro do catálogo.
// Se precisar adicionar/remover uma categoria, mexa só aqui — o mesmo array
// existe no backend em netlify/functions/lib/category-tags.js e precisa
// ficar em sincronia (slugs iguais).
window.CRVL_CATEGORY_TAGS = [
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
