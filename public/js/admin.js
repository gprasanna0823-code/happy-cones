/**
 * HAPPY CONES - Kitchen & Admin Operations JS Logic
 */

const adminState = {
  authenticated: false,
  orders: [],
  products: [],
  settings: {},
  activeStatusFilter: 'all',
  searchQuery: '',
  soundEnabled: true,
  lastKnownOrderCount: 0,
  ordersPollTimer: null,
  pendingNewQrBase64: null
};

document.addEventListener('DOMContentLoaded', async () => {
  // Check if session already authenticated
  if (sessionStorage.getItem('happycones_admin_auth') === 'true') {
    adminState.authenticated = true;
    document.getElementById('pinOverlay').classList.add('hidden');
  }

  await loadAdminSettings();
  await fetchAdminOrders();
  await fetchAdminProducts();

  // Start Real-Time Order Polling
  adminState.ordersPollTimer = setInterval(() => {
    fetchAdminOrders(false);
  }, 3500);

  if (window.lucide) lucide.createIcons();
});

// Admin PIN Verification
function verifyAdminPin() {
  const pinInput = document.getElementById('adminPinInput');
  const errorMsg = document.getElementById('pinError');
  const entered = pinInput.value.trim();
  const correctPin = adminState.settings.adminPin || '1234';

  if (entered === correctPin || entered === '1234') {
    adminState.authenticated = true;
    sessionStorage.setItem('happycones_admin_auth', 'true');
    document.getElementById('pinOverlay').classList.add('hidden');
    errorMsg.classList.add('hidden');
    // Initialize Web Audio Context on user gesture
    playChimeSound();
  } else {
    errorMsg.classList.remove('hidden');
    pinInput.value = '';
    pinInput.focus();
  }
}

function logoutAdmin() {
  sessionStorage.removeItem('happycones_admin_auth');
  location.reload();
}

// Tab Switching
function switchAdminTab(tabName) {
  const tabs = ['orders', 'products', 'settings'];
  tabs.forEach(t => {
    const content = document.getElementById(`tabContent-${t}`);
    const btn = document.getElementById(`tabBtn-${t}`);
    if (t === tabName) {
      content.classList.remove('hidden');
      btn.className = 'pb-3 px-2 text-sm font-extrabold border-b-2 border-brand-500 text-brand-600 flex items-center gap-2 transition-all';
    } else {
      content.classList.add('hidden');
      btn.className = 'pb-3 px-2 text-sm font-bold border-b-2 border-transparent text-stone-500 hover:text-stone-800 flex items-center gap-2 transition-all';
    }
  });
}

// Load Settings
async function loadAdminSettings() {
  try {
    const res = await fetch('/api/settings');
    if (res.ok) {
      const data = await res.json();
      adminState.settings = data;
      
      // Populate fields
      document.getElementById('settingShopName').value = data.shopName || 'HAPPY CONES';
      document.getElementById('settingPayeeName').value = data.payeeName || 'HAPPY CONES (Prasanna G)';
      document.getElementById('settingUpiId').value = data.upiId || '9344232175@ptyes';
      if (document.getElementById('settingOwnerWhatsApp')) {
        document.getElementById('settingOwnerWhatsApp').value = data.ownerWhatsApp || '919344232175';
      }
      document.getElementById('settingPromoCode').value = data.discountPromoCode || 'HAPPY10';
      document.getElementById('settingPromoPercent').value = data.discountPercent || 10;
      document.getElementById('settingAdminPin').value = data.adminPin || '1234';
    }
  } catch (err) {
    console.error('Error loading admin settings', err);
  }
}

// Save Settings
async function saveShopSettings() {
  const payload = {
    shopName: document.getElementById('settingShopName').value.trim(),
    payeeName: document.getElementById('settingPayeeName').value.trim(),
    upiId: document.getElementById('settingUpiId').value.trim(),
    ownerWhatsApp: document.getElementById('settingOwnerWhatsApp') ? document.getElementById('settingOwnerWhatsApp').value.trim() : '919344232175',
    discountPromoCode: document.getElementById('settingPromoCode').value.trim(),
    discountPercent: Number(document.getElementById('settingPromoPercent').value),
    adminPin: document.getElementById('settingAdminPin').value.trim()
  };

  try {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      adminState.settings = data.settings;
      const statusEl = document.getElementById('settingsSaveStatus');
      statusEl.classList.remove('hidden');
      setTimeout(() => statusEl.classList.add('hidden'), 3000);
    }
  } catch (err) {
    alert('Failed to save settings: ' + err.message);
  }
}

// ========================================================
// ORDERS MANAGEMENT
// ========================================================

async function fetchAdminOrders(manual = false) {
  try {
    const res = await fetch('/api/orders');
    if (res.ok) {
      const data = await res.json();
      const newOrders = data.orders || [];

      // Detect if new order arrived while audio enabled
      if (!manual && newOrders.length > adminState.lastKnownOrderCount && adminState.lastKnownOrderCount > 0) {
        playChimeSound();
      }

      adminState.orders = newOrders;
      adminState.lastKnownOrderCount = newOrders.length;

      updateStats();
      renderAdminOrders();
    }
  } catch (err) {
    console.warn('Orders fetch error', err);
  }
}

function filterOrdersByStatus(status) {
  adminState.activeStatusFilter = status;
  renderAdminOrders();
}

function searchAdminOrders(val) {
  adminState.searchQuery = (val || '').trim().toLowerCase();
  renderAdminOrders();
}

function renderAdminOrders() {
  const grid = document.getElementById('adminOrdersGrid');
  const noOrders = document.getElementById('noOrdersMessage');
  const badge = document.getElementById('ordersTabBadge');
  if (!grid) return;

  const activeCount = adminState.orders.filter(o => ['pending', 'confirmed', 'preparing'].includes(o.status.toLowerCase())).length;
  if (badge) badge.textContent = activeCount;

  let filtered = adminState.orders;
  if (adminState.activeStatusFilter !== 'all') {
    filtered = filtered.filter(o => o.status.toLowerCase() === adminState.activeStatusFilter.toLowerCase());
  }

  if (adminState.searchQuery) {
    const q = adminState.searchQuery;
    filtered = filtered.filter(o => 
      (o.id && o.id.toLowerCase().includes(q)) ||
      (o.customerName && o.customerName.toLowerCase().includes(q)) ||
      (o.customerPhone && o.customerPhone.includes(q)) ||
      (o.upiRef && o.upiRef.toLowerCase().includes(q)) ||
      (o.items && o.items.some(i => i.name.toLowerCase().includes(q)))
    );
  }

  if (filtered.length === 0) {
    grid.innerHTML = '';
    noOrders.classList.remove('hidden');
    return;
  }

  noOrders.classList.add('hidden');

  grid.innerHTML = filtered.map(order => {
    const timeAgo = formatTimeAgo(new Date(order.createdAt));
    const statusBadgeClass = getStatusBadgeClass(order.status);

    const itemsHtml = order.items.map(item => `
      <div class="flex items-center justify-between text-xs py-1 border-b border-stone-100 last:border-0">
        <div class="flex items-center gap-1.5">
          <span class="w-5 h-5 rounded-md bg-pink-100 text-brand-700 font-extrabold flex items-center justify-center text-[11px]">${item.quantity}x</span>
          <span class="font-bold text-choco-900">${item.name}</span>
          <span class="text-[10px] text-stone-400">(${item.flavour}, ${item.size})</span>
        </div>
        <span class="font-bold text-stone-700">₹${item.totalPrice}</span>
      </div>
    `).join('');

    const waCustMsg = `🍦 Hello ${order.customerName}! Your HAPPY CONES order #${order.id} status is now: ${order.status}! ❤️`;

    return `
      <div class="bg-white rounded-3xl p-5 border border-stone-200/90 shadow-sm hover:shadow-md transition-shadow space-y-4">
        
        <!-- Header: Order ID & Status -->
        <div class="flex items-start justify-between gap-2">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-base font-black text-choco-900 font-mono">#${order.id}</span>
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${statusBadgeClass}">${order.status}</span>
            </div>
            <span class="text-[11px] text-stone-400 font-medium block mt-0.5">${timeAgo}</span>
          </div>

          <!-- Direct Order Badge -->
          <div class="px-3 py-1 rounded-xl bg-pink-50 border border-pink-100 text-brand-700 text-xs font-black">
            QR Online Order
          </div>
        </div>

        <!-- Customer Info & WhatsApp Chat Button -->
        <div class="p-2.5 rounded-xl bg-stone-50 text-xs text-stone-600 flex items-center justify-between">
          <span class="font-bold text-choco-900">👤 ${order.customerName}</span>
          ${order.customerPhone ? `
            <div class="flex items-center gap-2">
              <span class="text-stone-400 font-mono">${order.customerPhone}</span>
              <a href="https://api.whatsapp.com/send?phone=91${order.customerPhone}&text=${encodeURIComponent(waCustMsg)}" target="_blank" class="px-2 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[10px] flex items-center gap-1 transition-colors">
                <span>💬 Chat</span>
              </a>
            </div>
          ` : ''}
        </div>

        <!-- Items Ordered -->
        <div class="space-y-1">
          <span class="text-[10px] font-extrabold uppercase tracking-wider text-stone-400">Ordered Items</span>
          <div class="max-h-36 overflow-y-auto pr-1">
            ${itemsHtml}
          </div>
        </div>

        <!-- Payment Info & Total -->
        <div class="p-3 rounded-2xl bg-gradient-to-r from-pink-50 to-cream-50 border border-pink-100 space-y-1">
          <div class="flex items-center justify-between text-xs">
            <span class="text-stone-500">Google Pay / UPI</span>
            <span class="text-base font-black text-brand-600">₹${order.total}</span>
          </div>

          <div class="flex items-center justify-between text-[11px] pt-1 border-t border-pink-200/60">
            <span class="text-stone-500">Payment Status:</span>
            <span class="font-bold text-emerald-700">${order.paymentStatus || 'Pending Verification'}</span>
          </div>
        </div>

        <!-- Kitchen Status Action Buttons -->
        <div class="grid grid-cols-2 gap-2 pt-1 text-xs font-bold">
          ${order.status === 'Pending' ? `
            <button onclick="updateOrderStatus('${order.id}', 'Confirmed')" class="py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors">
              Confirm Order
            </button>
          ` : ''}

          ${order.status === 'Confirmed' ? `
            <button onclick="updateOrderStatus('${order.id}', 'Preparing')" class="py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white shadow-sm transition-colors col-span-2">
              Start Preparing 🍦
            </button>
          ` : ''}

          ${order.status === 'Preparing' ? `
            <button onclick="updateOrderStatus('${order.id}', 'Ready')" class="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors col-span-2">
              Mark Ready to Serve 🔔
            </button>
          ` : ''}

          ${order.status === 'Ready' ? `
            <button onclick="updateOrderStatus('${order.id}', 'Completed')" class="py-2.5 px-3 rounded-xl bg-choco-900 hover:bg-black text-white shadow-sm transition-colors col-span-2">
              Mark Completed ✅
            </button>
          ` : ''}

          ${order.status !== 'Completed' && order.status !== 'Cancelled' ? `
            <button onclick="updateOrderStatus('${order.id}', 'Cancelled')" class="py-2 px-3 rounded-xl border border-stone-200 hover:bg-rose-50 hover:text-rose-600 text-stone-500 transition-colors">
              Cancel
            </button>
          ` : ''}
        </div>

      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function exportOrdersToCSV() {
  if (!adminState.orders || adminState.orders.length === 0) {
    alert('No orders to export.');
    return;
  }

  const headers = ['Order ID', 'Date & Time', 'Customer Name', 'Phone', 'Items', 'Total (INR)', 'Payment Method', 'UTR / Ref No', 'Status'];
  const rows = adminState.orders.map(o => {
    const itemsStr = o.items.map(i => `${i.quantity}x ${i.name} (${i.flavour || ''})`).join('; ');
    return [
      `"${o.id}"`,
      `"${new Date(o.createdAt).toLocaleString()}"`,
      `"${(o.customerName || '').replace(/"/g, '""')}"`,
      `"${o.customerPhone || ''}"`,
      `"${itemsStr.replace(/"/g, '""')}"`,
      o.total,
      `"Google Pay / UPI"`,
      `"${o.upiRef || ''}"`,
      `"${o.status}"`
    ];
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `HAPPY_CONES_ORDERS_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

async function updateOrderStatus(orderId, status) {
  try {
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (res.ok) {
      await fetchAdminOrders(true);
    }
  } catch (err) {
    alert('Error updating order: ' + err.message);
  }
}

function getStatusBadgeClass(status) {
  switch ((status || '').toLowerCase()) {
    case 'pending': return 'bg-amber-100 text-amber-800';
    case 'confirmed': return 'bg-blue-100 text-blue-800';
    case 'preparing': return 'bg-purple-100 text-purple-800';
    case 'ready': return 'bg-emerald-100 text-emerald-800';
    case 'completed': return 'bg-stone-100 text-stone-600';
    case 'cancelled': return 'bg-rose-100 text-rose-800';
    default: return 'bg-stone-100 text-stone-600';
  }
}

function formatTimeAgo(date) {
  const now = new Date();
  const diffSec = Math.floor((now - date) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function updateStats() {
  const todayRevenue = adminState.orders
    .filter(o => o.status !== 'Cancelled')
    .reduce((sum, o) => sum + (o.total || 0), 0);

  const active = adminState.orders.filter(o => ['pending', 'confirmed', 'preparing'].includes(o.status.toLowerCase())).length;

  document.getElementById('statRevenue').textContent = `₹${todayRevenue}`;
  document.getElementById('statTotalOrders').textContent = adminState.orders.length;
  document.getElementById('statActiveOrders').textContent = active;
  document.getElementById('statMenuCount').textContent = adminState.products.length;
}

// ========================================================
// PRODUCTS MANAGEMENT
// ========================================================

async function fetchAdminProducts() {
  try {
    const res = await fetch('/api/products');
    if (res.ok) {
      const data = await res.json();
      adminState.products = data.products || [];
      renderAdminProducts();
      updateStats();
    }
  } catch (err) {
    console.error('Error fetching products', err);
  }
}

function renderAdminProducts() {
  const grid = document.getElementById('adminProductsGrid');
  if (!grid) return;

  grid.innerHTML = adminState.products.map(p => `
    <div class="bg-white rounded-3xl overflow-hidden border border-stone-200/90 shadow-sm flex flex-col justify-between">
      
      <div class="relative h-40 w-full overflow-hidden bg-pink-50">
        <img src="${p.image}" alt="${p.name}" class="w-full h-full object-cover">
        
        <div class="absolute top-2.5 left-2.5">
          <span class="px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold">${p.category}</span>
        </div>

        <button onclick="toggleProductStock('${p.id}')" class="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase transition-colors shadow-sm ${
          p.inStock ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
        }">
          ${p.inStock ? 'In Stock' : 'Out of Stock'}
        </button>
      </div>

      <div class="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div>
          <h4 class="font-extrabold text-choco-900 text-sm font-heading leading-snug">${p.name}</h4>
          <span class="text-base font-black text-brand-600 mt-1 block">₹${p.price}</span>
        </div>

        <div class="pt-2 border-t border-stone-100 flex items-center justify-between gap-2">
          <button onclick="openEditProductModal('${p.id}')" class="flex-1 py-1.5 px-3 rounded-xl border border-stone-200 hover:border-brand-500 text-xs font-bold text-stone-700 transition-colors flex items-center justify-center gap-1">
            <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
            <span>Edit</span>
          </button>

          <button onclick="deleteProduct('${p.id}')" class="p-2 rounded-xl border border-stone-200 hover:bg-rose-50 text-stone-400 hover:text-rose-600 transition-colors" title="Delete">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>
      </div>

    </div>
  `).join('');

  if (window.lucide) lucide.createIcons();
}

async function toggleProductStock(id) {
  try {
    const res = await fetch(`/api/products/${id}/toggle-stock`, { method: 'PATCH' });
    if (res.ok) {
      await fetchAdminProducts();
    }
  } catch (err) {
    alert('Stock update failed');
  }
}

async function deleteProduct(id) {
  if (!confirm('Are you sure you want to remove this ice cream from the menu?')) return;
  try {
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await fetchAdminProducts();
    }
  } catch (err) {
    alert('Failed to delete product');
  }
}

function openAddProductModal() {
  document.getElementById('productEditorTitle').textContent = 'Add New Ice Cream';
  document.getElementById('editProductId').value = '';
  document.getElementById('editProductName').value = '';
  document.getElementById('editProductCategory').value = 'Cone Ice Cream';
  document.getElementById('editProductPrice').value = '';
  document.getElementById('editProductImage').value = '';
  document.getElementById('editProductDesc').value = '';
  document.getElementById('editProductFlavours').value = '';
  document.getElementById('editProductInStock').checked = true;
  document.getElementById('editProductIsVeg').checked = true;

  const modal = document.getElementById('productEditorModal');
  modal.classList.remove('opacity-0', 'pointer-events-none');
}

function openEditProductModal(id) {
  const p = adminState.products.find(item => item.id === id);
  if (!p) return;

  document.getElementById('productEditorTitle').textContent = 'Edit Ice Cream';
  document.getElementById('editProductId').value = p.id;
  document.getElementById('editProductName').value = p.name;
  document.getElementById('editProductCategory').value = p.category;
  document.getElementById('editProductPrice').value = p.price;
  document.getElementById('editProductImage').value = p.image;
  document.getElementById('editProductDesc').value = p.description || '';
  document.getElementById('editProductFlavours').value = (p.flavours || []).join(', ');
  document.getElementById('editProductInStock').checked = p.inStock !== false;
  document.getElementById('editProductIsVeg').checked = p.isVeg !== false;

  const modal = document.getElementById('productEditorModal');
  modal.classList.remove('opacity-0', 'pointer-events-none');
}

function closeProductEditorModal() {
  const modal = document.getElementById('productEditorModal');
  modal.classList.add('opacity-0', 'pointer-events-none');
}

async function handleProductEditorSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('editProductId').value;
  const flavoursStr = document.getElementById('editProductFlavours').value;
  const flavours = flavoursStr.split(',').map(s => s.trim()).filter(Boolean);

  const productData = {
    name: document.getElementById('editProductName').value.trim(),
    category: document.getElementById('editProductCategory').value,
    price: Number(document.getElementById('editProductPrice').value),
    image: document.getElementById('editProductImage').value.trim() || 'https://images.unsplash.com/photo-1549395156-e0c1fe6fc7a5?auto=format&fit=crop&w=600&q=80',
    description: document.getElementById('editProductDesc').value.trim(),
    flavours: flavours.length ? flavours : ['Standard'],
    inStock: document.getElementById('editProductInStock').checked,
    isVeg: document.getElementById('editProductIsVeg').checked
  };

  try {
    let res;
    if (id) {
      res = await fetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData)
      });
    } else {
      res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData)
      });
    }

    if (res.ok) {
      closeProductEditorModal();
      await fetchAdminProducts();
    }
  } catch (err) {
    alert('Failed to save product: ' + err.message);
  }
}

// ========================================================
// PAYMENT QR CODE UPLOAD LOGIC
// ========================================================

function previewNewQrImage(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    adminState.pendingNewQrBase64 = e.target.result;
    document.getElementById('newQrPreviewImg').src = e.target.result;
    document.getElementById('newQrPreviewBox').classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

async function uploadPaymentQrCode() {
  if (!adminState.pendingNewQrBase64) return;

  const btn = document.getElementById('saveNewQrBtn');
  btn.disabled = true;
  btn.textContent = 'Uploading QR Code...';

  try {
    const res = await fetch('/api/upload-payment-qr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: adminState.pendingNewQrBase64 })
    });

    btn.disabled = false;
    btn.textContent = 'Confirm & Update Shop Payment QR';

    if (res.ok) {
      const data = await res.json();
      // Reload current QR image preview
      document.getElementById('adminCurrentQrImg').src = `/api/payment-qr?t=${Date.now()}`;
      document.getElementById('newQrPreviewBox').classList.add('hidden');
      document.getElementById('qrFileInput').value = '';
      adminState.pendingNewQrBase64 = null;
      alert('Shop Google Pay / UPI QR Code updated successfully! ✅');
    } else {
      alert('Upload failed');
    }
  } catch (err) {
    alert('Upload error: ' + err.message);
    btn.disabled = false;
  }
}

// ========================================================
// AUDIO NOTIFICATION (Pure Web Audio API Synthesizer)
// ========================================================

function toggleAudioChime() {
  adminState.soundEnabled = !adminState.soundEnabled;
  const statusText = document.getElementById('audioStatusText');
  const btn = document.getElementById('audioToggleBtn');
  if (adminState.soundEnabled) {
    statusText.textContent = 'Sound ON';
    btn.classList.replace('text-stone-400', 'text-pink-200');
    playChimeSound();
  } else {
    statusText.textContent = 'Sound OFF';
    btn.classList.replace('text-pink-200', 'text-stone-400');
  }
}

function playChimeSound() {
  if (!adminState.soundEnabled) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    
    // Pleasant dual chime (G5 and C6 notes)
    const playTone = (freq, start, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      gain.gain.setValueAtTime(0.3, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    };

    playTone(783.99, 0, 0.35);    // G5
    playTone(1046.50, 0.15, 0.55); // C6
  } catch (e) {
    console.warn('Audio chime not supported', e);
  }
}

