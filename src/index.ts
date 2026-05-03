import { ApiGraveyardOptions } from './types';
import { Batcher } from './batcher';
import { patch, unpatch } from './interceptor';

export { ApiGraveyardOptions } from './types';

let batcher: Batcher | null = null;

/**
 * Start capturing outgoing HTTP/HTTPS requests and sending them to API Graveyard.
 * Call this once at the top of your app entry point.
 */
export function init(options: ApiGraveyardOptions): void {
    if (batcher) {
        console.warn('[api-graveyard] Already initialized — call shutdown() first to reinitialize.');
        return;
    }
    if (!options.apiKey) throw new Error('[api-graveyard] apiKey is required');
    if (!options.projectId) throw new Error('[api-graveyard] projectId is required');

    batcher = new Batcher(options);
    patch(batcher, options);

    process.once('beforeExit', () => shutdown());
    process.once('SIGTERM', () => shutdown());
}

/**
 * Flush any buffered events and stop capturing.
 */
export async function shutdown(): Promise<void> {
    if (!batcher) return;
    unpatch();
    await batcher.shutdown();
    batcher = null;
}

/**
 * Express / Connect middleware — alternative to auto-instrumentation.
 * Use this if you only want to capture requests handled by your own server,
 * not outgoing third-party calls.
 *
 * @example
 * app.use(apiGraveyard.middleware({ apiKey: '...', projectId: '...' }))
 */
export function middleware(options: ApiGraveyardOptions) {
    const b = new Batcher(options);
    const serviceName = options.serviceName ?? 'express';
    const environment = options.environment ?? process.env.NODE_ENV ?? 'production';

    return function apiGraveyardMiddleware(
        req: { method?: string; url?: string; headers?: Record<string, string> },
        res: { statusCode?: number; on?: Function },
        next: Function,
    ) {
        const start = Date.now();
        const method = req.method ?? 'GET';
        const url = req.url ?? '/';

        if (res.on) {
            res.on('finish', () => {
                b.push({
                    ts: new Date().toISOString(),
                    method,
                    url,
                    status: res.statusCode,
                    duration_ms: Date.now() - start,
                    service_name: serviceName,
                    environment,
                });
            });
        }

        next();
    };
}
