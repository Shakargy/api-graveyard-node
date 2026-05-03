import { Batcher } from '../batcher';

describe('Batcher', () => {
    let batcher: Batcher;
    let sendSpy: jest.SpyInstance;

    beforeEach(() => {
        batcher = new Batcher({
            apiKey: 'agk_test',
            projectId: 'proj-123',
            flushIntervalMs: 60_000,
            maxBatchSize: 5,
            debug: false,
        });
        // Prevent real network calls
        sendSpy = jest.spyOn(batcher as any, 'send').mockResolvedValue(undefined);
    });

    afterEach(async () => {
        await batcher.shutdown();
        jest.restoreAllMocks();
    });

    it('queues events without sending immediately', () => {
        batcher.push({ ts: new Date().toISOString(), method: 'GET', url: 'https://api.stripe.com/charges' });
        expect((batcher as any).queue).toHaveLength(1);
        expect(sendSpy).not.toHaveBeenCalled();
    });

    it('auto-flushes when maxBatchSize is reached', async () => {
        for (let i = 0; i < 5; i++) {
            batcher.push({ ts: new Date().toISOString(), method: 'GET', url: `https://api.stripe.com/${i}` });
        }
        // Allow microtask queue to drain
        await Promise.resolve();
        expect(sendSpy).toHaveBeenCalledTimes(1);
        expect((batcher as any).queue).toHaveLength(0);
    });

    it('sends the correct payload shape', async () => {
        const event = { ts: '2026-01-01T00:00:00.000Z', method: 'POST', url: 'https://api.sendgrid.com/mail', status: 200, duration_ms: 42 };
        batcher.push(event);
        await batcher.flush();
        expect(sendSpy).toHaveBeenCalledWith([event]);
    });

    it('clears queue on shutdown', async () => {
        batcher.push({ ts: new Date().toISOString(), method: 'POST', url: 'https://api.sendgrid.com/mail' });
        await batcher.shutdown();
        expect((batcher as any).queue).toHaveLength(0);
        expect(sendSpy).toHaveBeenCalled();
    });

    it('does nothing on flush when queue is empty', async () => {
        await batcher.flush();
        expect(sendSpy).not.toHaveBeenCalled();
    });
});
