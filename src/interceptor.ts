import type * as HttpType from 'http';
import type * as HttpsType from 'https';
import { URL } from 'url';
import { HttpEvent, ApiGraveyardOptions } from './types';
import { Batcher } from './batcher';

// Use require() to get the actual mutable CJS module object (not a frozen __importStar wrapper)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const http = require('http') as typeof HttpType;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const https = require('https') as typeof HttpsType;

// URLs we own — never capture these to avoid infinite loops
const SELF_HOSTNAMES = new Set(['api-graveyard.com', 'www.api-graveyard.com']);

let patched = false;

export function patch(batcher: Batcher, options: ApiGraveyardOptions): void {
    if (patched) return;
    patched = true;

    const serviceName = options.serviceName;
    const environment = options.environment ?? process.env.NODE_ENV ?? 'production';
    const baseHost = options.baseUrl ? new URL(options.baseUrl ?? 'https://api-graveyard.com').hostname : 'api-graveyard.com';
    const ignoredHostnames = new Set([...SELF_HOSTNAMES, baseHost, 'localhost', '127.0.0.1', '::1']);

    patchModule(http, batcher, serviceName, environment, ignoredHostnames);
    patchModule(https, batcher, serviceName, environment, ignoredHostnames);
}

export function unpatch(): void {
    if (!patched) return;
    restoreModule(http);
    restoreModule(https);
    patched = false;
}

const originals = new WeakMap<object, Function>();

function patchModule(mod: typeof HttpType | typeof HttpsType, batcher: Batcher, serviceName: string | undefined, environment: string, ignoredHostnames: Set<string>): void {
    const original = mod.request;
    originals.set(mod, original);

    const patchedRequest = function patchedRequest(
        urlOrOptions: string | URL | HttpType.RequestOptions,
        optionsOrCallback?: HttpType.RequestOptions | ((res: HttpType.IncomingMessage) => void),
        callback?: (res: HttpType.IncomingMessage) => void,
    ): HttpType.ClientRequest {
        const start = Date.now();

        let method = 'GET';
        let fullUrl = '';

        try {
            if (typeof urlOrOptions === 'string' || urlOrOptions instanceof URL) {
                const u = new URL(urlOrOptions.toString());
                fullUrl = u.toString();
                if (ignoredHostnames.has(u.hostname)) {
                    return (original as Function)(urlOrOptions, optionsOrCallback, callback);
                }
                if (optionsOrCallback && typeof optionsOrCallback === 'object') {
                    method = (optionsOrCallback as HttpType.RequestOptions).method?.toUpperCase() ?? 'GET';
                }
            } else {
                const opts = urlOrOptions as HttpType.RequestOptions;
                method = opts.method?.toUpperCase() ?? 'GET';
                const host = opts.hostname ?? opts.host ?? 'localhost';
                if (ignoredHostnames.has(host)) {
                    return (original as Function)(urlOrOptions, optionsOrCallback, callback);
                }
                const proto = mod === https ? 'https' : 'http';
                const port = opts.port ? `:${opts.port}` : '';
                fullUrl = `${proto}://${host}${port}${opts.path ?? '/'}`;
            }
        } catch {
            return (original as Function)(urlOrOptions, optionsOrCallback, callback);
        }

        const req: HttpType.ClientRequest = (original as Function)(urlOrOptions, optionsOrCallback, callback);

        req.on('response', (res: HttpType.IncomingMessage) => {
            const event: HttpEvent = {
                ts: new Date().toISOString(),
                method,
                url: fullUrl,
                status: res.statusCode,
                duration_ms: Date.now() - start,
                ...(serviceName ? { service_name: serviceName } : {}),
                environment,
            };
            batcher.push(event);
        });

        req.on('error', () => {
            const event: HttpEvent = {
                ts: new Date().toISOString(),
                method,
                url: fullUrl,
                duration_ms: Date.now() - start,
                ...(serviceName ? { service_name: serviceName } : {}),
                environment,
            };
            batcher.push(event);
        });

        return req;
    };

    Object.defineProperty(mod, 'request', { value: patchedRequest, writable: true, configurable: true });
}

function restoreModule(mod: typeof HttpType | typeof HttpsType): void {
    const original = originals.get(mod);
    if (original) {
        Object.defineProperty(mod, 'request', { value: original, writable: true, configurable: true });
        originals.delete(mod);
    }
}
