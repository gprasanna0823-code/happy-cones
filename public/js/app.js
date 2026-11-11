/**
 * HAPPY CONES - Customer Web App Logic
 * QR-Based Ordering System (Pages 1 to 5)
 */

// Application State
const state = {
  products: [],
  categories: [
    'All',
    'Cone Ice Cream',
    'Stick Ice Cream',
    'Cup Ice Cream',
    'Kulfi Ice Cream',
    'Chocolate Ice Cream',
    'Sundae Ice Cream',
    'Family Pack Ice Cream',
    'Special Ice Cream'
  ],
  activeCategory: 'All',
  searchQuery: '',
  vegOnly: false,
  
  // Cart
  cart: [],
  discountCode: '',
  discountPercent: 0,
  
  // Active product in customization modal
  modalProduct: null,
  modalSelectedFlavour: '',
  modalSelectedSize: null,
  modalSelectedToppings: [],
  modalQuantity: 1,
  
  // Active Order & Live Tracking
  activeOrder: null,
  trackingInterval: null,
  
  // Settings
  settings: {
    shopName: 'HAPPY CONES',
    upiId: '9344232175@ptyes',
    payeeName: 'HAPPY CONES (Prasanna G)',
    ownerWhatsApp: '919344232175'
  }
};

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Load Cart from localStorage
  const savedCart = localStorage.getItem('happycones_cart');
  if (savedCart) {
    try { state.cart = JSON.parse(savedCart); } catch (e) { state.cart = []; }
  }

  // 2. Load Active Order from localStorage
  const savedOrder = localStorage.getItem('happycones_active_order');
  if (savedOrder) {
    try {
      state.activeOrder = JSON.parse(savedOrder);
      const trackBtn = document.getElementById('headerTrackBtn');
      if (trackBtn) trackBtn.classList.remove('hidden');
    } catch (e) {}
  }

  // 3. Fetch Products & Settings
  await loadShopSettings();
  await loadProducts();

  // 4. Render UI
  renderCategoryTabs();
  renderProducts();
  updateCartUI();

  // 5. Initialize Lucide icons
  if (window.lucide) lucide.createIcons();
});

// Load Shop Settings
async function loadShopSettings() {
  try {
    const res = await fetch('/api/settings');
    if (res.ok) {
      const data = await res.json();
      state.settings = { ...state.settings, ...data };
      const upiDisplay = document.getElementById('shopUpiIdDisplay');
      if (upiDisplay) upiDisplay.textContent = state.settings.upiId;
      const payeeDisplay = document.getElementById('payeeNameDisplay');
      if (payeeDisplay) payeeDisplay.textContent = `${state.settings.shopName} (${state.settings.payeeName || 'Prasanna G'})`;
    }
  } catch (err) {
    console.warn('Using default settings', err);
  }
}

// Load Products from API
async function loadProducts() {
  try {
    const res = await fetch('/api/products');
    if (res.ok) {
      const data = await res.json();
      state.products = data.products || [];
    }
  } catch (err) {
    console.error('Error loading products', err);
  }
}

// Render Category Filter Pills
function renderCategoryTabs() {
  const container = document.getElementById('categoryTabsContainer');
  if (!container) return;

  const categoryIcons = {
    'All': '✨',
    'Cone Ice Cream': '🍦',
    'Stick Ice Cream': '🍧',
    'Cup Ice Cream': '🍨',
    'Kulfi Ice Cream': '🪵',
    'Chocolate Ice Cream': '🍫',
    'Sundae Ice Cream': '🍒',
    'Family Pack Ice Cream': '📦',
    'Special Ice Cream': '✨'
  };

  container.innerHTML = state.categories.map(cat => {
    const isActive = state.activeCategory === cat;
    const icon = categoryIcons[cat] || '🍨';
    return `
      <button onclick="selectCategory('${cat}')" class="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
        isActive 
          ? 'bg-gradient-to-r from-brand-500 to-rose-500 text-white shadow-md shadow-brand-500/20 scale-105' 
          : 'bg-white text-stone-700 hover:bg-pink-50 border border-pink-100'
      }">
        <span>${icon}</span>
        <span>${cat}</span>
      </button>
    `;
  }).join('');
}

// Category Selection
function selectCategory(category) {
  state.activeCategory = category;
  renderCategoryTabs();
  renderProducts();

  const heading = document.getElementById('activeCategoryHeading');
  if (heading) heading.textContent = category === 'All' ? 'All Ice Creams' : category;
}

function resetCategoryFilter() {
  state.activeCategory = 'All';
  state.searchQuery = '';
  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.value = '';
  renderCategoryTabs();
  renderProducts();
}

// Search Filter
function handleSearch(val) {
  state.searchQuery = val.trim().toLowerCase();
  const clearBtn = document.getElementById('clearSearchBtn');
  if (clearBtn) {
    clearBtn.classList.toggle('hidden', state.searchQuery.length === 0);
  }
  renderProducts();
}

function clearSearch() {
  state.searchQuery = '';
  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.value = '';
  const clearBtn = document.getElementById('clearSearchBtn');
  if (clearBtn) clearBtn.classList.add('hidden');
  renderProducts();
}

// Toggle Veg Only Filter
function toggleVegOnly() {
  state.vegOnly = !state.vegOnly;
  const btn = document.getElementById('vegFilterBtn');
  if (btn) {
    btn.classList.toggle('bg-emerald-500', state.vegOnly);
    btn.classList.toggle('text-white', state.vegOnly);
    btn.classList.toggle('border-emerald-600', state.vegOnly);
  }
  renderProducts();
}

// Render Products Grid (PAGE 1)
function renderProducts() {
  const grid = document.getElementById('productsGrid');
  const emptyState = document.getElementById('noProductsFound');
  const countText = document.getElementById('productsCountText');
  if (!grid) return;

  // Filter products
  const filtered = state.products.filter(item => {
    const matchesCategory = state.activeCategory === 'All' || item.category === state.activeCategory;
    const matchesSearch = !state.searchQuery || 
      item.name.toLowerCase().includes(state.searchQuery) ||
      item.description.toLowerCase().includes(state.searchQuery) ||
      (item.flavours && item.flavours.some(f => f.toLowerCase().includes(state.searchQuery)));
    const matchesVeg = !state.vegOnly || item.isVeg;
    return matchesCategory && matchesSearch && matchesVeg;
  });

  if (countText) {
    countText.textContent = `Showing ${filtered.length} delicious treat${filtered.length === 1 ? '' : 's'}`;
  }

  if (filtered.length === 0) {
    grid.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');

  grid.innerHTML = filtered.map(item => {
    return `
      <div class="ice-card bg-white rounded-3xl overflow-hidden border border-pink-100 shadow-sm hover:border-pink-300 flex flex-col justify-between group">
        
        <!-- Product Image & Badges -->
        <div class="relative h-48 w-full overflow-hidden bg-pink-50">
          <img src="${item.image}" alt="${item.name}" loading="lazy" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500">
          <div class="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
          
          <!-- Rating & Veg Indicator -->
          <div class="absolute top-3 left-3 flex items-center gap-1.5">
            <span class="w-5 h-5 rounded-md bg-white/90 backdrop-blur-md border border-emerald-500 flex items-center justify-center p-0.5">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
            </span>
            ${item.badge ? `<span class="px-2.5 py-0.5 rounded-full bg-brand-500 text-white text-[10px] font-black uppercase tracking-wider shadow-sm">${item.badge}</span>` : ''}
          </div>

          <div class="absolute top-3 right-3 bg-white/90 backdrop-blur-md px-2 py-0.5 rounded-xl text-stone-800 text-xs font-bold flex items-center gap-1 shadow-sm">
            <span>⭐</span>
            <span>${item.rating || '4.9'}</span>
          </div>

          <div class="absolute bottom-2.5 left-3 text-white">
            <span class="text-[10px] uppercase font-extrabold tracking-wider bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-lg">${item.category}</span>
          </div>
        </div>

        <!-- Product Details -->
        <div class="p-4 flex-1 flex flex-col justify-between space-y-3">
          <div>
            <h3 class="font-extrabold text-choco-900 text-base leading-snug font-heading group-hover:text-brand-600 transition-colors">${item.name}</h3>
            <p class="text-xs text-stone-500 line-clamp-2 mt-1 leading-relaxed font-medium">${item.description}</p>
          </div>

          <!-- Price & Order / Customize Button -->
          <div class="pt-2 border-t border-stone-100 flex items-center justify-between gap-2">
            <div>
              <span class="text-[10px] text-stone-400 block font-semibold">Starting from</span>
              <span class="text-lg font-black text-brand-600 font-heading">₹${item.price}</span>
            </div>

            ${item.inStock ? `
              <button onclick="openProductModal('${item.id}')" class="px-4 py-2 rounded-xl bg-pink-100 hover:bg-brand-500 text-brand-700 hover:text-white font-extrabold text-xs transition-all duration-200 shadow-sm flex items-center gap-1 btn-bounce">
                <span>Select</span>
                <i data-lucide="plus" class="w-3.5 h-3.5"></i>
              </button>
            ` : `
              <span class="px-3 py-1.5 rounded-xl bg-stone-100 text-stone-400 text-xs font-bold">Sold Out</span>
            `}
          </div>
        </div>

      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

// ========================================================
// PAGE 2: PRODUCT CUSTOMIZATION MODAL LOGIC
// ========================================================

function openProductModal(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;

  state.modalProduct = product;
  state.modalSelectedFlavour = product.flavours && product.flavours.length ? product.flavours[0] : 'Classic';
  state.modalSelectedSize = product.sizes && product.sizes.length ? product.sizes[0] : { name: 'Regular', extra: 0 };
  state.modalSelectedToppings = [];
  state.modalQuantity = 1;

  // Populate Modal Fields
  document.getElementById('modalProductImage').src = product.image;
  document.getElementById('modalProductName').textContent = product.name;
  document.getElementById('modalProductDesc').textContent = product.description;
  document.getElementById('modalProductBadge').textContent = product.badge || product.category;
  document.getElementById('modalProductRating').textContent = product.rating || '4.9';
  document.getElementById('modalBasePrice').textContent = `₹${product.price}`;
  document.getElementById('modalInstructions').value = '';
  document.getElementById('modalQuantity').textContent = '1';

  // Render Flavours
  const flavoursContainer = document.getElementById('modalFlavoursList');
  if (product.flavours && product.flavours.length) {
    document.getElementById('modalFlavoursSection').classList.remove('hidden');
    flavoursContainer.innerHTML = product.flavours.map((flavour, idx) => `
      <label class="flex items-center gap-2 p-2.5 rounded-xl border border-stone-200 hover:border-brand-500 cursor-pointer transition-all bg-white text-xs font-semibold">
        <input type="radio" name="modalFlavour" value="${flavour}" ${idx === 0 ? 'checked' : ''} onchange="setModalFlavour('${flavour}')" class="text-brand-500 focus:ring-brand-500">
        <span class="text-stone-800">${flavour}</span>
      </label>
    `).join('');
  } else {
    document.getElementById('modalFlavoursSection').classList.add('hidden');
  }

  // Render Sizes
  const sizesContainer = document.getElementById('modalSizesList');
  if (product.sizes && product.sizes.length) {
    document.getElementById('modalSizesSection').classList.remove('hidden');
    sizesContainer.innerHTML = product.sizes.map((size, idx) => `
      <label class="flex items-center justify-between p-2.5 rounded-xl border border-stone-200 hover:border-brand-500 cursor-pointer transition-all bg-white text-xs font-semibold">
        <div class="flex items-center gap-2">
          <input type="radio" name="modalSize" value="${size.name}" ${idx === 0 ? 'checked' : ''} onchange="setModalSize('${size.name}', ${size.extra})" class="text-brand-500 focus:ring-brand-500">
          <span class="text-stone-800">${size.name}</span>
        </div>
        <span class="text-stone-500 font-bold">${size.extra > 0 ? `+₹${size.extra}` : 'Included'}</span>
      </label>
    `).join('');
  } else {
    document.getElementById('modalSizesSection').classList.add('hidden');
  }

  // Render Toppings
  const toppingsContainer = document.getElementById('modalToppingsList');
  if (product.toppings && product.toppings.length) {
    document.getElementById('modalToppingsSection').classList.remove('hidden');
    toppingsContainer.innerHTML = product.toppings.map(topping => `
      <label class="flex items-center justify-between p-2.5 rounded-xl border border-stone-200 hover:border-brand-500 cursor-pointer transition-all bg-white text-xs font-semibold">
        <div class="flex items-center gap-2">
          <input type="checkbox" value="${topping.name}" onchange="toggleModalTopping('${topping.name}', ${topping.price}, this.checked)" class="rounded text-brand-500 focus:ring-brand-500">
          <span class="text-stone-800">${topping.name}</span>
        </div>
        <span class="text-stone-500 font-bold">+₹${topping.price}</span>
      </label>
    `).join('');
  } else {
    document.getElementById('modalToppingsSection').classList.add('hidden');
  }

  updateModalPrice();

  // Show Modal with Animation
  const modal = document.getElementById('productModal');
  const card = document.getElementById('productModalCard');
  modal.classList.remove('opacity-0', 'pointer-events-none');
  card.classList.remove('translate-y-full', 'sm:translate-y-8');
}

function closeProductModal() {
  const modal = document.getElementById('productModal');
  const card = document.getElementById('productModalCard');
  modal.classList.add('opacity-0', 'pointer-events-none');
  card.classList.add('translate-y-full', 'sm:translate-y-8');
  state.modalProduct = null;
}

function setModalFlavour(flavour) {
  state.modalSelectedFlavour = flavour;
}

function setModalSize(name, extra) {
  state.modalSelectedSize = { name, extra };
  updateModalPrice();
}

function toggleModalTopping(name, price, isChecked) {
  if (isChecked) {
    state.modalSelectedToppings.push({ name, price });
  } else {
    state.modalSelectedToppings = state.modalSelectedToppings.filter(t => t.name !== name);
  }
  updateModalPrice();
}

function incrementModalQty() {
  state.modalQuantity++;
  document.getElementById('modalQuantity').textContent = state.modalQuantity;
  updateModalPrice();
}

function decrementModalQty() {
  if (state.modalQuantity > 1) {
    state.modalQuantity--;
    document.getElementById('modalQuantity').textContent = state.modalQuantity;
    updateModalPrice();
  }
}

function calculateModalItemUnitPrice() {
  if (!state.modalProduct) return 0;
  let price = state.modalProduct.price;
  if (state.modalSelectedSize && state.modalSelectedSize.extra) {
    price += state.modalSelectedSize.extra;
  }
  state.modalSelectedToppings.forEach(t => {
    price += t.price;
  });
  return price;
}

function updateModalPrice() {
  const unitPrice = calculateModalItemUnitPrice();
  const totalPrice = unitPrice * state.modalQuantity;
  const finalPriceEl = document.getElementById('modalFinalPrice');
  if (finalPriceEl) finalPriceEl.textContent = `₹${totalPrice}`;
}

// Web Audio Sound Effects Synthesizer (Zero audio files needed, works offline)
const SoundFX = {
  ctx: null,
  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
  },
  playPop() {
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(450, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.09);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.1);
    } catch (e) {}
  },
  playCoinChime() {
    try {
      this.init();
      if (!this.ctx) return;
      const notes = [987.77, 1318.51]; // B5, E6
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.08);
        gain.gain.setValueAtTime(0.25, this.ctx.currentTime + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + idx * 0.08 + 0.35);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(this.ctx.currentTime + idx * 0.08);
        osc.stop(this.ctx.currentTime + idx * 0.08 + 0.4);
      });
    } catch (e) {}
  },
  playFanfare() {
    try {
      this.init();
      if (!this.ctx) return;
      const chord = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      chord.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.07);
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + idx * 0.07 + 0.5);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(this.ctx.currentTime + idx * 0.07);
        osc.stop(this.ctx.currentTime + idx * 0.07 + 0.6);
      });
    } catch (e) {}
  }
};

// Add Item to Cart
function confirmAddToCart() {
  if (!state.modalProduct) return;

  const unitPrice = calculateModalItemUnitPrice();
  const instructions = document.getElementById('modalInstructions').value.trim();

  const cartItem = {
    cartItemId: 'ci-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
    productId: state.modalProduct.id,
    name: state.modalProduct.name,
    image: state.modalProduct.image,
    category: state.modalProduct.category,
    flavour: state.modalSelectedFlavour,
    size: state.modalSelectedSize ? state.modalSelectedSize.name : 'Regular',
    toppings: [...state.modalSelectedToppings],
    instructions: instructions,
    unitPrice: unitPrice,
    quantity: state.modalQuantity,
    totalPrice: unitPrice * state.modalQuantity
  };

  state.cart.push(cartItem);
  saveCart();
  updateCartUI();
  closeProductModal();

  SoundFX.playPop();
  showToast(`🍦 Added ${cartItem.quantity}x ${cartItem.name} to tray!`);
}

// ========================================================
// PAGE 3: CART & ORDER SUMMARY LOGIC
// ========================================================

function saveCart() {
  localStorage.setItem('happycones_cart', JSON.stringify(state.cart));
}

function updateCartUI() {
  const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = state.cart.reduce((sum, item) => sum + item.totalPrice, 0);
  const discountAmount = Math.round((subtotal * state.discountPercent) / 100);
  const grandTotal = Math.max(0, subtotal - discountAmount);

  // Update Header Badges
  const headerCount = document.getElementById('headerCartCount');
  const headerTotal = document.getElementById('headerCartTotal');
  if (headerCount) headerCount.textContent = count;
  if (headerTotal) headerTotal.textContent = `₹${grandTotal}`;

  // Update Floating Bottom Bar
  const bottomBar = document.getElementById('floatingBottomBar');
  const floatCount = document.getElementById('floatingCartCount');
  const floatTotal = document.getElementById('floatingCartTotal');
  if (bottomBar) {
    if (count > 0) {
      bottomBar.classList.remove('translate-y-24', 'opacity-0', 'pointer-events-none');
      if (floatCount) floatCount.textContent = count;
      if (floatTotal) floatTotal.textContent = `₹${grandTotal}`;
    } else {
      bottomBar.classList.add('translate-y-24', 'opacity-0', 'pointer-events-none');
    }
  }

  // Update Cart Modal Content if open
  renderCartModalItems(subtotal, discountAmount, grandTotal);
}

function openCartModal() {
  updateCartUI();
  const modal = document.getElementById('cartModal');
  const card = document.getElementById('cartModalCard');
  modal.classList.remove('opacity-0', 'pointer-events-none');
  card.classList.remove('translate-y-full', 'sm:translate-y-8');
}

function closeCartModal() {
  const modal = document.getElementById('cartModal');
  const card = document.getElementById('cartModalCard');
  modal.classList.add('opacity-0', 'pointer-events-none');
  card.classList.add('translate-y-full', 'sm:translate-y-8');
}

function renderCartModalItems(subtotal, discountAmount, grandTotal) {
  const itemsContainer = document.getElementById('cartItemsList');
  const emptyState = document.getElementById('cartEmptyState');
  const formSection = document.getElementById('cartFormSection');
  const billSection = document.getElementById('cartBillSection');
  const actionContainer = document.getElementById('cartActionBtnContainer');

  if (!itemsContainer) return;

  if (state.cart.length === 0) {
    itemsContainer.innerHTML = '';
    emptyState.classList.remove('hidden');
    formSection.classList.add('hidden');
    billSection.classList.add('hidden');
    actionContainer.classList.add('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  formSection.classList.remove('hidden');
  billSection.classList.remove('hidden');
  actionContainer.classList.remove('hidden');

  itemsContainer.innerHTML = state.cart.map((item, index) => {
    const toppingsStr = item.toppings && item.toppings.length 
      ? item.toppings.map(t => `+${t.name}`).join(', ')
      : '';

    return `
      <div class="flex items-center justify-between gap-3 p-3 rounded-2xl border border-pink-100 bg-pink-50/40 hover:bg-pink-50 transition-colors">
        
        <!-- Thumbnail -->
        <img src="${item.image}" alt="${item.name}" class="w-14 h-14 rounded-xl object-cover border border-pink-200 flex-shrink-0">

        <!-- Item Info -->
        <div class="flex-1 min-w-0">
          <h4 class="text-xs font-black text-choco-900 truncate">${item.name}</h4>
          <div class="text-[11px] text-stone-500 flex flex-wrap items-center gap-1 mt-0.5">
            <span class="font-bold text-brand-600">${item.flavour}</span>
            <span>•</span>
            <span>${item.size}</span>
          </div>
          ${toppingsStr ? `<div class="text-[10px] text-amber-700 font-medium truncate mt-0.5">${toppingsStr}</div>` : ''}
          ${item.instructions ? `<div class="text-[10px] text-stone-400 italic truncate mt-0.5">"${item.instructions}"</div>` : ''}
          <div class="text-xs font-black text-choco-900 mt-1">₹${item.totalPrice} <span class="text-[10px] text-stone-400 font-normal">(₹${item.unitPrice} each)</span></div>
        </div>

        <!-- Stepper & Delete -->
        <div class="flex flex-col items-end gap-1.5 flex-shrink-0">
          <button onclick="removeCartItem('${item.cartItemId}')" class="text-stone-400 hover:text-rose-600 p-1 transition-colors" title="Remove item">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
          
          <div class="flex items-center border border-pink-200 bg-white rounded-xl p-0.5">
            <button onclick="updateCartItemQty('${item.cartItemId}', -1)" class="w-6 h-6 rounded-lg hover:bg-pink-100 text-choco-900 font-black flex items-center justify-center transition-colors">
              -
            </button>
            <span class="w-6 text-center font-bold text-xs">${item.quantity}</span>
            <button onclick="updateCartItemQty('${item.cartItemId}', 1)" class="w-6 h-6 rounded-lg hover:bg-pink-100 text-choco-900 font-black flex items-center justify-center transition-colors">
              +
            </button>
          </div>
        </div>

      </div>
    `;
  }).join('');

  // Update Bill summary
  document.getElementById('billSubtotal').textContent = `₹${subtotal}`;
  const discountRow = document.getElementById('billDiscountRow');
  if (state.discountPercent > 0) {
    discountRow.classList.remove('hidden');
    document.getElementById('billDiscount').textContent = `-₹${discountAmount} (${state.discountPercent}%)`;
  } else {
    discountRow.classList.add('hidden');
  }
  document.getElementById('billGrandTotal').textContent = `₹${grandTotal}`;

  if (window.lucide) lucide.createIcons();
}

function updateCartItemQty(cartItemId, delta) {
  const item = state.cart.find(i => i.cartItemId === cartItemId);
  if (!item) return;

  item.quantity += delta;
  if (item.quantity <= 0) {
    state.cart = state.cart.filter(i => i.cartItemId !== cartItemId);
  } else {
    item.totalPrice = item.unitPrice * item.quantity;
  }

  saveCart();
  updateCartUI();
}

function removeCartItem(cartItemId) {
  state.cart = state.cart.filter(i => i.cartItemId !== cartItemId);
  saveCart();
  updateCartUI();
  showToast('Item removed from tray');
}

// Promo Code logic
function applyPromoCode() {
  const input = document.getElementById('promoCodeInput');
  const msg = document.getElementById('promoMessage');
  if (!input || !msg) return;

  const code = input.value.trim().toUpperCase();
  if (code === 'HAPPY10') {
    state.discountCode = 'HAPPY10';
    state.discountPercent = 10;
    msg.textContent = '🎉 Coupon HAPPY10 Applied! 10% Discount saved!';
    msg.className = 'text-[11px] font-bold text-emerald-600 block';
  } else {
    state.discountCode = '';
    state.discountPercent = 0;
    msg.textContent = '❌ Invalid coupon code. Try HAPPY10';
    msg.className = 'text-[11px] font-bold text-rose-500 block';
  }
  updateCartUI();
}

// ========================================================
// PAGE 4: GOOGLE PAY / UPI PAYMENT LOGIC
// ========================================================

async function proceedToPaymentPage() {
  if (state.cart.length === 0) return;

  const customerName = document.getElementById('customerNameInput').value.trim() || 'Customer';
  const customerPhone = document.getElementById('customerPhoneInput').value.trim() || '';

  const subtotal = state.cart.reduce((sum, item) => sum + item.totalPrice, 0);
  const discountAmount = Math.round((subtotal * state.discountPercent) / 100);
  const grandTotal = Math.max(0, subtotal - discountAmount);

  // 1. Create Order on Server
  try {
    const btn = document.getElementById('confirmOrderBtn');
    btn.disabled = true;
    btn.innerHTML = `<span class="inline-block animate-spin mr-2">⏳</span> Creating Order...`;

    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName,
        customerPhone,
        tableNumber: 'Direct Order',
        orderType: 'Takeaway',
        items: state.cart,
        subtotal,
        discount: discountAmount,
        tax: 0,
        total: grandTotal
      })
    });

    btn.disabled = false;
    btn.innerHTML = `<span>Confirm Order &amp; Proceed to Pay</span>`;

    if (!res.ok) throw new Error('Failed to create order');
    const data = await res.json();
    state.activeOrder = data.order;
    localStorage.setItem('happycones_active_order', JSON.stringify(state.activeOrder));

    // Show Track button on header
    const trackBtn = document.getElementById('headerTrackBtn');
    if (trackBtn) trackBtn.classList.remove('hidden');

    // Close Cart & Open Payment Modal
    closeCartModal();
    openPaymentModal(state.activeOrder);

  } catch (err) {
    const btn = document.getElementById('confirmOrderBtn');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<span>Confirm Order &amp; Proceed to Pay</span>`;
    }
    alert('Could not create order. Please try again.');
    console.error(err);
  }
}

let currentUpiUri = '';

function openPaymentModal(order) {
  const modal = document.getElementById('paymentModal');
  const card = document.getElementById('paymentModalCard');

  // Populate Payment Information
  document.getElementById('paymentTotalAmount').textContent = `₹${order.total}`;
  const qrBadge = document.getElementById('qrAmountBadge');
  if (qrBadge) qrBadge.textContent = order.total;
  document.getElementById('paymentOrderIdDisplay').textContent = `#${order.id}`;
  document.getElementById('shopUpiIdDisplay').textContent = state.settings.upiId || '9344232175@ptyes';

  // Build Dynamic UPI URI with EXACT pre-filled amount (Concise for fast crisp QR scanning)
  const upiId = state.settings.upiId || '9344232175@ptyes';
  const payeeEncoded = encodeURIComponent(state.settings.shopName || 'HAPPY CONES');
  const tnEncoded = encodeURIComponent(`Order ${order.id}`);
  const amtParam = Number(order.total) > 0 ? `&am=${Number(order.total)}` : '';
  currentUpiUri = `upi://pay?pa=${upiId}&pn=${payeeEncoded}${amtParam}&cu=INR&tn=${tnEncoded}`;

  // Generate Dynamic QR Code Canvas with 4-module quiet zone & exact amount
  const dynamicCanvasContainer = document.getElementById('dynamicQrCanvasDiv');
  if (dynamicCanvasContainer && window.generateQRCodeCanvas) {
    dynamicCanvasContainer.innerHTML = '';
    window.generateQRCodeCanvas(dynamicCanvasContainer, currentUpiUri, { size: 240 });
  }

  modal.classList.remove('opacity-0', 'pointer-events-none');
  card.classList.remove('translate-y-full', 'sm:translate-y-8');
}

function closePaymentModal() {
  const modal = document.getElementById('paymentModal');
  const card = document.getElementById('paymentModalCard');
  modal.classList.add('opacity-0', 'pointer-events-none');
  card.classList.add('translate-y-full', 'sm:translate-y-8');
}

function launchUPI(appName) {
  if (!currentUpiUri) return;
  const order = state.activeOrder;
  const upiId = state.settings.upiId || '9344232175@ptyes';
  const payeeEncoded = encodeURIComponent(state.settings.shopName || 'HAPPY CONES');
  const amt = order ? Number(order.total) : '';
  const id = order ? order.id : '';
  const amtParam = amt > 0 ? `&am=${amt}` : '';
  const params = `pa=${upiId}&pn=${payeeEncoded}${amtParam}&cu=INR&tn=${encodeURIComponent('Order ' + id)}`;

  if (appName === 'famapp') {
    // FamApp / FamPay deep link
    window.location.href = `famapp://upi/pay?${params}`;
    setTimeout(() => {
      if (!document.hidden) window.location.href = currentUpiUri;
    }, 900);
  } else if (appName === 'gpay') {
    window.location.href = `intent://pay?${params}#Intent;scheme=upi;package=com.google.android.apps.nbu.paisa.user;end`;
    setTimeout(() => {
      if (!document.hidden) window.location.href = currentUpiUri;
    }, 900);
  } else if (appName === 'phonepe') {
    window.location.href = `phonepe://pay?${params}`;
    setTimeout(() => {
      if (!document.hidden) window.location.href = currentUpiUri;
    }, 900);
  } else if (appName === 'paytm') {
    window.location.href = `paytmmp://pay?${params}`;
    setTimeout(() => {
      if (!document.hidden) window.location.href = currentUpiUri;
    }, 900);
  } else {
    // Generic Any UPI App
    window.location.href = currentUpiUri;
  }
}

function toggleShopQrModal() {
  const modal = document.getElementById('shopQrModal');
  if (!modal) return;
  const isOpen = !modal.classList.contains('opacity-0');
  if (isOpen) {
    modal.classList.add('opacity-0', 'pointer-events-none');
  } else {
    modal.classList.remove('opacity-0', 'pointer-events-none');
  }
}

function copyUpiId() {
  const upiId = state.settings.upiId || '9344232175@ptyes';
  navigator.clipboard.writeText(upiId).then(() => {
    const copyText = document.getElementById('copyUpiText');
    if (copyText) copyText.textContent = 'Copied! ✅';
    showToast('UPI ID copied to clipboard');
    setTimeout(() => {
      if (copyText) copyText.textContent = 'Copy';
    }, 2500);
  }).catch(() => {
    showToast(`UPI ID: ${upiId}`);
  });
}

// 1-Click Payment Completed (NO typing, NO UTR reference required!)
async function submitPaymentVerification() {
  if (!state.activeOrder) return;

  const btn = document.getElementById('submitPaymentBtn');
  btn.disabled = true;
  btn.innerHTML = `<span class="inline-block animate-spin mr-2">⏳</span> Confirming Order...`;

  try {
    const res = await fetch(`/api/orders/${state.activeOrder.id}/payment`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ upiRef: 'UPI-Paid (No-UTR)' })
    });

    btn.disabled = false;
    btn.innerHTML = `<i data-lucide="check-circle" class="w-5 h-5"></i><span>Payment Completed ✅</span>`;

    if (!res.ok) throw new Error('Payment confirmation failed');
    const data = await res.json();
    state.activeOrder = data.order;
    localStorage.setItem('happycones_active_order', JSON.stringify(state.activeOrder));

    // Clear cart once order is placed & paid
    state.cart = [];
    saveCart();
    updateCartUI();

    // Close Payment Modal & Open Confirmation Modal
    closePaymentModal();
    openConfirmationModal(state.activeOrder);

    // Fire Confetti & Sound!
    triggerConfetti();
    SoundFX.playCoinChime();

    // Automatically send order confirmation to shop owner's WhatsApp: 9344232175
    sendOrderToOwnerWhatsApp(state.activeOrder);

  } catch (err) {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="check-circle" class="w-5 h-5"></i><span>Payment Completed ✅</span>`;
      if (window.lucide) lucide.createIcons();
    }
    alert('Could not submit payment. Please try again.');
    console.error(err);
  }
}

// ========================================================
// PAGE 5: ORDER CONFIRMATION & LIVE TRACKING LOGIC
// ========================================================

function buildWhatsAppOrderMessage(o) {
  const itemsText = o.items.map(i => `• ${i.quantity}x ${i.name} (${i.flavour}, ${i.size}) - ₹${i.totalPrice}`).join('\n');
  return `🍦 *HAPPY CONES - NEW PAID ORDER!* 🍦\n` +
         `━━━━━━━━━━━━━━━━━━━━\n` +
         `*Order ID:* #${o.id}\n` +
         `*Customer Name:* ${o.customerName || 'Customer'}\n` +
         `*Customer Mobile:* ${o.customerPhone || 'Not provided'}\n` +
         `━━━━━━━━━━━━━━━━━━━━\n` +
         `*Ordered Ice Creams:*\n` +
         `${itemsText}\n` +
         `━━━━━━━━━━━━━━━━━━━━\n` +
         `*Grand Total Paid:* ₹${o.total}\n` +
         `*Payment Method:* FamApp / GPay / PhonePe / Paytm / UPI (Exact Amount)\n` +
         `━━━━━━━━━━━━━━━━━━━━\n` +
         `✅ *PAYMENT COMPLETED & VERIFIED!*\n` +
         `Please start preparing delicious ice cream! ❤️`;
}

function sendOrderToOwnerWhatsApp(order) {
  if (!order) return;
  const ownerWhatsApp = '919344232175';
  const msg = buildWhatsAppOrderMessage(order);
  const waUrl = `https://api.whatsapp.com/send?phone=${ownerWhatsApp}&text=${encodeURIComponent(msg)}`;
  
  const directLink = document.getElementById('directWhatsAppLink');
  if (directLink) directLink.href = waUrl;

  // Automatically trigger WhatsApp
  setTimeout(() => {
    try {
      const w = window.open(waUrl, '_blank');
      if (!w) window.location.href = waUrl;
    } catch (e) {
      window.location.href = waUrl;
    }
  }, 400);
}

function openConfirmationModal(order) {
  const modal = document.getElementById('confirmationModal');
  const card = document.getElementById('confirmationModalCard');

  // Fill in confirmation details
  document.getElementById('confirmOrderId').textContent = `#${order.id}`;
  document.getElementById('confirmTotalPaid').textContent = `₹${order.total}`;
  document.getElementById('confirmPaymentRefText').textContent = 'Paid via FamApp / Google Pay / UPI (Exact Amount)';

  // Configure direct WhatsApp link for owner 9344232175
  const ownerWhatsApp = '919344232175';
  const msg = buildWhatsAppOrderMessage(order);
  const waUrl = `https://api.whatsapp.com/send?phone=${ownerWhatsApp}&text=${encodeURIComponent(msg)}`;
  const directLink = document.getElementById('directWhatsAppLink');
  if (directLink) directLink.href = waUrl;

  // Render ordered items summary
  const itemsContainer = document.getElementById('confirmItemsList');
  if (itemsContainer) {
    itemsContainer.innerHTML = order.items.map(i => `
      <div class="flex items-center justify-between text-xs p-2 rounded-xl bg-white border border-stone-100">
        <div class="flex items-center gap-2">
          <span class="font-extrabold text-brand-600">${i.quantity}x</span>
          <span class="font-bold text-choco-900">${i.name}</span>
          <span class="text-[10px] text-stone-400">(${i.flavour}, ${i.size})</span>
        </div>
        <span class="font-bold text-stone-700">₹${i.totalPrice}</span>
      </div>
    `).join('');
  }

  // Update Status Steps
  updateStatusTrackerUI(order.status);

  modal.classList.remove('opacity-0', 'pointer-events-none');
  card.classList.remove('translate-y-full', 'sm:translate-y-8');

  // Start polling for real-time status updates from kitchen
  startOrderStatusPolling(order.id);

  if (window.lucide) lucide.createIcons();
}

function closeConfirmationModal() {
  const modal = document.getElementById('confirmationModal');
  const card = document.getElementById('confirmationModalCard');
  modal.classList.add('opacity-0', 'pointer-events-none');
  card.classList.add('translate-y-full', 'sm:translate-y-8');
  if (state.trackingInterval) clearInterval(state.trackingInterval);
}

function checkActiveOrderStatus() {
  if (state.activeOrder) {
    openConfirmationModal(state.activeOrder);
  }
}

function updateStatusTrackerUI(status) {
  const badge = document.getElementById('liveStatusBadge');
  const bar = document.getElementById('progressBarFill');
  const prepTime = document.getElementById('estimatedPrepTime');

  if (!badge) return;
  badge.textContent = status;

  // Normalized status
  const norm = (status || '').toLowerCase();

  if (norm === 'pending') {
    badge.className = 'px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold uppercase';
    bar.style.width = '25%';
    prepTime.textContent = '5-7 mins';
  } else if (norm === 'confirmed') {
    badge.className = 'px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-extrabold uppercase';
    bar.style.width = '50%';
    prepTime.textContent = '4-5 mins';
  } else if (norm === 'preparing') {
    badge.className = 'px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-extrabold uppercase pulse-soft';
    bar.style.width = '75%';
    prepTime.textContent = '2-3 mins (Scooping & Decorating!)';
  } else if (norm === 'ready' || norm === 'completed') {
    badge.className = 'px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase';
    bar.style.width = '100%';
    prepTime.textContent = 'Ready to enjoy! 🍦';
    if (norm === 'ready') {
      triggerConfetti();
      SoundFX.playFanfare();
    }
  }
}

function startOrderStatusPolling(orderId) {
  if (state.trackingInterval) clearInterval(state.trackingInterval);

  state.trackingInterval = setInterval(async () => {
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.order) {
          state.activeOrder = data.order;
          localStorage.setItem('happycones_active_order', JSON.stringify(data.order));
          updateStatusTrackerUI(data.order.status);
          if (data.order.status === 'Completed') {
            clearInterval(state.trackingInterval);
          }
        }
      }
    } catch (err) {
      console.warn('Polling error', err);
    }
  }, 3500);
}

function orderMoreIceCream() {
  closeConfirmationModal();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Confetti Effect
function triggerConfetti() {
  if (typeof confetti === 'function') {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#F43F5E', '#F59E0B', '#10B981', '#38BDF8', '#8B5CF6']
    });
  }
}

// Toast notification
function showToast(message, icon = '🍦') {
  const toast = document.getElementById('toast');
  const msgEl = document.getElementById('toastMessage');
  const iconEl = document.getElementById('toastIcon');
  if (!toast) return;

  msgEl.textContent = message;
  iconEl.textContent = icon;
  toast.classList.remove('opacity-0', '-translate-y-12', 'pointer-events-none');

  setTimeout(() => {
    toast.classList.add('opacity-0', '-translate-y-12', 'pointer-events-none');
  }, 2800);
}

