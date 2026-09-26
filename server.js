const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;
const ROOT_DIR = __dirname;
const DIST_DIR = path.join(__dirname, 'dist');
const DATA_DIR = path.join(__dirname, 'data');

if (!fs.existsSync(DATA_DIR)) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}
}

const WORKSHOPS_FILE = path.join(DATA_DIR, 'workshops.json');
const INVOICES_FILE = path.join(DATA_DIR, 'invoices.json');

function readJsonFile(filePath, defaultVal = {}) {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.warn(`Error reading ${filePath}:`, err.message);
  }
  return defaultVal;
}

function writeJsonFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.warn(`Error writing ${filePath}:`, err.message);
  }
}

let workshopsStore = readJsonFile(WORKSHOPS_FILE, {});
let invoicesStore = readJsonFile(INVOICES_FILE, {});

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 50 * 1024 * 1024) { // 50MB limit
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

function getSafeFilePath(urlPath) {
  const cleanPath = urlPath.split('?')[0].split('#')[0];
  const relativePath = cleanPath === '/' ? 'index.html' : cleanPath.replace(/^\/+/, '');
  const safePath = path.normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');
  
  // Check ROOT_DIR first, then DIST_DIR
  const rootPath = path.join(ROOT_DIR, safePath);
  if (fs.existsSync(rootPath) && fs.statSync(rootPath).isFile()) {
    return rootPath;
  }
  const distPath = path.join(DIST_DIR, safePath);
  if (fs.existsSync(distPath) && fs.statSync(distPath).isFile()) {
    return distPath;
  }
  return null;
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // --- API Routes for Live Multi-Tenant Synchronization ---
  if (pathname.startsWith('/api/')) {
    if (pathname === '/api/workshop/sync' && req.method === 'POST') {
      const data = await parseBody(req);
      if (!data || !data.id) {
        return sendJson(res, 400, { success: false, message: 'Workshop id required' });
      }
      const existing = workshopsStore[data.id] || {};
      const updated = {
        ...existing,
        ...data,
        id: String(data.id),
        code: String(data.code || existing.code || ''),
        name: String(data.name || existing.name || 'ورشة الرخام'),
        ownerName: String(data.ownerName || existing.ownerName || 'المدير'),
        ownerEmail: String(data.ownerEmail || existing.ownerEmail || ''),
        craftsmen: Array.isArray(data.craftsmen) ? data.craftsmen : (existing.craftsmen || []),
        updatedAt: new Date().toISOString()
      };
      workshopsStore[data.id] = updated;
      writeJsonFile(WORKSHOPS_FILE, workshopsStore);
      return sendJson(res, 200, { success: true, workshop: updated });
    }

    if (pathname === '/api/workshop' && req.method === 'GET') {
      const wsId = query.id;
      const wsCode = query.code;
      if (wsId && workshopsStore[wsId]) {
        return sendJson(res, 200, { success: true, workshop: workshopsStore[wsId] });
      }
      if (wsCode) {
        const found = Object.values(workshopsStore).find(w => w.code && w.code.toUpperCase() === wsCode.toUpperCase());
        if (found) {
          return sendJson(res, 200, { success: true, workshop: found });
        }
      }
      return sendJson(res, 404, { success: false, message: 'Workshop not found' });
    }

    if (pathname === '/api/workshop/join-request' && req.method === 'POST') {
      const { code, craftsman } = await parseBody(req);
      if (!code || !craftsman) {
        return sendJson(res, 400, { success: false, message: 'Code and craftsman required' });
      }
      const normCode = code.toUpperCase().trim();
      const ws = Object.values(workshopsStore).find(w => w.code && w.code.toUpperCase() === normCode);
      if (!ws) {
        return sendJson(res, 404, { success: false, message: 'كود الورشة غير موجود' });
      }

      ws.craftsmen = ws.craftsmen || [];
      const existingIdx = ws.craftsmen.findIndex(c => 
        (craftsman.id && c.id === craftsman.id) ||
        (craftsman.phone && c.phone === craftsman.phone) ||
        (c.name === craftsman.name)
      );

      const requestEntry = {
        id: craftsman.id || ('cr_' + Date.now()),
        name: craftsman.name || 'صنايعي',
        phone: craftsman.phone || '',
        status: 'pending',
        requestedAt: new Date().toLocaleDateString('ar-EG'),
        joinedAt: new Date().toLocaleDateString('ar-EG'),
        invoicesCount: 0
      };

      if (existingIdx !== -1) {
        // If already approved, keep status approved
        if (ws.craftsmen[existingIdx].status === 'approved') {
          requestEntry.status = 'approved';
          requestEntry.approvedAt = ws.craftsmen[existingIdx].approvedAt;
          requestEntry.approvedBy = ws.craftsmen[existingIdx].approvedBy;
        }
        ws.craftsmen[existingIdx] = { ...ws.craftsmen[existingIdx], ...requestEntry };
      } else {
        ws.craftsmen.push(requestEntry);
      }

      ws.updatedAt = new Date().toISOString();
      workshopsStore[ws.id] = ws;
      writeJsonFile(WORKSHOPS_FILE, workshopsStore);

      return sendJson(res, 200, {
        success: true,
        workshopId: ws.id,
        workshopName: ws.name,
        craftsman: requestEntry
      });
    }

    if (pathname === '/api/workshop/approve-craftsman' && req.method === 'POST') {
      const { workshopId, craftsmanId, approvedBy } = await parseBody(req);
      const ws = workshopsStore[workshopId];
      if (!ws) return sendJson(res, 404, { success: false, message: 'Workshop not found' });
      
      ws.craftsmen = ws.craftsmen || [];
      const c = ws.craftsmen.find(item => item.id === craftsmanId);
      if (c) {
        c.status = 'approved';
        c.approvedAt = new Date().toLocaleDateString('ar-EG');
        c.approvedBy = approvedBy || 'المدير المسؤول';
        ws.updatedAt = new Date().toISOString();
        writeJsonFile(WORKSHOPS_FILE, workshopsStore);
        return sendJson(res, 200, { success: true, workshop: ws, craftsman: c });
      }
      return sendJson(res, 404, { success: false, message: 'Craftsman not found' });
    }

    if (pathname === '/api/workshop/reject-craftsman' && req.method === 'POST') {
      const { workshopId, craftsmanId } = await parseBody(req);
      const ws = workshopsStore[workshopId];
      if (!ws) return sendJson(res, 404, { success: false, message: 'Workshop not found' });

      ws.craftsmen = (ws.craftsmen || []).filter(item => item.id !== craftsmanId);
      ws.updatedAt = new Date().toISOString();
      writeJsonFile(WORKSHOPS_FILE, workshopsStore);
      return sendJson(res, 200, { success: true, workshop: ws });
    }

    if (pathname === '/api/invoices/sync' && req.method === 'POST') {
      const data = await parseBody(req);
      const targetWsId = data.workshopId;
      if (!targetWsId) return sendJson(res, 400, { success: false, message: 'workshopId required' });

      invoicesStore[targetWsId] = invoicesStore[targetWsId] || [];
      const list = invoicesStore[targetWsId];

      const incomingList = Array.isArray(data.invoices) ? data.invoices : (data.invoice ? [data.invoice] : []);
      let saved = 0;

      for (const item of incomingList) {
        if (!item || !item.id) continue;
        const idx = list.findIndex(inv => String(inv.id) === String(item.id));
        if (idx !== -1) {
          list[idx] = { ...list[idx], ...item, updatedAt: new Date().toISOString() };
        } else {
          list.unshift({ ...item, updatedAt: new Date().toISOString() });
        }
        saved++;
      }

      writeJsonFile(INVOICES_FILE, invoicesStore);
      return sendJson(res, 200, { success: true, savedCount: saved, total: list.length });
    }

    if (pathname === '/api/invoices' && req.method === 'GET') {
      const targetWsId = query.workshopId;
      if (!targetWsId) return sendJson(res, 400, { success: false, message: 'workshopId required' });
      const list = invoicesStore[targetWsId] || [];
      return sendJson(res, 200, { success: true, invoices: list });
    }

    return sendJson(res, 404, { success: false, message: 'Endpoint not found' });
  }

  // --- Static File Serving ---
  const filePath = getSafeFilePath(req.url);
  
  if (filePath) {
    const extname = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';
    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Server Error');
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      }
    });
  } else {
    // SPA fallback to index.html
    const fallbackPath = fs.existsSync(path.join(ROOT_DIR, 'index.html'))
      ? path.join(ROOT_DIR, 'index.html')
      : path.join(DIST_DIR, 'index.html');
      
    fs.readFile(fallbackPath, (err, content) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(content);
      }
    });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

