import dotenv from 'dotenv';
dotenv.config();

// OpenTelemetry tracing must be initialized before requiring Express & HTTP modules
import { initTracing } from './tracing';
initTracing();

import app from './app';

const PORT = Number(process.env.PORT) || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`=================================================`);
  console.log(`🚀 One-Time Link Generator Backend listening on port ${PORT}`);
  console.log(`📡 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`🔗 API Base:    http://localhost:${PORT}/api/links`);
  console.log(`=================================================`);
});
