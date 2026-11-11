/**
 * HAPPY CONES - Modern Ice Cream Shop Online Ordering Server
 * QR Code-Based Ordering System
 * Built with native Node.js (Zero external dependency requirement)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const zlib = require('zlib');
const qrGenerator = require('./public/js/qr-generator');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });

// File paths
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const PAYMENT_QR_FILE = path.join(DATA_DIR, 'payment-qr.jpg');

// Helpers for JSON reading/writing
function readJSON(file, defaultValue = []) {
  try {
    if (!fs.existsSync(file)) {
      writeJSON(file, defaultValue);
      return defaultValue;
    }
    const data = fs.readFileSync(file, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading JSON from', file, err);
    return defaultValue;
  }
}

function writeJSON(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing JSON to', file, err);
    return false;
  }
}

// Get local IPv4 address for Wi-Fi QR code scanning (prefers Wi-Fi/Ethernet, skips virtual adapters)
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  const candidates = [];
  for (const name of Object.keys(interfaces)) {
    const isVirtual = /vethernet|vmware|virtualbox|vbox|wsl|hyper-v|docker|loopback/i.test(name);
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        candidates.push({ name, address: net.address, isVirtual, isWifi: /wi-?fi|wlan/i.test(name) });
      }
    }
  }
  const preferred = candidates.find(c => c.isWifi && !c.isVirtual) || candidates.find(c => !c.isVirtual) || candidates[0];
  return preferred ? preferred.address : 'localhost';
}

// MIME types dictionary
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

// Parse JSON request body helper
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 25 * 1024 * 1024) { // 25MB limit for images
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        resolve({ raw: body });
      }
    });
    req.on('error', reject);
  });
}

// Respond JSON helper
function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
  const parsedUrlObj = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const pathname = parsedUrlObj.pathname;
  const queryParams = Object.fromEntries(parsedUrlObj.searchParams.entries());
  const method = req.method;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  // ==========================================
  // API ENDPOINTS
  // ==========================================

  // GET /api/server-info - network IP for table QR generation
  if (pathname === '/api/server-info' && method === 'GET') {
    const localIP = getLocalIP();
    const settings = readJSON(SETTINGS_FILE, {});
    return sendJSON(res, 200, {
      success: true,
      port: PORT,
      localIP: localIP,
      networkUrl: `http://${localIP}:${PORT}`,
      localhostUrl: `http://localhost:${PORT}`,
      shopName: settings.shopName || 'HAPPY CONES',
      upiId: settings.upiId || '9344232175@ptyes'
    });
  }

  // GET /api/settings
  if (pathname === '/api/settings' && method === 'GET') {
    const settings = readJSON(SETTINGS_FILE, {});
    const localIP = getLocalIP();
    return sendJSON(res, 200, {
      ...settings,
      localIP,
      serverBaseUrl: `http://${localIP}:${PORT}`
    });
  }

  // PUT /api/settings - admin updates shop settings
  if (pathname === '/api/settings' && method === 'PUT') {
    try {
      const updates = await parseBody(req);
      const current = readJSON(SETTINGS_FILE, {});
      const merged = { ...current, ...updates };
      writeJSON(SETTINGS_FILE, merged);
      return sendJSON(res, 200, { success: true, settings: merged });
    } catch (err) {
      return sendJSON(res, 500, { success: false, message: err.message });
    }
  }

  // GET /api/shop-qr.png - crisp dynamically generated PNG QR pointing to live Shop URL
  if ((pathname === '/api/shop-qr.png' || pathname === '/api/shop-qr') && method === 'GET') {
    const localIP = getLocalIP();
    const targetUrl = (queryParams.url && /^https?:\/\//i.test(queryParams.url))
      ? queryParams.url
      : `http://${localIP}:${PORT}`;
    const pngBuffer = qrGenerator.generateQRCodePNGBuffer(targetUrl, {
      size: 420,
      border: 4,
      deflateSync: zlib.deflateSync
    });
    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*'
    });
    return res.end(pngBuffer);
  }

  // GET /api/shop-qr.svg - crisp dynamically generated SVG QR pointing to live Shop URL
  if (pathname === '/api/shop-qr.svg' && method === 'GET') {
    const localIP = getLocalIP();
    const targetUrl = (queryParams.url && /^https?:\/\//i.test(queryParams.url))
      ? queryParams.url
      : `http://${localIP}:${PORT}`;
    const svg = qrGenerator.generateQRCodeSVG(targetUrl, { size: 360, border: 4, colorDark: '#000000' });
    res.writeHead(200, {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*'
    });
    return res.end(svg);
  }

  // GET /api/payment-qr - serves the genuine uploaded shop QR code
  if (pathname === '/api/payment-qr' && method === 'GET') {
    if (fs.existsSync(PAYMENT_QR_FILE)) {
      res.writeHead(200, {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*'
      });
      return fs.createReadStream(PAYMENT_QR_FILE).pipe(res);
    }
    // Fallback if not found
    return sendJSON(res, 404, { success: false, message: 'QR image not found' });
  }

  // POST /api/upload-payment-qr - admin updates the payment QR image
  if (pathname === '/api/upload-payment-qr' && method === 'POST') {
    try {
      const data = await parseBody(req);
      if (!data.image) {
        return sendJSON(res, 400, { success: false, message: 'Image data is required' });
      }

      // If data is base64
      let buffer;
      if (data.image.startsWith('data:')) {
        const matches = data.image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches[2]) {
          buffer = Buffer.from(matches[2], 'base64');
        } else {
          return sendJSON(res, 400, { success: false, message: 'Invalid base64 image data' });
        }
      } else {
        buffer = Buffer.from(data.image, 'base64');
      }

      fs.writeFileSync(PAYMENT_QR_FILE, buffer);
      console.log('Payment QR updated successfully. Size:', buffer.length);
      return sendJSON(res, 200, { success: true, message: 'Payment QR updated successfully', url: '/api/payment-qr?t=' + Date.now() });
    } catch (err) {
      return sendJSON(res, 500, { success: false, message: err.message });
    }
  }

  // GET /api/products - list all products
  if (pathname === '/api/products' && method === 'GET') {
    const products = readJSON(PRODUCTS_FILE, []);
    return sendJSON(res, 200, { success: true, products });
  }

  // POST /api/products - admin adds new product
  if (pathname === '/api/products' && method === 'POST') {
    try {
      const newProduct = await parseBody(req);
      if (!newProduct.name || !newProduct.price) {
        return sendJSON(res, 400, { success: false, message: 'Product name and price are required' });
      }
      const products = readJSON(PRODUCTS_FILE, []);
      newProduct.id = 'prod-' + Date.now();
      newProduct.price = Number(newProduct.price);
      newProduct.inStock = newProduct.inStock !== false;
      newProduct.rating = newProduct.rating || 4.9;
      newProduct.flavours = Array.isArray(newProduct.flavours) ? newProduct.flavours : ['Original Vanilla'];
      newProduct.sizes = Array.isArray(newProduct.sizes) ? newProduct.sizes : [{ name: 'Regular', extra: 0 }];
      newProduct.toppings = Array.isArray(newProduct.toppings) ? newProduct.toppings : [];
      newProduct.image = newProduct.image || 'https://images.unsplash.com/photo-1549395156-e0c1fe6fc7a5?auto=format&fit=crop&w=600&q=80';

      products.unshift(newProduct);
      writeJSON(PRODUCTS_FILE, products);
      return sendJSON(res, 201, { success: true, product: newProduct });
    } catch (err) {
      return sendJSON(res, 500, { success: false, message: err.message });
    }
  }

  // PUT /api/products/:id - admin updates product
  if (pathname.startsWith('/api/products/') && method === 'PUT') {
    const id = pathname.replace('/api/products/', '');
    try {
      const updates = await parseBody(req);
      const products = readJSON(PRODUCTS_FILE, []);
      const index = products.findIndex(p => p.id === id);
      if (index === -1) {
        return sendJSON(res, 404, { success: false, message: 'Product not found' });
      }
      if (updates.price) updates.price = Number(updates.price);
      products[index] = { ...products[index], ...updates, id };
      writeJSON(PRODUCTS_FILE, products);
      return sendJSON(res, 200, { success: true, product: products[index] });
    } catch (err) {
      return sendJSON(res, 500, { success: false, message: err.message });
    }
  }

  // PATCH /api/products/:id/toggle-stock
  if (pathname.startsWith('/api/products/') && pathname.endsWith('/toggle-stock') && method === 'PATCH') {
    const id = pathname.replace('/api/products/', '').replace('/toggle-stock', '');
    const products = readJSON(PRODUCTS_FILE, []);
    const product = products.find(p => p.id === id);
    if (!product) return sendJSON(res, 404, { success: false, message: 'Product not found' });
    product.inStock = !product.inStock;
    writeJSON(PRODUCTS_FILE, products);
    return sendJSON(res, 200, { success: true, inStock: product.inStock });
  }

  // DELETE /api/products/:id - admin deletes product
  if (pathname.startsWith('/api/products/') && method === 'DELETE') {
    const id = pathname.replace('/api/products/', '');
    let products = readJSON(PRODUCTS_FILE, []);
    const initialLength = products.length;
    products = products.filter(p => p.id !== id);
    if (products.length === initialLength) {
      return sendJSON(res, 404, { success: false, message: 'Product not found' });
    }
    writeJSON(PRODUCTS_FILE, products);
    return sendJSON(res, 200, { success: true, message: 'Product deleted' });
  }

  // GET /api/orders - list orders (with optional status filter)
  if (pathname === '/api/orders' && method === 'GET') {
    const orders = readJSON(ORDERS_FILE, []);
    const status = queryParams.status;
    let filtered = orders;
    if (status && status !== 'all') {
      filtered = orders.filter(o => o.status.toLowerCase() === status.toLowerCase());
    }
    return sendJSON(res, 200, { success: true, orders: filtered });
  }

  // POST /api/orders - customer places an order
  if (pathname === '/api/orders' && method === 'POST') {
    try {
      const orderData = await parseBody(req);
      if (!orderData.items || !orderData.items.length) {
        return sendJSON(res, 400, { success: false, message: 'Order must contain items' });
      }

      const orders = readJSON(ORDERS_FILE, []);
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      const orderId = `HC-${randomNum}`;

      const newOrder = {
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
        status: 'Pending', // Pending -> Confirmed -> Preparing -> Ready -> Completed
        createdAt: new Date().toISOString(),
        orderNote: orderData.orderNote || ''
      };

      orders.unshift(newOrder);
      writeJSON(ORDERS_FILE, orders);
      console.log(`New Order Placed: #${newOrder.id} - Total: ₹${newOrder.total}`);
      return sendJSON(res, 201, { success: true, order: newOrder });
    } catch (err) {
      return sendJSON(res, 500, { success: false, message: err.message });
    }
  }

  // GET /api/orders/:id - single order status tracking
  if (pathname.startsWith('/api/orders/') && method === 'GET' && !pathname.includes('/status') && !pathname.includes('/payment')) {
    const id = pathname.replace('/api/orders/', '');
    const orders = readJSON(ORDERS_FILE, []);
    const order = orders.find(o => o.id === id || o.id === `HC-${id}`);
    if (!order) return sendJSON(res, 404, { success: false, message: 'Order not found' });
    return sendJSON(res, 200, { success: true, order });
  }

  // PATCH /api/orders/:id/payment - customer submits UPI reference number
  if (pathname.startsWith('/api/orders/') && pathname.endsWith('/payment') && method === 'PATCH') {
    const id = pathname.replace('/api/orders/', '').replace('/payment', '');
    const data = await parseBody(req);
    const orders = readJSON(ORDERS_FILE, []);
    const order = orders.find(o => o.id === id || o.id === `HC-${id}`);
    if (!order) return sendJSON(res, 404, { success: false, message: 'Order not found' });

    order.upiRef = data.upiRef || order.upiRef;
    order.paymentStatus = 'Payment Submitted';
    order.status = 'Confirmed'; // Automatically move to Confirmed when customer confirms payment
    writeJSON(ORDERS_FILE, orders);
    console.log(`Payment details submitted for Order #${order.id}, Ref: ${order.upiRef}`);
    return sendJSON(res, 200, { success: true, order });
  }

  // PATCH /api/orders/:id/status - admin updates order status
  if (pathname.startsWith('/api/orders/') && pathname.endsWith('/status') && method === 'PATCH') {
    const id = pathname.replace('/api/orders/', '').replace('/status', '');
    const data = await parseBody(req);
    const orders = readJSON(ORDERS_FILE, []);
    const order = orders.find(o => o.id === id || o.id === `HC-${id}`);
    if (!order) return sendJSON(res, 404, { success: false, message: 'Order not found' });

    if (data.status) order.status = data.status;
    if (data.paymentStatus) order.paymentStatus = data.paymentStatus;
    writeJSON(ORDERS_FILE, orders);
    console.log(`Order #${order.id} status updated to: ${order.status}`);
    return sendJSON(res, 200, { success: true, order });
  }

  // ==========================================
  // STATIC FILE ROUTING
  // ==========================================

  let filePath;
  if (pathname === '/' || pathname === '/index.html') {
    filePath = path.join(PUBLIC_DIR, 'index.html');
  } else if (pathname === '/admin' || pathname === '/admin.html') {
    filePath = path.join(PUBLIC_DIR, 'admin.html');
  } else if (pathname === '/standee' || pathname === '/standee.html' || pathname === '/table-qr') {
    filePath = path.join(PUBLIC_DIR, 'standee.html');
  } else {
    filePath = path.join(PUBLIC_DIR, pathname);
  }

  // Security: prevent directory traversal
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(PUBLIC_DIR))) {
    res.writeHead(403);
    return res.end('Access Denied');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback to index.html for client-side routing
      const fallback = path.join(PUBLIC_DIR, 'index.html');
      if (fs.existsSync(fallback)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return fs.createReadStream(fallback).pipe(res);
      }
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('404 Not Found');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const localIP = getLocalIP();
  console.log('🍦 ================================================');
  console.log(`🍦 HAPPY CONES - Ice Cream Shop Server Running!`);
  console.log(`🍦 Local URL:   http://localhost:${PORT}`);
  console.log(`🍦 Network URL: http://${localIP}:${PORT} (For Mobile QR Scanning)`);
  console.log(`🍦 Standee Generator: http://localhost:${PORT}/standee`);
  console.log(`🍦 Admin Portal:      http://localhost:${PORT}/admin`);
  console.log('🍦 ================================================');
});

