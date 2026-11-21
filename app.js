/**
 * ============================================================================
 * CASA LUCE FRONT-END ENGINE & SHOPPING CART SUITE
 * ============================================================================
 * Gerencia: Carrinho Reativo Multi-Itens com localStorage e Soma Real (Sem Descontos Inventados),
 * Compra Rápida nos Cards (+ Adicionar ao Carrinho no Hover), Modais Institucionais,
 * Busca Interativa em Tempo Real e Navegação Fluida de Produtos e Coleções.
 * 100% Livre de Códigos de Rastreamento Externo.
 */

(function () {
  'use strict';

  // --------------------------------------------------------------------------
  // 1. ESTADO GLOBAL DO CARRINHO (REATIVO, MULTI-ITENS & PERSISTENTE)
  // --------------------------------------------------------------------------
  const CartState = {
    items: [],

    init() {
      try {
        const saved = localStorage.getItem('casaluce_cart');
        if (saved) {
          this.items = JSON.parse(saved);
        }
      } catch (e) {
        this.items = [];
      }
      this.updateUI();
    },

    save() {
      try {
        localStorage.setItem('casaluce_cart', JSON.stringify(this.items));
      } catch (e) {}
      this.updateUI();
    },

    addItem(product) {
      const variantTitle = product.variantTitle || '';
      const uniqueId = `${product.id || product.handle}-${variantTitle}`.replace(/\s+/g, '-');
      const price = parseFloat(product.price) || 79.99;
      const qtyToAdd = parseInt(product.quantity, 10) || 1;

      const existing = this.items.find(item => item.uniqueId === uniqueId);
      if (existing) {
        existing.quantity += qtyToAdd;
      } else {
        this.items.push({
          uniqueId: uniqueId,
          id: product.id || 'prod_' + Date.now(),
          handle: product.handle || '',
          title: product.title || 'Produto Casa Luce',
          variantTitle: variantTitle,
          price: price,
          image: product.image || '',
          quantity: qtyToAdd
        });
      }

      this.save();
      this.showToast(`"${product.title.slice(0, 26)}..." adicionado ao carrinho!`);
      CartDrawer.open();
    },

    updateQuantity(uniqueId, delta) {
      const item = this.items.find(it => it.uniqueId === uniqueId);
      if (!item) return;
      item.quantity += delta;
      if (item.quantity <= 0) {
        this.removeItem(uniqueId);
      } else {
        this.save();
      }
    },

    removeItem(uniqueId) {
      this.items = this.items.filter(it => it.uniqueId !== uniqueId);
      this.save();
    },

    getTotalCount() {
      return this.items.reduce((acc, it) => acc + it.quantity, 0);
    },

    // Soma limpa: Preço unitário × Quantidade de cada item (sem descontos inventados)
    getSubtotal() {
      return this.items.reduce((acc, it) => acc + (it.price * it.quantity), 0);
    },

    getTotal() {
      return this.getSubtotal();
    },

    formatCurrency(val) {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    },

    updateUI() {
      const count = this.getTotalCount();

      // Atualiza badges em qualquer cabeçalho ou ícone
      const countElements = document.querySelectorAll('.cart-bubble__text-count, [data-testid="cart-bubble"], .pdp-cart-badge, .cv-header-cart-count, #header-cart-badge');
      countElements.forEach(el => {
        el.textContent = count;
        if (count > 0) {
          el.classList.remove('hidden');
          el.style.display = 'flex';
          const bubble = el.closest('.cart-bubble');
          if (bubble) bubble.classList.remove('visually-hidden');
        } else {
          el.classList.add('hidden');
          el.style.display = 'none';
        }
      });

      CartDrawer.render();
    },

    showToast(message) {
      let toast = document.querySelector('.cro-toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.className = 'cro-toast';
        document.body.appendChild(toast);
      }
      toast.innerHTML = `<span class="cro-toast-check">✓</span> <span>${message}</span>`;
      toast.classList.add('is-visible');
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => {
        toast.classList.remove('is-visible');
      }, 3500);
    }
  };

  window.CartState = CartState;

  // --------------------------------------------------------------------------
  // 2. PAINEL LATERAL DO CARRINHO (CART DRAWER LIMPO COM SOMA REAL)
  // --------------------------------------------------------------------------
  const CartDrawer = {
    overlay: null,
    panel: null,

    build() {
      if (document.querySelector('.cro-cart-drawer-panel')) return;

      this.overlay = document.createElement('div');
      this.overlay.className = 'cro-cart-drawer-overlay';
      this.overlay.addEventListener('click', () => this.close());

      this.panel = document.createElement('aside');
      this.panel.className = 'cro-cart-drawer-panel';
      this.panel.innerHTML = `
        <div class="cro-cart-header">
          <h3>Sua Sacola (<span class="cro-cart-count-header">0</span>)</h3>
          <button class="cro-cart-close" aria-label="Fechar carrinho">&times;</button>
        </div>
        <div class="cro-cart-body" id="cro-cart-items-wrapper"></div>
        <div class="cro-cart-footer" id="cro-cart-footer-block">
          <div class="cro-cart-summary-line">
            <span>Subtotal dos Produtos</span>
            <span id="cro-cart-subtotal-val">R$ 0,00</span>
          </div>
          <div class="cro-cart-summary-line" style="color: #27ae60;">
            <span>Frete Especial</span>
            <span style="font-weight: 700;">GRÁTIS</span>
          </div>
          <div class="cro-cart-summary-line is-total">
            <span>Valor Total</span>
            <span class="cro-val-total" id="cro-cart-total-val">R$ 0,00</span>
          </div>
          <a href="checkout.html" class="cro-cart-checkout-btn">
            <span>FINALIZAR COMPRA</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </a>
          <div class="cro-cart-security-badge">
            <svg viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg>
            Compra 100% Segura · Criptografia SSL 256 bits
          </div>
        </div>
      `;

      this.panel.querySelector('.cro-cart-close').addEventListener('click', () => this.close());
      const chkBtn = this.panel.querySelector('.cro-cart-checkout-btn');
      if (chkBtn) {
        chkBtn.addEventListener('click', (e) => {
          if (CartState.items.length === 0) {
            e.preventDefault();
            alert('Sua sacola está vazia.');
          } else {
            e.preventDefault();
            window.location.href = 'checkout.html';
          }
        });
      }

      document.body.appendChild(this.overlay);
      document.body.appendChild(this.panel);
    },

    open() {
      this.build();
      this.render();
      setTimeout(() => {
        this.overlay.classList.add('is-active');
        this.panel.classList.add('is-open');
        document.body.style.overflow = 'hidden';
      }, 10);
    },

    close() {
      if (!this.panel) return;
      this.overlay.classList.remove('is-active');
      this.panel.classList.remove('is-open');
      document.body.style.overflow = '';
    },

    render() {
      if (!this.panel) return;

      const itemsWrapper = document.getElementById('cro-cart-items-wrapper');
      const footerBlock = document.getElementById('cro-cart-footer-block');
      const countHeader = this.panel.querySelector('.cro-cart-count-header');
      const subtotalEl = document.getElementById('cro-cart-subtotal-val');
      const totalEl = document.getElementById('cro-cart-total-val');

      const items = CartState.items;
      const count = CartState.getTotalCount();
      const subtotal = CartState.getSubtotal();
      const total = subtotal; // Total = Soma exata dos itens adicionados

      if (countHeader) countHeader.textContent = count;

      if (items.length === 0) {
        itemsWrapper.innerHTML = `
          <div class="cro-cart-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <path d="M16 10a4 4 0 0 1-8 0"></path>
            </svg>
            <p>Sua sacola está vazia.</p>
            <button type="button" class="cro-cart-btn-continue" onclick="window.CartDrawer.close()">Explorar Coleção de Natal</button>
          </div>
        `;
        if (footerBlock) footerBlock.style.display = 'none';
        return;
      }

      if (footerBlock) footerBlock.style.display = 'block';

      itemsWrapper.innerHTML = items.map(item => {
        const itemLineTotal = CartState.formatCurrency(item.price * item.quantity);
        return `
          <div class="cro-cart-item" data-id="${item.uniqueId}">
            <img src="${item.image || 'https://via.placeholder.com/90'}" alt="${item.title}" class="cro-cart-item-img">
            <div class="cro-cart-item-info">
              <h4 class="cro-cart-item-title">${item.title}</h4>
              ${item.variantTitle && item.variantTitle !== 'Default Title' ? `<span class="cro-cart-item-variant">${item.variantTitle}</span>` : ''}
              <div class="cro-cart-item-prices">
                <span class="cro-cart-item-price">${CartState.formatCurrency(item.price)} cada</span>
              </div>
              <div class="cro-cart-item-controls">
                <div class="cro-cart-qty-pill">
                  <button type="button" class="cro-cart-qty-btn" data-action="minus" data-id="${item.uniqueId}">−</button>
                  <span class="cro-cart-qty-val">${item.quantity}</span>
                  <button type="button" class="cro-cart-qty-btn" data-action="plus" data-id="${item.uniqueId}">+</button>
                </div>
                <div style="font-weight: 600; font-size: 13.5px; color: #1a1a1a;">${itemLineTotal}</div>
                <button type="button" class="cro-cart-remove" data-id="${item.uniqueId}" aria-label="Remover">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');

      if (subtotalEl) subtotalEl.textContent = CartState.formatCurrency(subtotal);
      if (totalEl) totalEl.textContent = CartState.formatCurrency(total);

      // Eventos dos botões nos itens do carrinho
      itemsWrapper.querySelectorAll('.cro-cart-qty-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = btn.dataset.id;
          const action = btn.dataset.action;
          CartState.updateQuantity(id, action === 'plus' ? 1 : -1);
        });
      });

      itemsWrapper.querySelectorAll('.cro-cart-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = btn.dataset.id;
          CartState.removeItem(id);
        });
      });
    }
  };

  window.CartDrawer = CartDrawer;

  // --------------------------------------------------------------------------
  // 3. COMPRA RÁPIDA NOS CARDS (+ ADICIONAR AO CARRINHO NO HOVER)
  // --------------------------------------------------------------------------
  const QuickAdd = {
    init() {
      this.attachButtons();
      this.bindEvents();
    },

    attachButtons() {
      // Procura cards em index.html, colecao.html e produto.html
      const cards = document.querySelectorAll('.product-card, .cv-product-card, .cv-rec-card');
      cards.forEach(card => {
        if (card.querySelector('.cro-quick-add-btn')) return;

        // Extrai handle do produto
        let handle = '';
        const link = card.querySelector('a[href*="id="], a[href*="/products/"]');
        if (link) {
          const href = link.getAttribute('href');
          if (href.includes('id=')) {
            handle = href.split('id=')[1].split('&')[0];
          } else if (href.includes('/products/')) {
            handle = href.split('/products/')[1].split(/[?#]/)[0];
          }
        }

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cro-quick-add-btn';
        btn.setAttribute('data-handle', handle);
        btn.innerHTML = `
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>Adicionar ao carrinho</span>
        `;

        // Encontra o container visual da imagem
        const mediaContainer = card.querySelector('.card-gallery, .cv-card-media, .cv-rec-img-box, .product-card__media-wrapper') || card;
        mediaContainer.appendChild(btn);
      });
    },

    bindEvents() {
      document.addEventListener('click', (e) => {
        const btn = e.target.closest('.cro-quick-add-btn');
        if (!btn) return;

        e.preventDefault();
        e.stopPropagation();

        let handle = btn.getAttribute('data-handle');
        if (!handle) {
          const card = btn.closest('.product-card, .cv-product-card, .cv-rec-card');
          const link = card ? card.querySelector('a[href*="id="], a[href*="/products/"]') : null;
          if (link) {
            const href = link.getAttribute('href');
            handle = href.includes('id=') ? href.split('id=')[1].split('&')[0] : href.split('/products/')[1].split(/[?#]/)[0];
          }
        }

        const catalog = window.CASALUCE_PRODUCTS || {};
        let product = catalog[handle];

        if (!product && handle) {
          const allKeys = Object.keys(catalog);
          const match = allKeys.find(k => k.includes(handle) || handle.includes(k));
          if (match) product = catalog[match];
        }

        if (product) {
          const price = parseFloat(product.price) || 79.99;
          const image = (product.images && product.images.length > 0) ? product.images[0] : '';
          const variantTitle = (product.variants && product.variants.length > 0 && product.variants[0].title !== 'Default Title') ? product.variants[0].title : '';

          CartState.addItem({
            id: product.id,
            handle: product.handle,
            title: product.title,
            variantTitle: variantTitle,
            price: price,
            image: image,
            quantity: 1
          });
        } else {
          // Fallback caso não encontre no catálogo
          CartState.addItem({
            id: 'quick_' + Date.now(),
            handle: handle || 'produto',
            title: 'Produto Selecionado',
            variantTitle: '',
            price: 79.99,
            image: '',
            quantity: 1
          });
        }
      });
    }
  };

  window.QuickAdd = QuickAdd;

  // --------------------------------------------------------------------------
  // 4. MODAIS INSTITUCIONAIS (SOBRE NÓS, POLÍTICAS, TROCAS, TERMOS)
  // --------------------------------------------------------------------------
  const ModalManager = {
    modalData: {
      'sobre': {
        title: 'Nossa História · Casa Luce',
        content: `
          <h4>Uma casa onde o tempo desacelera</h4>
          <p>A Casa Luce nasceu de um desejo simples: trazer a natureza para dentro de casa. Acreditamos que um lar acolhedor se constrói com peças escolhidas com calma, como a pedra, a cerâmica, o vidro, a madeira e as fibras naturais, e com os pequenos rituais que repetimos todo ano.</p>
          <p>Cada objeto da nossa curadoria é pensado para durar além de uma estação e para estar presente nos momentos que realmente importam: o café da manhã sem pressa, a mesa posta para quem a gente ama e o aconchego dos encontros.</p>
          <h4>Beleza natural e atemporal</h4>
          <p>Trabalhamos diretamente com artistas, artesãos e designers selecionados para levar sofisticação, autenticidade e rituais de bem-estar para residências em todo o Brasil.</p>
        `
      },
      'sobre-nos': {
        title: 'Nossa História · Casa Luce',
        content: `
          <h4>Uma casa onde o tempo desacelera</h4>
          <p>A Casa Luce nasceu de um desejo simples: trazer a natureza para dentro de casa. Acreditamos que um lar acolhedor se constrói com peças escolhidas com calma, como a pedra, a cerâmica, o vidro, a madeira e as fibras naturais, e com os pequenos rituais que repetimos todo ano.</p>
          <p>Cada objeto da nossa curadoria é pensado para durar além de uma estação e para estar presente nos momentos que realmente importam: o café da manhã sem pressa, a mesa posta para quem a gente ama e o aconchego dos encontros.</p>
          <h4>Beleza natural e atemporal</h4>
          <p>Trabalhamos diretamente com artistas, artesãos e designers selecionados para levar sofisticação, autenticidade e rituais de bem-estar para residências em todo o Brasil.</p>
        `
      },
      'privacidade': {
        title: 'Política de Privacidade',
        content: `
          <h4>Seus dados 100% seguros</h4>
          <p>Na Casa Luce, respeitamos integralmente a sua privacidade e os seus dados pessoais de acordo com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).</p>
          <h4>Uso das Informações</h4>
          <p>As informações fornecidas em nossa loja (como nome, endereço e e-mail) são utilizadas exclusivamente para o processamento de pedidos, entrega segura e comunicações importantes sobre suas compras.</p>
          <h4>Segurança e Criptografia</h4>
          <p>Nosso ambiente é protegido por certificados SSL de 256 bits. Não compartilhamos, vendemos ou alugamos seus dados para terceiros sob nenhuma circunstância.</p>
        `
      },
      'trocas': {
        title: 'Trocas e Devoluções',
        content: `
          <h4>Garantia Incondicional de 7 Dias</h4>
          <p>Se você não estiver 100% satisfeito com o seu produto, você tem até 7 (sete) dias corridos após o recebimento para solicitar a troca ou devolução sem burocracia.</p>
          <h4>Como solicitar</h4>
          <ul>
            <li>Envie um e-mail para <strong>atendimento@casaluce.com.br</strong> com o número do seu pedido.</li>
            <li>Fornecemos a autorização de postagem reversa sem custo de frete na primeira troca.</li>
            <li>O produto deve estar na embalagem original e sem indícios de uso indevido.</li>
          </ul>
          <h4>Reembolso</h4>
          <p>Reembolsos via Pix são processados em até 24 horas úteis após a conferência da peça; compras no cartão têm estorno solicitado imediatamente à administradora.</p>
        `
      },
      'termos': {
        title: 'Termos de Uso',
        content: `
          <h4>Condições Gerais</h4>
          <p>Ao navegar e realizar pedidos na Casa Luce, você concorda com nossos termos de serviço, pensados para garantir clareza, transparência e respeito ao consumidor.</p>
          <h4>Preços e Disponibilidade</h4>
          <p>Os preços, promoções e disponibilidades de estoque são válidos durante o período de exibição em nossa vitrine virtual, podendo sofrer atualizações periódicas sem aviso prévio.</p>
          <h4>Propriedade Intelectual</h4>
          <p>Todas as marcas, fotos e textos são de propriedade da Casa Luce ou de seus parceiros credenciados, sendo proibida a reprodução sem autorização prévia.</p>
        `
      },
      'envio': {
        title: 'Envio e Prazos de Entrega',
        content: `
          <h4>Envio para todo o Brasil</h4>
          <p>Enviamos para todas as cidades brasileiras com código de rastreamento enviado por e-mail e WhatsApp logo após a postagem.</p>
          <h4>Prazos Médios</h4>
          <ul>
            <li><strong>Capitais e Regiões Metropolitanas:</strong> 4 a 9 dias úteis.</li>
            <li><strong>Demais Regiões e Interior:</strong> 6 a 14 dias úteis.</li>
          </ul>
          <h4>Embalagens Reforçadas</h4>
          <p>Nossas peças em cristal, murano e cerâmica contam com embalagens de proteção antichoque multicamadas para garantir que seu pedido chegue intacto ao seu lar.</p>
        `
      }
    },

    modalEl: null,

    init() {
      this.buildModal();
      this.bindTriggers();
    },

    buildModal() {
      if (document.getElementById('cro-info-modal-backdrop')) return;

      const backdrop = document.createElement('div');
      backdrop.id = 'cro-info-modal-backdrop';
      backdrop.className = 'cro-modal-backdrop';
      backdrop.innerHTML = `
        <div class="cro-modal-container">
          <div class="cro-modal-header">
            <h3 class="cro-modal-title" id="cro-modal-title">Informações</h3>
            <button type="button" class="cro-modal-close" id="cro-modal-close" aria-label="Fechar">&times;</button>
          </div>
          <div class="cro-modal-body" id="cro-modal-body"></div>
        </div>
      `;

      backdrop.querySelector('#cro-modal-close').addEventListener('click', () => this.close());
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) this.close();
      });

      document.body.appendChild(backdrop);
      this.modalEl = backdrop;
    },

    open(type) {
      this.buildModal();
      const data = this.modalData[type] || {
        title: 'Informações · Casa Luce',
        content: '<p>Estamos à disposição para ajudar você a escolher as melhores peças para a sua casa. Entre em contato pelo e-mail atendimento@casaluce.com.br.</p>'
      };

      document.getElementById('cro-modal-title').textContent = data.title;
      document.getElementById('cro-modal-body').innerHTML = data.content;

      this.modalEl.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    },

    close() {
      if (!this.modalEl) return;
      this.modalEl.classList.remove('is-open');
      document.body.style.overflow = '';
    },

    bindTriggers() {
      document.addEventListener('click', (e) => {
        const trigger = e.target.closest('[data-modal], a[href*="#modal-"], a[href*="/pages/"], a[href*="sobre-nos"]');
        if (trigger) {
          e.preventDefault();
          e.stopPropagation();
          let modalType = trigger.getAttribute('data-modal');
          if (!modalType) {
            const href = (trigger.getAttribute('href') || '').toLowerCase();
            if (href.includes('privacidade')) modalType = 'privacidade';
            else if (href.includes('trocas') || href.includes('devolu')) modalType = 'trocas';
            else if (href.includes('termos')) modalType = 'termos';
            else if (href.includes('envio') || href.includes('prazo')) modalType = 'envio';
            else if (href.includes('sobre')) modalType = 'sobre-nos';
          }
          if (modalType) this.open(modalType);
        }
      }, true);
    }
  };

  window.ModalManager = ModalManager;

  // --------------------------------------------------------------------------
  // 5. MODAL DE BUSCA INTERATIVA EM TEMPO REAL
  // --------------------------------------------------------------------------
  const SearchManager = {
    searchModal: null,

    init() {
      this.buildSearchModal();
      this.bindSearchTriggers();
    },

    buildSearchModal() {
      if (document.getElementById('cro-search-modal-backdrop')) return;

      const backdrop = document.createElement('div');
      backdrop.id = 'cro-search-modal-backdrop';
      backdrop.className = 'cro-modal-backdrop';
      backdrop.innerHTML = `
        <div class="cro-modal-container cro-search-modal-container">
          <div class="cro-modal-header">
            <h3 class="cro-modal-title">Buscar na Loja</h3>
            <button type="button" class="cro-modal-close" id="cro-search-close" aria-label="Fechar">&times;</button>
          </div>
          <div class="cro-modal-body" style="padding-bottom: 20px;">
            <div class="cro-search-input-wrapper">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <input type="text" id="cro-search-live-input" class="cro-search-input" placeholder="Digite o nome do produto (ex: projetor, guirlanda, vela...)" autocomplete="off">
            </div>
            <div class="cro-search-results-grid" id="cro-search-results-box">
              <p style="color: #888; font-size: 13.5px; margin: 20px 0;">Digite acima para buscar entre os 1.076 produtos da loja.</p>
            </div>
          </div>
        </div>
      `;

      backdrop.querySelector('#cro-search-close').addEventListener('click', () => this.close());
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) this.close();
      });

      const input = backdrop.querySelector('#cro-search-live-input');
      input.addEventListener('input', () => this.handleSearch(input.value));

      document.body.appendChild(backdrop);
      this.searchModal = backdrop;
    },

    open() {
      this.buildSearchModal();
      this.searchModal.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      setTimeout(() => {
        const input = document.getElementById('cro-search-live-input');
        if (input) {
          input.focus();
          this.handleSearch(input.value);
        }
      }, 100);
    },

    close() {
      if (!this.searchModal) return;
      this.searchModal.classList.remove('is-open');
      document.body.style.overflow = '';
    },

    handleSearch(query) {
      const resultsBox = document.getElementById('cro-search-results-box');
      if (!resultsBox) return;

      const q = (query || '').toLowerCase().trim();
      const catalog = window.CASALUCE_PRODUCTS || {};
      const allKeys = Object.keys(catalog);

      if (!q) {
        resultsBox.innerHTML = '<p style="color: #888; font-size: 13.5px; margin: 20px 0;">Digite acima para buscar entre os 1.076 produtos da loja.</p>';
        return;
      }

      const matches = allKeys
        .filter(k => {
          const p = catalog[k];
          return p.title.toLowerCase().includes(q) || k.toLowerCase().includes(q) || (p.tags && p.tags.join(' ').toLowerCase().includes(q));
        })
        .slice(0, 8);

      if (matches.length === 0) {
        resultsBox.innerHTML = `<p style="color: #888; font-size: 13.5px; margin: 20px 0;">Nenhum produto encontrado para "<strong>${q}</strong>". Tente outro termo.</p>`;
        return;
      }

      resultsBox.innerHTML = matches.map(k => {
        const p = catalog[k];
        const price = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.price || 79.99);
        const img = (p.images && p.images.length > 0) ? p.images[0] : 'https://via.placeholder.com/60';
        return `
          <a href="produto.html?id=${p.handle}" class="cro-search-item">
            <img src="${img}" alt="${p.title}" class="cro-search-item-img">
            <div class="cro-search-item-info">
              <div class="cro-search-item-title">${p.title}</div>
              <div class="cro-search-item-price">${price}</div>
            </div>
          </a>
        `;
      }).join('');
    },

    bindSearchTriggers() {
      document.addEventListener('click', (e) => {
        const searchBtn = e.target.closest('[data-action="open-search"], .header__icon--search, a[href*="#buscar"], .cv-header-icon-btn[aria-label="Buscar"]');
        if (searchBtn) {
          e.preventDefault();
          this.open();
        }
      });
    }
  };

  window.SearchManager = SearchManager;

  // --------------------------------------------------------------------------
  // 6. NAVEGAÇÃO, COLEÇÕES E INTERCEPTAÇÕES
  // --------------------------------------------------------------------------
  function initProductNavigation() {
    // Abrir carrinho ao clicar em qualquer botão/sacola do site
    document.querySelectorAll('.cart-link, .header__icon--cart, .cart-bubble, .header__cart, .header__icon, [data-testid="cart-icon"], [on\\:click*="/open"], #header-cart-toggle, #open-cart-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        CartDrawer.open();
      });
    });

    // Interceptação global de cliques para navegação segura e fluida
    document.addEventListener('click', (e) => {
      // 1. Navegação para página de Coleções (colecao.html?cat=slug)
      const colLink = e.target.closest('a[href*="/collections/"]');
      if (colLink) {
        const href = colLink.getAttribute('href');
        if (href && href.includes('/collections/')) {
          e.preventDefault();
          const slug = href.split('/collections/')[1].split('?')[0].split('#')[0];
          window.location.href = `colecao.html?cat=${slug || 'natal'}`;
          return;
        }
      }

      // 2. Clique em links com /products/ ou produto.html
      const prodLink = e.target.closest('a[href*="/products/"], a[href*="produto.html"]');
      if (prodLink) {
        // Se for clique no botão de compra rápida, não executa navegação
        if (e.target.closest('.cro-quick-add-btn')) return;

        const href = prodLink.getAttribute('href');
        let handle = '';
        if (href.includes('/products/')) {
          handle = href.split('/products/')[1].split('?')[0].split('#')[0];
        } else if (href.includes('id=')) {
          handle = href.split('id=')[1].split('&')[0];
        }

        if (handle) {
          e.preventDefault();
          window.location.href = `produto.html?id=${handle}`;
          return;
        }
      }

      // 3. Clique no card de produto (.product-card) fora de controles
      const card = e.target.closest('.product-card, .cv-product-card, .cv-rec-card');
      const isControl = e.target.closest('button.slideshow-control, .quick-add, .cro-quick-add-btn');
      if (card && !isControl) {
        const linkInCard = card.querySelector('a[href*="/products/"], a[href*="produto.html"]');
        if (linkInCard) {
          e.preventDefault();
          const href = linkInCard.getAttribute('href');
          let handle = '';
          if (href.includes('/products/')) {
            handle = href.split('/products/')[1].split('?')[0].split('#')[0];
          } else if (href.includes('id=')) {
            handle = href.split('id=')[1].split('&')[0];
          }
          if (handle) {
            window.location.href = `produto.html?id=${handle}`;
            return;
          }
        }
      }
    });
  }

  // --------------------------------------------------------------------------
  // 7. INICIALIZAÇÃO
  // --------------------------------------------------------------------------
  function initializeAppSuite() {
    try { CartState.init(); } catch (e) { console.error('CartState init err:', e); }
    try { CartDrawer.build(); } catch (e) { console.error('CartDrawer build err:', e); }
    try { QuickAdd.init(); } catch (e) { console.error('QuickAdd init err:', e); }
    try { ModalManager.init(); } catch (e) { console.error('ModalManager init err:', e); }
    try { SearchManager.init(); } catch (e) { console.error('SearchManager init err:', e); }
    try { initProductNavigation(); } catch (e) { console.error('initProductNavigation err:', e); }

    if (typeof window !== 'undefined' && window.location && window.location.hash && window.location.hash.includes('produto') && !window.location.pathname.includes('produto.html')) {
      setTimeout(() => {
        const target = document.getElementById('cv_produtos') || document.querySelector('.resource-list-grid');
        if (target) target.scrollIntoView({ behavior: 'smooth' });
      }, 300);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAppSuite);
  } else {
    initializeAppSuite();
  }

})();
