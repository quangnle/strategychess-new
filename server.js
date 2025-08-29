const express = require('express');
const path = require('path');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;
const isDebug = process.argv.includes('--inspect') || process.argv.includes('--inspect-brk');

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

// Main route
app.get('/', (req, res) => {
    console.log('Serving index.html from public folder');
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Debug API endpoints
app.get('/api/debug', (req, res) => {
    const debugInfo = {
        server: 'Node.js Express Debug Server',
        timestamp: new Date().toISOString(),
        debugMode: isDebug,
        files: {
            'index.html': require('fs').existsSync(path.join(__dirname, 'public', 'index.html')),
            'index.js': require('fs').existsSync(path.join(__dirname, 'public', 'index.js')),
            'p5-battle-sketch.js': require('fs').existsSync(path.join(__dirname, 'public', 'p5-battle-sketch.js')),
            'definitions.js': require('fs').existsSync(path.join(__dirname, 'core-logic/definitions.js')),
            'style.css': require('fs').existsSync(path.join(__dirname, 'style.css'))
        },
        directories: {
            'public': require('fs').existsSync(path.join(__dirname, 'public')),
            'imgs': require('fs').existsSync(path.join(__dirname, 'public', 'imgs')),
            'core-logic': require('fs').existsSync(path.join(__dirname, 'core-logic'))
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
const initSocket = require('./realtime/index.js');
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