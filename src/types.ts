export interface HttpEvent {
    ts: string;
    method: string;
    url: string;
    status?: number;
    duration_ms?: number;
    service_name?: string;
    environment?: string;
}

export interface ApiGraveyardOptions {
    apiKey: string;
    projectId: string;
    baseUrl?: string;
    serviceName?: string;
    environment?: string;
    flushIntervalMs?: number;
    maxBatchSize?: number;
    debug?: boolean;
}
