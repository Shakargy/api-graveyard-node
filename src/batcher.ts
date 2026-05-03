import { HttpEvent, ApiGraveyardOptions } from './types';

export class Batcher {
    private queue: HttpEvent[] = [];
    private timer: NodeJS.Timeout | null = null;
    private readonly options: Required<Pick<ApiGraveyardOptions, 'apiKey' | 'projectId' | 'baseUrl' | 'flushIntervalMs' | 'maxBatchSize' | 'debug'>>;

    constructor(options: ApiGraveyardOptions) {
        this.options = {
            apiKey: options.apiKey,
            projectId: options.projectId,
            baseUrl: options.baseUrl ?? 'https://api-graveyard.com',
            flushIntervalMs: options.flushIntervalMs ?? 10_000,
            maxBatchSize: options.maxBatchSize ?? 100,
            debug: options.debug ?? false,
        };
        this.startTimer();
    }

    push(event: HttpEvent): void {
        this.queue.push(event);
        if (this.queue.length >= this.options.maxBatchSize) {
            this.flush();
        }
    }

    async flush(): Promise<void> {
        if (this.queue.length === 0) return;
        const batch = this.queue.splice(0, this.options.maxBatchSize);
        await this.send(batch);
    }

    private startTimer(): void {
        this.timer = setInterval(() => {
            this.flush().catch(() => {});
        }, this.options.flushIntervalMs);
        // Don't block process exit
        if (this.timer.unref) this.timer.unref();
    }

    shutdown(): Promise<void> {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        return this.flush();
    }

    private async send(events: HttpEvent[]): Promise<void> {
        const url = `${this.options.baseUrl}/api/v1/projects/${this.options.projectId}/ingest/events/`;
        try {
            // Use native https to avoid triggering our own interceptor
            const https = await import('https');
            const http = await import('http');
            const { URL } = await import('url');

            const parsed = new URL(url);
            const body = JSON.stringify(events);
            const mod = parsed.protocol === 'https:' ? https : http;

            await new Promise<void>((resolve, reject) => {
                const req = mod.request({
                    hostname: parsed.hostname,
                    port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
                    path: parsed.pathname,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(body),
                        'X-API-Key': this.options.apiKey,
                    },
                }, (res) => {
                    res.resume();
                    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                        resolve();
                    } else {
                        if (this.options.debug) {
                            console.warn(`[api-graveyard] Ingest returned ${res.statusCode}`);
                        }
                        resolve(); // don't crash the app on non-2xx
                    }
                });
                req.on('error', (err) => {
                    if (this.options.debug) {
                        console.warn('[api-graveyard] Flush error:', err.message);
                    }
                    resolve(); // swallow — never crash the host app
                });
                req.write(body);
                req.end();
            });

            if (this.options.debug) {
                console.log(`[api-graveyard] Flushed ${events.length} event(s)`);
            }
        } catch (err: any) {
            if (this.options.debug) {
                console.warn('[api-graveyard] Send error:', err?.message);
            }
        }
    }
}
