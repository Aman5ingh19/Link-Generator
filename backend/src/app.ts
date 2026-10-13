import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import linksRouter from './routes/links';
import healthRouter from './routes/health';

export const app = express();

// Middlewares
app.use(cors({
  origin: '*', // Allow all origins for dev / flexible client integration
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Routes
app.use('/api/health', healthRouter);
app.use('/api/links', linksRouter);

// Root route
app.get('/', (_req: Request, res: Response) => {
  res.json({
    service: 'One-Time Link Generator API',
    status: 'online',
    version: '1.0.0',
    documentation: '/api/links, /api/health',
  });
});

// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'NOT_FOUND',
    message: `Endpoint ${req.method} ${req.url} does not exist.`,
  });
});

// Error handling middleware
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Unhandled Error]:', err);
  res.status(500).json({
    success: false,
    error: 'INTERNAL_SERVER_ERROR',
    message: err.message || 'An unexpected error occurred.',
  });
});

export default app;
