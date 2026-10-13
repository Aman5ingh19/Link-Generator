import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { ZipkinExporter } from '@opentelemetry/exporter-zipkin';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { trace } from '@opentelemetry/api';

const zipkinEndpoint = process.env.ZIPKIN_ENDPOINT || 'http://localhost:9411/api/v2/spans';

const zipkinExporter = new ZipkinExporter({
  url: zipkinEndpoint,
  serviceName: 'link-generator-backend',
});

export const otelSDK = new NodeSDK({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: 'link-generator-backend',
  }),
  traceExporter: zipkinExporter,
  instrumentations: [
    getNodeAutoInstrumentations({
      // Auto-instruments HTTP, Express, MySQL/Prisma queries
      '@opentelemetry/instrumentation-fs': { enabled: false }, // reduce noise from file reads
    }),
  ],
});

export const tracer = trace.getTracer('link-generator-backend');

export function initTracing() {
  try {
    otelSDK.start();
    console.log(`[Observability] OpenTelemetry initialized. Exporting traces to Zipkin at ${zipkinEndpoint}`);
  } catch (err) {
    console.warn('[Observability] Failed to start OpenTelemetry SDK:', err);
  }

  process.on('SIGTERM', () => {
    otelSDK.shutdown()
      .then(() => console.log('[Observability] Tracing terminated'))
      .catch((err) => console.error('[Observability] Error terminating tracing', err))
      .finally(() => process.exit(0));
  });
}
