import express from 'express';
import { CopilotClient } from '@github/copilot-sdk';

const app = express();
const PORT = process.env.COPILOT_PORT || 3000;
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Middleware
app.use(express.json());

// Logger utility
const logger = {
    debug: (msg, ...args) => LOG_LEVEL === 'debug' && console.log(`[DEBUG] ${msg}`, ...args),
    info: (msg, ...args) => ['debug', 'info'].includes(LOG_LEVEL) && console.log(`[INFO] ${msg}`, ...args),
    warn: (msg, ...args) => ['debug', 'info', 'warn'].includes(LOG_LEVEL) && console.warn(`[WARN] ${msg}`, ...args),
    error: (msg, ...args) => console.error(`[ERROR] ${msg}`, ...args)
};

// Global Copilot client instance
let copilotClient = null;
let isInitialized = false;

// Initialize Copilot client
async function initializeCopilot() {
    if (isInitialized) return;
    
    try {
        logger.info('Initializing GitHub Copilot client...');
        copilotClient = new CopilotClient();
        await copilotClient.start();
        isInitialized = true;
        logger.info('GitHub Copilot client initialized successfully');
    } catch (error) {
        logger.error('Failed to initialize Copilot client:', error.message);
        throw error;
    }
}

// Health check endpoint
app.get('/health', (req, res) => {
    const health = {
        status: isInitialized ? 'healthy' : 'initializing',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0'
    };
    
    const statusCode = isInitialized ? 200 : 503;
    res.status(statusCode).json(health);
});

// Query endpoint (non-streaming)
app.post('/query', async (req, res) => {
    try {
        if (!isInitialized) {
            return res.status(503).json({ 
                error: 'Service not ready', 
                message: 'Copilot client is still initializing' 
            });
        }

        const { prompt, model = 'gpt-4' } = req.body;

        if (!prompt) {
            return res.status(400).json({ 
                error: 'Bad request', 
                message: 'Prompt is required' 
            });
        }

        logger.debug('Received query:', prompt);

        // Create a new session and send the prompt
        const session = await copilotClient.createSession({ model });
        const response = await session.send({ prompt });

        logger.debug('Response received from Copilot');

        res.json({
            response: response.content || response.text || '',
            model,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Error processing query:', error.message);
        res.status(500).json({ 
            error: 'Internal server error', 
            message: error.message 
        });
    }
});

// Query endpoint with streaming support
app.post('/query/stream', async (req, res) => {
    try {
        if (!isInitialized) {
            return res.status(503).json({ 
                error: 'Service not ready', 
                message: 'Copilot client is still initializing' 
            });
        }

        const { prompt, model = 'gpt-4' } = req.body;

        if (!prompt) {
            return res.status(400).json({ 
                error: 'Bad request', 
                message: 'Prompt is required' 
            });
        }

        logger.debug('Received streaming query:', prompt);

        // Set up Server-Sent Events
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // Create a new session and send the prompt with streaming
        const session = await copilotClient.createSession({ model });
        
        // Send initial event
        res.write(`data: ${JSON.stringify({ type: 'start', timestamp: new Date().toISOString() })}\n\n`);

        const stream = session.sendStream({ prompt });

        for await (const chunk of stream) {
            const content = chunk.content || chunk.text || '';
            if (content) {
                res.write(`data: ${JSON.stringify({ type: 'chunk', content })}\n\n`);
            }
        }

        // Send completion event
        res.write(`data: ${JSON.stringify({ type: 'done', timestamp: new Date().toISOString() })}\n\n`);
        res.end();

        logger.debug('Streaming response completed');

    } catch (error) {
        logger.error('Error processing streaming query:', error.message);
        res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
        res.end();
    }
});

// Info endpoint
app.get('/', (req, res) => {
    res.json({
        service: 'GitHub Copilot CLI Server',
        version: '1.0.0',
        endpoints: {
            health: 'GET /health',
            query: 'POST /query',
            queryStream: 'POST /query/stream'
        },
        documentation: 'https://github.com/0GiS0/github-copilot-chat-extension-ado'
    });
});

// Graceful shutdown
async function gracefulShutdown(signal) {
    logger.info(`${signal} received, shutting down gracefully...`);
    
    if (copilotClient) {
        try {
            await copilotClient.stop();
            logger.info('Copilot client stopped');
        } catch (error) {
            logger.error('Error stopping Copilot client:', error.message);
        }
    }
    
    process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
async function startServer() {
    try {
        // Initialize Copilot client
        await initializeCopilot();
        
        // Start Express server
        app.listen(PORT, '0.0.0.0', () => {
            logger.info(`GitHub Copilot CLI Server listening on port ${PORT}`);
            logger.info(`Health check: http://0.0.0.0:${PORT}/health`);
            logger.info(`API endpoint: http://0.0.0.0:${PORT}/query`);
            logger.info(`Streaming endpoint: http://0.0.0.0:${PORT}/query/stream`);
        });
    } catch (error) {
        logger.error('Failed to start server:', error.message);
        process.exit(1);
    }
}

startServer();
