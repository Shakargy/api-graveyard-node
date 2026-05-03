# api-graveyard

Official Node.js collector for [API Graveyard](https://api-graveyard.com) — automatically tracks your outgoing HTTP dependencies, detects risk events, and surfaces zombie APIs before they take down your product.

## Install

```bash
npm install api-graveyard
```

## Quick start

Add one line to the top of your app entry point:

```js
const apiGraveyard = require('api-graveyard');

apiGraveyard.init({
  apiKey: 'agk_your_key_here',
  projectId: 'your-project-id',
});

// ... rest of your app
```

That's it. Every outgoing HTTP/HTTPS request your app makes is now automatically captured, batched, and sent to API Graveyard in the background.

## TypeScript

```ts
import { init } from 'api-graveyard';

init({
  apiKey: process.env.API_GRAVEYARD_KEY!,
  projectId: process.env.API_GRAVEYARD_PROJECT_ID!,
  serviceName: 'my-backend',
  environment: process.env.NODE_ENV,
});
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | **required** | Your `agk_...` API key from the dashboard |
| `projectId` | `string` | **required** | Your project ID from the dashboard |
| `baseUrl` | `string` | `https://api-graveyard.com` | Override for self-hosted |
| `serviceName` | `string` | `undefined` | Tag events with a service name |
| `environment` | `string` | `process.env.NODE_ENV` | Tag events with an environment |
| `flushIntervalMs` | `number` | `10000` | How often to flush the event buffer (ms) |
| `maxBatchSize` | `number` | `100` | Max events per batch before forcing a flush |
| `debug` | `boolean` | `false` | Log flush activity to console |

## Express middleware

If you only want to capture inbound requests to your own Express server (not outgoing calls):

```js
const { middleware } = require('api-graveyard');

app.use(middleware({
  apiKey: 'agk_your_key_here',
  projectId: 'your-project-id',
  serviceName: 'my-api',
}));
```

## Graceful shutdown

The collector automatically flushes on `SIGTERM` and `beforeExit`. For manual control:

```js
process.on('SIGINT', async () => {
  await apiGraveyard.shutdown();
  process.exit(0);
});
```

## What gets captured

- Method, URL, HTTP status code, response time
- Timestamp of each request
- Service name and environment (if configured)

Requests to `api-graveyard.com` itself are never captured to avoid infinite loops.
Localhost and `127.0.0.1` requests are ignored by default.

## Get your API key

1. Sign up at [api-graveyard.com](https://api-graveyard.com)
2. Create a project
3. Go to **Settings → Integrations** and create an API key

## License

MIT
