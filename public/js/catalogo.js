(function () {
  'use strict';

  const SIZES = ['34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44'];
  const COLORS = ['Preto', 'Branco', 'Cinza', 'Azul', 'Vermelho', 'Verde', 'Bege', 'Multicolor'];

  const state = {
    q: '',
    category: '',
    brand: '',
    minPrice: '',
    maxPrice: '',
    size: '',
    color: '',
    inStock: false,
    promo: false,
    sort: 'relevant',
    page: 1,
  };

  let categories = [];
  let brands = [];
  let searchTimer = null;

  const grid = document.getElementById('productsGrid');
  const resultCount = document.getElementById('resultCount');
  const pagination = document.getElementById('pagination');
  const filterCountEl = document.getElementById('filterCount');

  function money(n) {
    return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function activeFilterCount() {
    let n = 0;
    if (state.category) n++;
    if (state.brand) n++;
    if (state.minPrice || state.maxPrice) n++;
    if (state.size) n++;
    if (state.color) n++;
    if (state.inStock) n++;
    if (state.promo) n++;
    return n;
  }

  function filtersHtml() {
    const catOptions = categories
      .map((c) => `<label class="filter-option"><input type="radio" name="fp-category" value="${c.slug}" ${state.category === c.slug ? 'checked' : ''}> ${c.name}</label>`)
      .join('');
    const brandOptions = brands
      .map((b) => `<label class="filter-option"><input type="radio" name="fp-brand" value="${b}" ${state.brand === b ? 'checked' : ''}> ${b}</label>`)
      .join('');
    const sizeOptions = SIZES
      .map((s) => `<label class="filter-option"><input type="radio" name="fp-size" value="${s}" ${state.size === s ? 'checked' : ''}> ${s}</label>`)
      .join('');
    const colorOptions = COLORS
      .map((c) => `<label class="filter-option"><input type="radio" name="fp-color" value="${c}" ${state.color === c ? 'checked' : ''}> ${c}</label>`)
      .join('');

    return `
      <div class="filter-group">
        <h4>Categoria</h4>
        <label class="filter-option"><input type="radio" name="fp-category" value="" ${state.category === '' ? 'checked' : ''}> Todas</label>
        ${catOptions}
      </div>
      ${brands.length ? `<div class="filter-group"><h4>Marca</h4><label class="filter-option"><input type="radio" name="fp-brand" value="" ${state.brand === '' ? 'checked' : ''}> Todas</label>${brandOptions}</div>` : ''}
      <div class="filter-group">
        <h4>Preço</h4>
        <div class="price-range">
          <input type="number" min="0" inputmode="numeric" name="fp-minPrice" placeholder="Mín." value="${state.minPrice}">
          <span>—</span>
          <input type="number" min="0" inputmode="numeric" name="fp-maxPrice" placeholder="Máx." value="${state.maxPrice}">
        </div>
      </div>
      <div class="filter-group">
        <h4>Tamanho</h4>
        <label class="filter-option"><input type="radio" name="fp-size" value="" ${state.size === '' ? 'checked' : ''}> Todos</label>
        ${sizeOptions}
      </div>
      <div class="filter-group">
        <h4>Cor</h4>
        <label class="filter-option"><input type="radio" name="fp-color" value="" ${state.color === '' ? 'checked' : ''}> Todas</label>
        ${colorOptions}
      </div>
      <div class="filter-group">
        <h4>Disponibilidade</h4>
        <label class="filter-option"><input type="checkbox" name="fp-inStock" ${state.inStock ? 'checked' : ''}> Em estoque</label>
        <label class="filter-option"><input type="checkbox" name="fp-promo" ${state.promo ? 'checked' : ''}> Em promoção</label>
      </div>
      <button class="btn-clear-filters" id="fp-clear" type="button">Limpar filtros</button>
    `;
  }

  function bindFilterInputs(container, { autoApply }) {
    container.querySelectorAll('input[type=radio]').forEach((el) => {
      el.addEventListener('change', () => {
        const key = el.name.replace('fp-', '');
        state[key] = el.value;
        state.page = 1;
        if (autoApply) renderFilters(), load();
      });
    });
    container.querySelectorAll('input[type=checkbox]').forEach((el) => {
      el.addEventListener('change', () => {
        const key = el.name.replace('fp-', '');
        state[key] = el.checked;
        state.page = 1;
        if (autoApply) renderFilters(), load();
      });
    });
    container.querySelectorAll('input[type=number]').forEach((el) => {
      el.addEventListener('change', () => {
        const key = el.name.replace('fp-', '');
        state[key] = el.value;
        state.page = 1;
        if (autoApply) load();
      });
    });
    const clearBtn = container.querySelector('#fp-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        Object.assign(state, { category: '', brand: '', minPrice: '', maxPrice: '', size: '', color: '', inStock: false, promo: false, page: 1 });
        renderFilters();
        load();
      });
    }
  }

  function renderFilters() {
    const desktop = document.getElementById('filtersPanel');
    const mobile = document.getElementById('filtersModalBody');
    const html = filtersHtml();
    desktop.innerHTML = html;
    mobile.innerHTML = html;
    bindFilterInputs(desktop, { autoApply: true });
    bindFilterInputs(mobile, { autoApply: false });
    const count = activeFilterCount();
    filterCountEl.style.display = count ? 'inline-flex' : 'none';
    filterCountEl.textContent = String(count);
  }

  function cardHtml(p) {
    const img = p.images && p.images[0] ? p.images[0] : 'assets/product-tenis.jpg';
    const hasPromo = p.promo_price != null;
    const outOfStock = Number(p.stock) <= 0;
    const catName = (categories.find((c) => c.id === p.category_id) || {}).name || '';
    const waMsg = encodeURIComponent(`Olá! Vim pelo catálogo da CRVL Store e tenho interesse no produto "${p.name}". Pode me passar mais informações?`);
    return `
      <article class="product-card reveal-scroll in-view">
        ${hasPromo ? '<span class="badge">Promoção</span>' : outOfStock ? '<span class="badge badge-out">Esgotado</span>' : ''}
        <a href="/produto.html?slug=${encodeURIComponent(p.slug)}" class="product-media" style="display:block;">
          <img src="${img}" alt="${p.name}" loading="lazy">
        </a>
        <div class="product-info">
          <span class="product-cat">${catName}${p.brand ? ' · ' + p.brand : ''}</span>
          <h3><a href="/produto.html?slug=${encodeURIComponent(p.slug)}" style="color:inherit;">${p.name}</a></h3>
          <div class="price-row">
            <span class="price-now">${money(hasPromo ? p.promo_price : p.price)}</span>
            ${hasPromo ? `<span class="price-old">${money(p.price)}</span>` : ''}
          </div>
          <div class="product-actions">
            <a href="/produto.html?slug=${encodeURIComponent(p.slug)}" class="link-mini">Ver detalhes</a>
            <a href="https://wa.me/5511982291198?text=${waMsg}" target="_blank" rel="noopener" class="link-mini gold">Comprar pelo WhatsApp</a>
          </div>
        </div>
      </article>`;
  }

  function skeletonHtml(n) {
    return Array.from({ length: n })
      .map(() => '<div class="skeleton-card"><div class="skeleton sk-media"></div><div class="skeleton sk-line" style="width:60%"></div><div class="skeleton sk-line" style="width:40%"></div></div>')
      .join('');
  }

  function renderPagination(total, page, pageSize) {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (totalPages <= 1) { pagination.innerHTML = ''; return; }
    let html = `<button ${page <= 1 ? 'disabled' : ''} data-page="${page - 1}">‹</button>`;
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) {
        html += `<button class="${i === page ? 'active' : ''}" data-page="${i}">${i}</button>`;
      } else if (Math.abs(i - page) === 2) {
        html += `<span style="color:var(--grey); padding:0 4px;">…</span>`;
      }
    }
    html += `<button ${page >= totalPages ? 'disabled' : ''} data-page="${page + 1}">›</button>`;
    pagination.innerHTML = html;
    pagination.querySelectorAll('button[data-page]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.page = Number(btn.dataset.page);
        window.scrollTo({ top: document.querySelector('.catalog-shell').offsetTop - 90, behavior: 'smooth' });
        load();
      });
    });
  }

  async function load() {
    grid.innerHTML = skeletonHtml(8);
    resultCount.textContent = 'Carregando...';
    const params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category) params.set('category', state.category);
    if (state.brand) params.set('brand', state.brand);
    if (state.minPrice) params.set('minPrice', state.minPrice);
    if (state.maxPrice) params.set('maxPrice', state.maxPrice);
    if (state.size) params.set('size', state.size);
    if (state.color) params.set('color', state.color);
    if (state.inStock) params.set('inStock', '1');
    if (state.promo) params.set('promo', '1');
    params.set('sort', state.sort);
    params.set('page', String(state.page));
    params.set('pageSize', '12');

    try {
      const data = await window.CrvlApi.get(`/products?${params.toString()}`);
      brands = data.brands || brands;
      if (!grid.dataset.brandsBound) {
        grid.dataset.brandsBound = '1';
        renderFilters();
      }
      if (!data.products.length) {
        grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;">Nenhum produto encontrado com esses filtros.<br>Tente ajustar a busca ou limpar os filtros.</div>';
        resultCount.textContent = 'Nenhum resultado';
        pagination.innerHTML = '';
        return;
      }
      grid.innerHTML = data.products.map(cardHtml).join('');
      resultCount.textContent = `${data.total} produto${data.total === 1 ? '' : 's'} encontrado${data.total === 1 ? '' : 's'}`;
      renderPagination(data.total, data.page, data.pageSize);
    } catch (err) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">Não foi possível carregar o catálogo agora. ${err.message}</div>`;
      resultCount.textContent = '';
    }
  }

  async function init() {
    document.getElementById('searchInput').addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.q = e.target.value.trim();
        state.page = 1;
        load();
      }, 350);
    });
    document.getElementById('sortSelect').addEventListener('change', (e) => {
      state.sort = e.target.value;
      state.page = 1;
      load();
    });

    const backdrop = document.getElementById('filtersBackdrop');
    const modal = document.getElementById('filtersModal');
    function openModal() { backdrop.classList.add('open'); modal.classList.add('open'); document.body.style.overflow = 'hidden'; }
    function closeModal() { backdrop.classList.remove('open'); modal.classList.remove('open'); document.body.style.overflow = ''; }
    document.getElementById('openFilters').addEventListener('click', openModal);
    document.getElementById('closeFilters').addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);
    document.getElementById('applyFilters').addEventListener('click', () => {
      // Sincroniza os valores do modal (que não auto-aplica) para o state e recarrega.
      const mobileInputs = document.getElementById('filtersModalBody').querySelectorAll('input');
      mobileInputs.forEach((el) => {
        const key = el.name.replace('fp-', '');
        if (el.type === 'radio') { if (el.checked) state[key] = el.value; }
        else if (el.type === 'checkbox') state[key] = el.checked;
        else state[key] = el.value;
      });
      state.page = 1;
      renderFilters();
      closeModal();
      load();
    });

    try {
      const catData = await window.CrvlApi.get('/categories');
      categories = catData.categories || [];
    } catch (e) {
      categories = [];
    }

    // Pré-preenche filtro de categoria via ?categoria=slug na URL, se vier de algum link.
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('categoria')) state.category = urlParams.get('categoria');
    if (urlParams.get('q')) { state.q = urlParams.get('q'); document.getElementById('searchInput').value = state.q; }

    renderFilters();
    load();
  }

  init();
})();
