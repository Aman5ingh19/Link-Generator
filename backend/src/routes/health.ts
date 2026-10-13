import { Router, Request, Response } from 'express';
import { checkDatabaseConnection } from '../db';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const dbOk = await checkDatabaseConnection();

  const status = dbOk ? 'healthy' : 'degraded';
  const statusCode = dbOk ? 200 : 503;

  return res.status(statusCode).json({
    status,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: dbOk ? 'connected' : 'disconnected',
    tracing: process.env.ZIPKIN_ENDPOINT ? 'enabled' : 'disabled',
  });
});

export default router;
