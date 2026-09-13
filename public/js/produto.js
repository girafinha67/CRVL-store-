(function () {
  'use strict';

  function money(n) {
    return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function notFound() {
    document.getElementById('productRoot').innerHTML = `
      <div class="page-hero" style="text-align:center;">
        <h1>Produto não encontrado</h1>
        <p>Esse produto pode ter sido removido ou o link está incorreto.</p>
        <p style="margin-top:24px;"><a class="btn btn-gold" href="/catalogo.html">Voltar ao catálogo</a></p>
      </div>`;
  }

  function render(p, categoryName) {
    const hasPromo = p.promo_price != null;
    const outOfStock = Number(p.stock) <= 0;
    const images = p.images && p.images.length ? p.images : ['assets/product-tenis.jpg'];
    const waMsg = encodeURIComponent(`Olá! Vim pelo site da CRVL Store e tenho interesse no produto "${p.name}"${p.brand ? ' (' + p.brand + ')' : ''}. Pode me passar mais informações?`);

    document.title = `${p.name} | CRVL Store`;
    document.getElementById('pageTitle').textContent = `${p.name} | CRVL Store`;
    const desc = (p.description || `${p.name} disponível na CRVL Store.`).slice(0, 160);
    document.getElementById('pageDescription').setAttribute('content', desc);
    document.getElementById('ogTitle').setAttribute('content', `${p.name} | CRVL Store`);
    document.getElementById('ogDescription').setAttribute('content', desc);
    document.getElementById('ogImage').setAttribute('content', images[0]);
    document.getElementById('pageCanonical').setAttribute('href', `https://crvlstore.com.br/produto.html?slug=${p.slug}`);

    document.getElementById('productLd').textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: p.name,
      description: p.description || '',
      image: images,
      brand: p.brand ? { '@type': 'Brand', name: p.brand } : undefined,
      sku: p.sku || undefined,
      offers: {
        '@type': 'Offer',
        priceCurrency: 'BRL',
        price: hasPromo ? p.promo_price : p.price,
        availability: outOfStock ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
        url: `https://crvlstore.com.br/produto.html?slug=${p.slug}`,
      },
    });

    const sizeChips = (p.sizes || []).map((s) => `<span class="pd-chip">${s}</span>`).join('') || '<span style="color:var(--grey); font-size:0.85rem;">Não informado</span>';
    const colorChips = (p.colors || []).map((c) => `<span class="pd-chip">${c}</span>`).join('') || '<span style="color:var(--grey); font-size:0.85rem;">Não informado</span>';

    document.getElementById('productRoot').innerHTML = `
      <div class="product-detail">
        <div>
          <div class="pd-gallery-main"><img id="mainImg" src="${images[0]}" alt="${p.name}"></div>
          ${images.length > 1 ? `<div class="pd-thumbs">${images.map((img, i) => `<img src="${img}" class="${i === 0 ? 'active' : ''}" data-img="${img}" alt="${p.name} - foto ${i + 1}">`).join('')}</div>` : ''}
        </div>
        <div>
          <p class="breadcrumb"><a href="/">Início</a> / <a href="/catalogo.html">Catálogo</a> / ${p.name}</p>
          <span class="pd-cat">${categoryName || ''}</span>
          <h1 class="pd-title">${p.name}</h1>
          ${p.brand ? `<p class="pd-brand">${p.brand}${p.sku ? ' · SKU ' + p.sku : ''}</p>` : ''}
          <div class="pd-price-row">
            <span class="pd-price-now">${money(hasPromo ? p.promo_price : p.price)}</span>
            ${hasPromo ? `<span class="pd-price-old">${money(p.price)}</span>` : ''}
          </div>
          ${p.description ? `<p class="pd-desc">${p.description}</p>` : ''}
          <div class="pd-options">
            <h4>Tamanhos disponíveis</h4>
            <div class="pd-chip-row">${sizeChips}</div>
          </div>
          <div class="pd-options">
            <h4>Cores</h4>
            <div class="pd-chip-row">${colorChips}</div>
          </div>
          <p class="pd-stock ${outOfStock ? 'out' : 'in'}">${outOfStock ? '● Esgotado no momento' : '● Disponível em estoque'}</p>
          <div class="pd-actions" data-product-id="${p.id}">
            <a class="btn btn-gold" href="https://wa.me/5511982291198?text=${waMsg}" target="_blank" rel="noopener">Comprar pelo WhatsApp</a>
            <a class="btn btn-ghost" href="/catalogo.html">Voltar ao catálogo</a>
          </div>
        </div>
      </div>
    `;

    if (window.CrvlAnalytics) window.CrvlAnalytics.trackProductView(p, p.category_tags);

    document.querySelectorAll('.pd-thumbs img').forEach((thumb) => {
      thumb.addEventListener('click', () => {
        document.getElementById('mainImg').src = thumb.dataset.img;
        document.querySelectorAll('.pd-thumbs img').forEach((t) => t.classList.remove('active'));
        thumb.classList.add('active');
      });
    });
  }

  async function init() {
    const slug = new URLSearchParams(window.location.search).get('slug');
    if (!slug) return notFound();
    try {
      const productData = await window.CrvlApi.get(`/products/${encodeURIComponent(slug)}`);
      const tags = window.CRVL_CATEGORY_TAGS || [];
      const categoryName = (productData.product.category_tags || [])
        .map((slugTag) => (tags.find((c) => c.slug === slugTag) || {}).label)
        .filter(Boolean)
        .join(', ');
      render(productData.product, categoryName);
    } catch (err) {
      notFound();
    }
  }

  init();
})();
