/**
 * HAPPY CONES - Netlify Serverless API Handler
 * Serves all /api/* endpoints globally via Netlify Functions + Netlify Blobs.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDeployStore, getStore } from '@netlify/blobs';
import qrGenerator from '../../public/js/qr-generator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_SETTINGS = {
  shopName: 'HAPPY CONES',
  shopTagline: 'Choose Your Favourite Ice Cream & Enjoy Every Bite!',
  welcomeMessage: 'Welcome to Our Ice Cream Paradise!',
  upiId: '9344232175@ptyes',
  payeeName: 'HAPPY CONES (Prasanna G)',
  ownerWhatsApp: '919344232175',
  adminPin: '1234',
  paymentQrImage: '/api/payment-qr',
  currencySymbol: '₹',
  serviceTaxPercent: 0,
  discountPromoCode: 'HAPPY10',
  discountPercent: 10
};

function readBundledData(filename, asText = false) {
  const candidates = [
    path.resolve(process.cwd(), 'data', filename),
    path.resolve(__dirname, '..', '..', 'data', filename)
  ];
  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) {
      return asText ? fs.readFileSync(filePath, 'utf8') : fs.readFileSync(filePath);
    }
  }
  return null;
}

function getSeedProducts() {
  try {
    const raw = readBundledData('products.json', true);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to read bundled products.json:', err);
  }
  return [];
}

function getSeedSettings() {
  try {
    const raw = readBundledData('settings.json', true);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (err) {
    console.error('Failed to read bundled settings.json:', err);
  }
  return { ...DEFAULT_SETTINGS };
}

function getDataStore(context, customStoreFactory) {
  if (typeof customStoreFactory === 'function') {
    return customStoreFactory(context);
  }
  const deployContext = context?.deploy?.context;
  if (deployContext && deployContext !== 'production') {
    return getDeployStore({ name: 'happy-cones-data', consistency: 'strong' });
  }
  return getStore({ name: 'happy-cones-data', consistency: 'strong' });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

async function parseJsonBody(req) {
  const text = await req.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function loadSettings(store) {
  const stored = await store.get('settings', { type: 'json' });
  if (stored && typeof stored === 'object') {
    return { ...DEFAULT_SETTINGS, ...stored };
  }
  const seed = getSeedSettings();
  await store.setJSON('settings', seed);
  return seed;
}

async function loadProducts(store) {
  const stored = await store.get('products', { type: 'json' });
  if (Array.isArray(stored)) {
    return stored;
  }
  const seed = getSeedProducts();
  await store.setJSON('products', seed);
  return seed;
}

async function listOrders(store) {
  const { blobs } = await store.list({ prefix: 'orders/' });
  if (!blobs || blobs.length === 0) return [];
  const entries = await Promise.all(
    blobs.map(async (b) => {
      try {
        return await store.get(b.key, { type: 'json' });
      } catch {
        return null;
      }
    })
  );
  return entries
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
}

function normalizeOrderId(rawId) {
  const clean = decodeURIComponent(rawId || '').trim();
  if (!clean) return '';
  return clean.startsWith('HC-') ? clean : `HC-${clean}`;
}

export async function handleApiRequest(req, context = {}, options = {}) {
  try {
    const urlObj = new URL(req.url);
    const pathname = urlObj.pathname;
    const method = req.method.toUpperCase();
    const origin = urlObj.origin;
    const hostname = urlObj.hostname;
    const store = getDataStore(context, options.storeFactory);

    // GET /api/server-info
    if (pathname === '/api/server-info' && method === 'GET') {
      const settings = await loadSettings(store);
      return jsonResponse({
        success: true,
        port: urlObj.port ? Number(urlObj.port) : 443,
        localIP: hostname,
        networkUrl: origin,
        localhostUrl: origin,
        isCloud: true,
        shopName: settings.shopName || 'HAPPY CONES',
        upiId: settings.upiId || '9344232175@ptyes'
      });
    }

    // GET /api/settings
    if (pathname === '/api/settings' && method === 'GET') {
      const settings = await loadSettings(store);
      return jsonResponse({
        ...settings,
        localIP: hostname,
        serverBaseUrl: origin,
        isCloud: true
      });
    }

    // PUT /api/settings
    if (pathname === '/api/settings' && method === 'PUT') {
      const updates = await parseJsonBody(req);
      const current = await loadSettings(store);
      const merged = { ...current, ...updates };
      await store.setJSON('settings', merged);
      return jsonResponse({ success: true, settings: merged });
    }

    // GET /api/shop-qr.png or /api/shop-qr
    if ((pathname === '/api/shop-qr.png' || pathname === '/api/shop-qr') && method === 'GET') {
      const customUrl = urlObj.searchParams.get('url');
      const targetUrl = (customUrl && /^https?:\/\//i.test(customUrl)) ? customUrl : origin;
      const pngBuffer = qrGenerator.generateQRCodePNGBuffer(targetUrl, { size: 420, border: 4 });
      return new Response(new Uint8Array(pngBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'no-cache'
        }
      });
    }

    // GET /api/shop-qr.svg
    if (pathname === '/api/shop-qr.svg' && method === 'GET') {
      const customUrl = urlObj.searchParams.get('url');
      const targetUrl = (customUrl && /^https?:\/\//i.test(customUrl)) ? customUrl : origin;
      const svg = qrGenerator.generateQRCodeSVG(targetUrl, { size: 360, border: 4, colorDark: '#000000' });
      return new Response(svg, {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml; charset=utf-8',
          'Cache-Control': 'no-cache'
        }
      });
    }

    // GET /api/payment-qr
    if (pathname === '/api/payment-qr' && method === 'GET') {
      const entry = await store.getWithMetadata('payment-qr', { type: 'arrayBuffer' });
      if (entry && entry.data) {
        const mimeType = entry.metadata?.contentType || 'image/jpeg';
        return new Response(new Uint8Array(entry.data), {
          status: 200,
          headers: {
            'Content-Type': mimeType,
            'Cache-Control': 'no-cache'
          }
        });
      }
      const fallbackImg = readBundledData('payment-qr.jpg', false);
      if (fallbackImg) {
        return new Response(new Uint8Array(fallbackImg), {
          status: 200,
          headers: {
            'Content-Type': 'image/jpeg',
            'Cache-Control': 'no-cache'
          }
        });
      }
      return jsonResponse({ success: false, message: 'QR image not found' }, 404);
    }

    // POST /api/upload-payment-qr
    if (pathname === '/api/upload-payment-qr' && method === 'POST') {
      const data = await parseJsonBody(req);
      if (!data.image) {
        return jsonResponse({ success: false, message: 'Image data is required' }, 400);
      }

      let contentType = 'image/jpeg';
      let buffer;
      if (data.image.startsWith('data:')) {
        const matches = data.image.match(/^data:([A-Za-z0-9\-+\/]+);base64,(.+)$/);
        if (matches && matches[2]) {
          contentType = matches[1] || 'image/jpeg';
          buffer = Buffer.from(matches[2], 'base64');
        } else {
          return jsonResponse({ success: false, message: 'Invalid base64 image data' }, 400);
        }
      } else {
        buffer = Buffer.from(data.image, 'base64');
      }

      await store.set('payment-qr', new Uint8Array(buffer), {
        metadata: { contentType, updatedAt: new Date().toISOString() }
      });
      return jsonResponse({
        success: true,
        message: 'Payment QR updated successfully',
        url: '/api/payment-qr?t=' + Date.now()
      });
    }

    // GET /api/products
    if (pathname === '/api/products' && method === 'GET') {
      const products = await loadProducts(store);
      return jsonResponse({ success: true, products });
    }

    // POST /api/products
    if (pathname === '/api/products' && method === 'POST') {
      const newProduct = await parseJsonBody(req);
      if (!newProduct.name || !newProduct.price) {
        return jsonResponse({ success: false, message: 'Product name and price are required' }, 400);
      }
      const products = await loadProducts(store);
      newProduct.id = 'prod-' + Date.now();
      newProduct.price = Number(newProduct.price);
      newProduct.inStock = newProduct.inStock !== false;
      newProduct.rating = newProduct.rating || 4.9;
      newProduct.flavours = Array.isArray(newProduct.flavours) ? newProduct.flavours : ['Original Vanilla'];
      newProduct.sizes = Array.isArray(newProduct.sizes) ? newProduct.sizes : [{ name: 'Regular', extra: 0 }];
      newProduct.toppings = Array.isArray(newProduct.toppings) ? newProduct.toppings : [];
      newProduct.image = newProduct.image || 'https://images.unsplash.com/photo-1549395156-e0c1fe6fc7a5?auto=format&fit=crop&w=600&q=80';

      products.unshift(newProduct);
      await store.setJSON('products', products);
      return jsonResponse({ success: true, product: newProduct }, 201);
    }

    // PATCH /api/products/:id/toggle-stock
    if (pathname.startsWith('/api/products/') && pathname.endsWith('/toggle-stock') && method === 'PATCH') {
      const id = decodeURIComponent(pathname.replace('/api/products/', '').replace('/toggle-stock', ''));
      const products = await loadProducts(store);
      const product = products.find((p) => p.id === id);
      if (!product) return jsonResponse({ success: false, message: 'Product not found' }, 404);
      product.inStock = !product.inStock;
      await store.setJSON('products', products);
      return jsonResponse({ success: true, inStock: product.inStock });
    }

    // PUT /api/products/:id
    if (pathname.startsWith('/api/products/') && method === 'PUT') {
      const id = decodeURIComponent(pathname.replace('/api/products/', ''));
      const updates = await parseJsonBody(req);
      const products = await loadProducts(store);
      const index = products.findIndex((p) => p.id === id);
      if (index === -1) return jsonResponse({ success: false, message: 'Product not found' }, 404);
      if (updates.price) updates.price = Number(updates.price);
      products[index] = { ...products[index], ...updates, id };
      await store.setJSON('products', products);
      return jsonResponse({ success: true, product: products[index] });
    }

    // DELETE /api/products/:id
    if (pathname.startsWith('/api/products/') && method === 'DELETE') {
      const id = decodeURIComponent(pathname.replace('/api/products/', ''));
      const products = await loadProducts(store);
      const next = products.filter((p) => p.id !== id);
      if (next.length === products.length) {
        return jsonResponse({ success: false, message: 'Product not found' }, 404);
      }
      await store.setJSON('products', next);
      return jsonResponse({ success: true, message: 'Product deleted' });
    }

    // GET /api/orders
    if (pathname === '/api/orders' && method === 'GET') {
      const orders = await listOrders(store);
      const status = urlObj.searchParams.get('status');
      const filtered = (status && status !== 'all')
        ? orders.filter((o) => (o.status || '').toLowerCase() === status.toLowerCase())
        : orders;
      return jsonResponse({ success: true, orders: filtered });
    }

    // POST /api/orders
    if (pathname === '/api/orders' && method === 'POST') {
      const orderData = await parseJsonBody(req);
      if (!orderData.items || !orderData.items.length) {
        return jsonResponse({ success: false, message: 'Order must contain items' }, 400);
      }

      let newOrder = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        const orderId = `HC-${randomNum}`;
        const candidate = {
          id: orderId,
          customerName: orderData.customerName || 'Guest Customer',
          customerPhone: orderData.customerPhone || '',
          tableNumber: orderData.tableNumber || 'Direct Order',
          orderType: orderData.orderType || 'Takeaway',
          items: orderData.items,
          subtotal: orderData.subtotal || 0,
          discount: orderData.discount || 0,
          tax: orderData.tax || 0,
          total: orderData.total || 0,
          paymentStatus: 'Pending Verification',
          paymentMethod: 'UPI / Google Pay',
          upiRef: orderData.upiRef || '',
          status: 'Pending',
          createdAt: new Date().toISOString(),
          orderNote: orderData.orderNote || ''
        };

        const writeResult = await store.setJSON(`orders/${orderId}`, candidate, { onlyIfNew: true });
        if (!writeResult || writeResult.modified !== false) {
          newOrder = candidate;
          break;
        }
      }

      if (!newOrder) {
        const fallbackId = `HC-${Date.now().toString().slice(-5)}`;
        newOrder = {
          id: fallbackId,
          customerName: orderData.customerName || 'Guest Customer',
          customerPhone: orderData.customerPhone || '',
          tableNumber: orderData.tableNumber || 'Direct Order',
          orderType: orderData.orderType || 'Takeaway',
          items: orderData.items,
          subtotal: orderData.subtotal || 0,
          discount: orderData.discount || 0,
          tax: orderData.tax || 0,
          total: orderData.total || 0,
          paymentStatus: 'Pending Verification',
          paymentMethod: 'UPI / Google Pay',
          upiRef: orderData.upiRef || '',
          status: 'Pending',
          createdAt: new Date().toISOString(),
          orderNote: orderData.orderNote || ''
        };
        await store.setJSON(`orders/${fallbackId}`, newOrder);
      }

      return jsonResponse({ success: true, order: newOrder }, 201);
    }

    // PATCH /api/orders/:id/payment
    if (pathname.startsWith('/api/orders/') && pathname.endsWith('/payment') && method === 'PATCH') {
      const orderId = normalizeOrderId(pathname.replace('/api/orders/', '').replace('/payment', ''));
      const data = await parseJsonBody(req);
      const order = await store.get(`orders/${orderId}`, { type: 'json' });
      if (!order) return jsonResponse({ success: false, message: 'Order not found' }, 404);

      order.upiRef = data.upiRef || order.upiRef;
      order.paymentStatus = 'Payment Submitted';
      order.status = 'Confirmed';
      await store.setJSON(`orders/${order.id}`, order);
      return jsonResponse({ success: true, order });
    }

    // PATCH /api/orders/:id/status
    if (pathname.startsWith('/api/orders/') && pathname.endsWith('/status') && method === 'PATCH') {
      const orderId = normalizeOrderId(pathname.replace('/api/orders/', '').replace('/status', ''));
      const data = await parseJsonBody(req);
      const order = await store.get(`orders/${orderId}`, { type: 'json' });
      if (!order) return jsonResponse({ success: false, message: 'Order not found' }, 404);

      if (data.status) order.status = data.status;
      if (data.paymentStatus) order.paymentStatus = data.paymentStatus;
      await store.setJSON(`orders/${order.id}`, order);
      return jsonResponse({ success: true, order });
    }

    // GET /api/orders/:id
    if (pathname.startsWith('/api/orders/') && method === 'GET') {
      const orderId = normalizeOrderId(pathname.replace('/api/orders/', ''));
      const order = await store.get(`orders/${orderId}`, { type: 'json' });
      if (!order) return jsonResponse({ success: false, message: 'Order not found' }, 404);
      return jsonResponse({ success: true, order });
    }

    return jsonResponse({ success: false, message: 'API route not found' }, 404);
  } catch (err) {
    console.error('Netlify API error:', err);
    return jsonResponse({ success: false, message: err.message || 'Internal Server Error' }, 500);
  }
}

export default async (req, context) => handleApiRequest(req, context);

export const config = {
  path: '/api/*'
};

