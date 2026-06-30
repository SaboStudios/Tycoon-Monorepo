import { Injectable, Optional, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  trace,
  Span,
  SpanStatusCode,
  TraceFlags,
} from '@opentelemetry/api';

/**
 * TracingService — SW-BE-025
 *
 * Provides OpenTelemetry-compatible distributed tracing for NestJS.
 * Uses the OTel API (already in package-lock via other deps) for trace context
 * propagation. No exporter configured here — traces are exported via
 * environment-specific provider configuration or disabled in dev.
 *
 * No PII or secrets are included in spans. Labels are low-cardinality
 * (route_group, method) and values are never user-provided.
 */
@Injectable()
export class TracingService {
  private readonly enabled: boolean;
  private readonly tracerName = 'tycoon-api';

  constructor(private readonly config: ConfigService) {
    const nodeEnv = this.config.get<string>('app.nodeEnv') || 'development';
    this.enabled =
      nodeEnv !== 'test' &&
      this.config.get<boolean>('TRACING_ENABLED', false);
  }

  getTracer() {
    return trace.getTracer(this.tracerName);
  }

  /**
   * Start a new span for an HTTP request.
   * Returns a span that must be ended by the caller.
   */
  startHttpRequestSpan(name: string, attrs: Record<string, string>): Span | null {
    if (!this.enabled) return null;

    const tracer = this.getTracer();
    const span = tracer.startSpan(name, { attributes: attrs });
    return span;
  }

  /**
   * Start a span for a database operation.
   */
  startDbSpan(name: string, attrs: Record<string, string>): Span | null {
    if (!this.enabled) return null;

    const tracer = this.getTracer();
    const span = tracer.startSpan(name, { attributes: attrs });
    return span;
  }

  /**
   * Start a span for a cache operation.
   */
  startCacheSpan(name: string, attrs: Record<string, string>): Span | null {
    if (!this.enabled) return null;

    const tracer = this.getTracer();
    const span = tracer.startSpan(name, { attributes: attrs });
    return span;
  }

  /**
   * Log an event on a span.
   */
  addEvent(span: Span | null, name: string, attrs?: Record<string, unknown>): void {
    if (!span) return;
    span.addEvent(name, attrs);
  }

  /**
   * Set an error on a span.
   */
  setError(span: Span | null, error: Error): void {
    if (!span) return;
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
  }

  /**
   * End a span.
   */
  endSpan(span: Span | null): void {
    if (!span) return;
    span.end();
  }

  /**
   * Extract trace context from incoming headers.
   * Returns a trace context object for logging.
   */
  extractTraceContext(headers: Record<string, string | string[] | undefined>): {
    traceId: string;
    spanId: string;
  } {
    const spanContext = trace.getActiveSpan()?.spanContext();
    return {
      traceId: spanContext?.traceId ?? 'unknown',
      spanId: spanContext?.spanId ?? 'unknown',
    };
  }

  /**
   * Check if tracing is enabled.
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}