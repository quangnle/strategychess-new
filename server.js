import express from 'express';
import path from 'path';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Nginx terminates TLS and proxies plain HTTP. Trust X-Forwarded-* so
// req.protocol is https when the proxy says so.
app.set('trust proxy', 1);
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3999;
const isDebug = process.argv.includes('--inspect') || process.argv.includes('--inspect-brk');
const TLS_ONLY_HOSTS = new Set(['strategychess.online', 'www.strategychess.online']);

function publicOrigin(req) {
    if (process.env.PUBLIC_ORIGIN) {
        return process.env.PUBLIC_ORIGIN
            .replace(/\/$/, '')
            .replace(/^http:\/\/([^/?#]+):443(?=\/|$)/i, 'https://$1');
    }

    let proto = String(req.get('x-forwarded-proto') || req.protocol || 'http')
        .split(',')[0]
        .trim()
        .toLowerCase()
        .replace(/:$/, '');
    if (proto !== 'http' && proto !== 'https') proto = 'http';

    let host = String(req.get('x-forwarded-host') || req.get('host') || `localhost:${PORT}`)
        .split(',')[0]
        .trim();

    const hostname = host.replace(/:\d+$/, '').replace(/^\[|\]$/g, '').toLowerCase();
    const port = (host.match(/:(\d+)$/) || [])[1]
        || String(req.get('x-forwarded-port') || '').split(',')[0].trim();

    // Live nginx forwards Host: strategychess.online:443 and does not send
    // X-Forwarded-Proto. Express then sees plain HTTP and would emit
    // http://strategychess.online:443/ . Facebook refetches og:url, sends
    // cleartext to port 443, and nginx returns
    // "400 The plain HTTP request was sent to HTTPS port".
    if (port === '443' || TLS_ONLY_HOSTS.has(hostname)) proto = 'https';

    if (proto === 'https') host = host.replace(/:443$/, '');
    else host = host.replace(/:80$/, '');

    return `${proto}://${host}`;
}

function sendPublicHtml(fileName, req, res) {
    const filePath = path.join(__dirname, 'public', fileName);
    fs.readFile(filePath, 'utf8', (err, html) => {
        if (err) {
            res.status(404).send('Not found');
            return;
        }
        const origin = publicOrigin(req);
        const pagePath = fileName === 'index.html' ? '/' : `/${fileName}`;
        const pageUrl = `${origin}${pagePath}`;
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.type('html').send(
            html.replaceAll('__OG_ORIGIN__', origin).replaceAll('__OG_URL__', pageUrl)
        );
    });
}

app.get(['/', '/index.html', '/play-with-ai.html', '/lobby.html', '/play.html', '/replay.html'], (req, res) => {
    const file = (req.path === '/' || req.path === '/index.html') ? 'index.html' : req.path.replace(/^\//, '');
    sendPublicHtml(file, req, res);
});

// Enhanced CORS configuration
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Serve static files from public folder with caching disabled for development
app.use(express.static(path.join(__dirname, 'public'), {
    etag: false,
    lastModified: false,
    setHeaders: (res, path) => {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
}));

// Serve core-logic directory
app.use('/core-logic', express.static(path.join(__dirname, 'core-logic'), {
    etag: false,
    lastModified: false,
    setHeaders: (res, path) => {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
}));

// Serve ai-processor directory
app.use('/ai-processor', express.static(path.join(__dirname, 'ai-processor'), {
    etag: false,
    lastModified: false,
    setHeaders: (res, path) => {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
}));

// Parse JSON bodies. Replays post the full action log.
app.use(express.json({ limit: '1mb' }));

// Debug middleware with enhanced logging
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    const method = req.method;
    const url = req.url;
    const userAgent = req.get('User-Agent');
    
    console.log(`[${timestamp}] ${method} ${url}`);
    console.log(`   User-Agent: ${userAgent}`);
    console.log(`   Headers: ${JSON.stringify(req.headers, null, 2)}`);
    
    // Log request body for POST/PUT requests
    if (['POST', 'PUT'].includes(method)) {
        console.log(`   Body: ${JSON.stringify(req.body, null, 2)}`);
    }
    
    next();
});

// API routes
import matchesRouter from './api/matches.js';
import replaysRouter from './api/replays.js';
app.use('/api/matches', matchesRouter);
app.use('/api/replays', replaysRouter);

// Debug API endpoints
app.get('/api/debug', (req, res) => {
    const debugInfo = {
        server: 'Node.js Express Debug Server',
        timestamp: new Date().toISOString(),
        debugMode: isDebug,
        files: {
            'index.html': fs.existsSync(path.join(__dirname, 'public', 'index.html')),
            'index.js': fs.existsSync(path.join(__dirname, 'public', 'index.js')),
            'battle-sketch.js': fs.existsSync(path.join(__dirname, 'public', 'battle-sketch.js')),
            'definitions.js': fs.existsSync(path.join(__dirname, 'core-logic/definitions.js')),
            'style.css': fs.existsSync(path.join(__dirname, 'style.css'))
        },
        directories: {
            'public': fs.existsSync(path.join(__dirname, 'public')),
            'imgs': fs.existsSync(path.join(__dirname, 'public', 'imgs')),
            'core-logic': fs.existsSync(path.join(__dirname, 'core-logic'))
        },
        environment: {
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch,
            memoryUsage: process.memoryUsage()
        }
    };
    
    res.json(debugInfo);
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error occurred:', err);
    console.error('Stack trace:', err.stack);
    
    res.status(500).json({
        error: err.message,
        stack: isDebug ? err.stack : undefined,
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use((req, res) => {
    console.log(`404 - File not found: ${req.url}`);
    res.status(404).json({
        error: 'File not found',
        path: req.url,
        timestamp: new Date().toISOString()
    });
});

// Initialize Socket.IO
import initSocket from './realtime/index.js';
initSocket(io);

// Start server
server.listen(PORT, () => {
    console.log('='.repeat(50));
    console.log('🚀 Strategy Chess Debug Server');
    console.log('='.repeat(50));
    console.log(`🌐 URL: http://localhost:${PORT}`);
    console.log(`📁 Static files: ${path.join(__dirname, 'public')}`);
    console.log(`🔧 Debug mode: ${isDebug ? 'ENABLED' : 'DISABLED'}`);
    console.log(`🌐 CORS: ENABLED for all origins`);
    
    if (isDebug) {
        console.log('🐛 Debugger available at: chrome://inspect');
        console.log('💡 Use Chrome DevTools to debug JavaScript');
    }
    
    console.log('📝 API Endpoints:');
    console.log(`   GET /api/debug - Debug information`);
    console.log(`   GET /api/health - Health check`);
    console.log('');
    console.log('Press Ctrl+C to stop the server');
    console.log('='.repeat(50));
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    process.exit(0);
});

// Unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Uncaught exception handler
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
}); 