// =============================================================================
// frontend/src/tracing.ts — Browser-Side OpenTelemetry + Zipkin Setup
// =============================================================================
// Purpose:
//   Initialises the OpenTelemetry Web SDK to trace every fetch() API call
//   made by the React frontend. This creates "browser spans" that contain:
//     - The user action (e.g., "POST /api/links/consume")
//     - Network round-trip latency from the browser perspective
//     - A W3C traceparent header injected into each request so the Express
//       backend continues the same trace (full end-to-end distributed trace)
//
// How Distributed Tracing Works End-To-End:
//   1. Browser calls fetch('/api/links/:token/consume')
//   2. This file's FetchInstrumentation automatically adds:
//        traceparent: 00-<traceId>-<spanId>-01
//      to the HTTP request headers.
//   3. Express receives the header; OpenTelemetry on the backend
//      reads it and creates a CHILD span under the same traceId.
//   4. The backend span records DB query time and sends spans to Zipkin.
//   5. The browser span also exports to Zipkin.
//   6. In Zipkin UI you see: browser span → Express span → DB span
//      all linked by the same traceId — one complete waterfall.
//
// NOTE: Zipkin must be running (docker compose up -d zipkin) to see traces.
//       The CORS proxy in vite.config.ts / nginx.conf routes /zipkin/* to
//       http://zipkin:9411 so browser → Zipkin export works without CORS errors.
// =============================================================================

import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { ZipkinExporter } from '@opentelemetry/exporter-zipkin';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { propagation, trace } from '@opentelemetry/api';

// -----------------------------------------------------------------------
// 1. Zipkin Exporter
//    Routes through the local proxy path /zipkin/api/v2/spans so that
//    Vite dev server (vite.config.ts) and Nginx (nginx.conf) can forward
//    the request to the Zipkin container at http://zipkin:9411.
//    This avoids CORS errors since the browser talks to its own origin.
// -----------------------------------------------------------------------
const zipkinExporter = new ZipkinExporter({
  url: `${window.location.origin}/zipkin/api/v2/spans`,
  serviceName: 'link-generator-frontend',
});

// -----------------------------------------------------------------------
// 2. Tracer Provider
//    The WebTracerProvider is the browser equivalent of NodeSDK on the backend.
//    - Resource identifies this service in Zipkin (shows as "link-generator-frontend")
//    - BatchSpanProcessor buffers spans and sends them in bulk to Zipkin
//      rather than one HTTP request per span (more efficient).
// -----------------------------------------------------------------------
const provider = new WebTracerProvider({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'link-generator-frontend',
  }),
  spanProcessors: [
    new BatchSpanProcessor(zipkinExporter, {
      // Send buffered spans every 5 seconds or when buffer reaches 10 spans
      scheduledDelayMillis: 5000,
      maxExportBatchSize: 10,
    }),
  ],
});

// -----------------------------------------------------------------------
// 3. W3C Trace Context Propagator
//    Tells the SDK to use the W3C traceparent header standard when
//    injecting trace context into outgoing HTTP requests.
//    The backend's OpenTelemetry SDK is configured to READ this same
//    header format, enabling parent-child span linking across the network.
// -----------------------------------------------------------------------
propagation.setGlobalPropagator(new W3CTraceContextPropagator());

// Register provider globally so trace.getTracer() works anywhere in the app
provider.register();

// -----------------------------------------------------------------------
// 4. Automatic Fetch Instrumentation
//    Intercepts every window.fetch() call and:
//      a) Creates a new span around the request
//      b) Injects the traceparent header into request headers
//      c) Records HTTP method, URL, status code, and duration
//    No code changes needed in api/client.ts — instrumentation is automatic.
// -----------------------------------------------------------------------
registerInstrumentations({
  instrumentations: [
    new FetchInstrumentation({
      // Only trace calls to our own API, not CDN assets or analytics beacons
      propagateTraceHeaderCorsUrls: [
        // Match all paths starting with /api/
        new RegExp(`^${window.location.origin}/api/.*`),
      ],
      // Clear timing resources after recording to avoid memory leaks
      // in long-running SPA sessions
      clearTimingResources: true,
    }),
  ],
});

// -----------------------------------------------------------------------
// 5. Export Tracer for Manual Spans (optional use in components)
//    Components can import { frontendTracer } and wrap user interactions
//    (e.g., a button click that triggers multiple API calls) in a single
//    parent span for richer trace context.
//
//    Example usage in a component:
//      import { frontendTracer } from '../tracing';
//      frontendTracer.startActiveSpan('user.consumeLink', (span) => {
//        span.setAttribute('link.token', token);
//        await consumeLink(token);
//        span.end();
//      });
// -----------------------------------------------------------------------
export const frontendTracer = trace.getTracer('link-generator-frontend');

console.log('[Tracing] OpenTelemetry frontend tracing initialised. Exporting to Zipkin via /zipkin proxy.');
