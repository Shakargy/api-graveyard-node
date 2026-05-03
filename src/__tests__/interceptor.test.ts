import * as http from 'http';
import { patch, unpatch } from '../interceptor';
import { Batcher } from '../batcher';

describe('interceptor', () => {
    let batcher: Batcher;
    const originalRequest = http.request;

    beforeEach(() => {
        batcher = new Batcher({
            apiKey: 'agk_test',
            projectId: 'proj-123',
            flushIntervalMs: 60_000,
        });
        patch(batcher, { apiKey: 'agk_test', projectId: 'proj-123' });
    });

    afterEach(async () => {
        unpatch();
        await batcher.shutdown();
    });

    it('replaces http.request', () => {
        expect(http.request).not.toBe(originalRequest);
    });

    it('restores http.request after unpatch', () => {
        unpatch();
        expect(http.request).toBe(originalRequest);
        // re-patch for afterEach cleanup
        patch(batcher, { apiKey: 'agk_test', projectId: 'proj-123' });
    });

    it('does not patch twice', () => {
        const patched = http.request;
        patch(batcher, { apiKey: 'agk_test', projectId: 'proj-123' });
        expect(http.request).toBe(patched);
    });
});
