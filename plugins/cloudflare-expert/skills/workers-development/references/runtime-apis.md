# Workers Runtime APIs Reference

Complete reference for Cloudflare Workers runtime APIs, including Web standard APIs and Cloudflare-specific extensions.

## Web Standard APIs

### fetch()

Make HTTP requests to external services:

```javascript
// GET request
const response = await fetch('https://api.example.com/data');
const json = await response.json();

// POST request with JSON
const response = await fetch('https://api.example.com/users', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${env.API_TOKEN}`
  },
  body: JSON.stringify({ name: 'John', email: 'john@example.com' })
});

// With custom headers
const response = await fetch('https://api.example.com', {
  headers: {
    'User-Agent': 'My Worker/1.0',
    'Accept': 'application/json'
  }
});

// Error handling
try {
  const response = await fetch('https://api.example.com');
  if (!response.ok) {
    throw new Error(`HTTP error ${response.status}`);
  }
  const data = await response.json();
} catch (error) {
  console.error('Fetch failed:', error);
}
```

### Request Object

```javascript
// Creating requests
const request = new Request('https://example.com', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ data: 'value' })
});

// Cloning requests (needed when reading body multiple times)
const clonedRequest = request.clone();

// Reading request properties
const url = request.url; // Full URL string
const method = request.method; // GET, POST, etc.
const headers = request.headers; // Headers object

// Reading body (can only be done once unless cloned)
const json = await request.json();
const text = await request.text();
const formData = await request.formData();
const arrayBuffer = await request.arrayBuffer();
const blob = await request.blob();

// Cloudflare-specific properties
const country = request.cf?.country; // User's country code
const colo = request.cf?.colo; // Cloudflare data center code
const city = request.cf?.city; // User's city
const continent = request.cf?.continent; // Continent code
const latitude = request.cf?.latitude; // Geographic latitude
const longitude = request.cf?.longitude; // Geographic longitude
const postalCode = request.cf?.postalCode; // Postal/ZIP code
const timezone = request.cf?.timezone; // IANA timezone
const asn = request.cf?.asn; // ASN of client
const httpProtocol = request.cf?.httpProtocol; // HTTP version (HTTP/1.1, HTTP/2, HTTP/3)
const tlsVersion = request.cf?.tlsVersion; // TLS version
const tlsCipher = request.cf?.tlsCipher; // TLS cipher suite
```

### Response Object

```javascript
// Creating responses
const response = new Response('Hello World', {
  status: 200,
  statusText: 'OK',
  headers: {
    'Content-Type': 'text/plain',
    'Cache-Control': 'max-age=3600'
  }
});

// JSON response
const jsonResponse = new Response(JSON.stringify({ success: true }), {
  headers: { 'Content-Type': 'application/json' }
});

// Response with streaming body
const stream = new ReadableStream({
  start(controller) {
    controller.enqueue('chunk 1\n');
    controller.enqueue('chunk 2\n');
    controller.close();
  }
});
const streamResponse = new Response(stream);

// Redirect responses
const redirect = Response.redirect('https://example.com', 302);

// Response properties
const status = response.status; // 200, 404, etc.
const ok = response.ok; // true if status 200-299
const headers = response.headers; // Headers object
const redirected = response.redirected; // Was response redirected?

// Reading response body
const json = await response.json();
const text = await response.text();
const arrayBuffer = await response.arrayBuffer();
const blob = await response.blob();

// Cloning response (needed if reading body multiple times)
const cloned = response.clone();
```

### Headers

```javascript
// Creating headers
const headers = new Headers();
headers.set('Content-Type', 'application/json');
headers.append('Set-Cookie', 'session=abc');
headers.append('Set-Cookie', 'user=123'); // Can have multiple

// From object
const headers = new Headers({
  'Content-Type': 'application/json',
  'X-Custom-Header': 'value'
});

// Reading headers
const contentType = headers.get('Content-Type');
const hasAuth = headers.has('Authorization');

// Iterating headers
for (const [key, value] of headers.entries()) {
  console.log(`${key}: ${value}`);
}

// Deleting headers
headers.delete('X-Custom-Header');

// Modifying response headers
const response = await fetch('https://example.com');
const newResponse = new Response(response.body, {
  status: response.status,
  headers: response.headers
});
newResponse.headers.set('X-Worker-Version', '1.0');
return newResponse;
```

### URL and URLSearchParams

```javascript
// Parsing URLs
const url = new URL(request.url);
const protocol = url.protocol; // 'https:'
const hostname = url.hostname; // 'example.com'
const pathname = url.pathname; // '/api/users'
const search = url.search; // '?id=123&sort=name'
const hash = url.hash; // '#section'

// Query parameters
const params = url.searchParams;
const id = params.get('id'); // '123'
const sort = params.get('sort'); // 'name'
const hasFilter = params.has('filter'); // false

// Modifying query parameters
url.searchParams.set('page', '2');
url.searchParams.append('tag', 'cloudflare');
url.searchParams.delete('sort');

// Building URLs
const apiUrl = new URL('/api/data', 'https://example.com');
apiUrl.searchParams.set('limit', '10');
apiUrl.searchParams.set('offset', '20');
const fullUrl = apiUrl.toString();
// 'https://example.com/api/data?limit=10&offset=20'
```

### Crypto API

```javascript
// Random values
const array = new Uint8Array(16);
crypto.getRandomValues(array);

// UUID generation
const uuid = crypto.randomUUID();
// 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'

// Hashing (SHA-256)
const encoder = new TextEncoder();
const data = encoder.encode('Hello World');
const hashBuffer = await crypto.subtle.digest('SHA-256', data);
const hashArray = Array.from(new Uint8Array(hashBuffer));
const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

// HMAC signing
const key = await crypto.subtle.importKey(
  'raw',
  encoder.encode('secret-key'),
  { name: 'HMAC', hash: 'SHA-256' },
  false,
  ['sign', 'verify']
);
const signature = await crypto.subtle.sign(
  'HMAC',
  key,
  encoder.encode('message')
);

// Verifying HMAC
const isValid = await crypto.subtle.verify(
  'HMAC',
  key,
  signature,
  encoder.encode('message')
);
```

### Streams API

```javascript
// ReadableStream
const stream = new ReadableStream({
  async start(controller) {
    controller.enqueue('First chunk\n');
    await someAsyncOperation();
    controller.enqueue('Second chunk\n');
    controller.close();
  }
});

// Transform stream
const transformStream = new TransformStream({
  transform(chunk, controller) {
    // Modify chunk
    const modified = chunk.toUpperCase();
    controller.enqueue(modified);
  }
});

// Piping streams
const response = await fetch('https://example.com');
const transformed = response.body.pipeThrough(transformStream);
return new Response(transformed);

// Reading from stream
const reader = stream.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  console.log('Chunk:', value);
}
```

### TextEncoder / TextDecoder

```javascript
// Encoding text to bytes
const encoder = new TextEncoder();
const bytes = encoder.encode('Hello World');
// Uint8Array

// Decoding bytes to text
const decoder = new TextDecoder();
const text = decoder.decode(bytes);
// 'Hello World'

// Different encodings
const utf8Decoder = new TextDecoder('utf-8');
const latin1Decoder = new TextDecoder('iso-8859-1');
```

## Cloudflare-Specific APIs

### HTMLRewriter

Transform HTML on the fly:

```javascript
class TitleRewriter {
  element(element) {
    element.setInnerContent('New Title');
  }
}

class LinkRewriter {
  element(element) {
    const href = element.getAttribute('href');
    if (href && href.startsWith('/')) {
      element.setAttribute('href', `https://newdomain.com${href}`);
    }
  }
}

export default {
  async fetch(request) {
    const response = await fetch(request);

    return new HTMLRewriter()
      .on('title', new TitleRewriter())
      .on('a', new LinkRewriter())
      .on('p', {
        element(element) {
          element.prepend('<span>Prefix: </span>', { html: true });
        }
      })
      .transform(response);
  }
};
```

### Cache API

Control edge caching:

```javascript
// Get default cache
const cache = caches.default;

// Check cache
const cacheKey = new Request(url, request);
let response = await cache.match(cacheKey);

if (response) {
  return response; // Cache hit
}

// Fetch from origin
response = await fetch(request);

// Cache response
ctx.waitUntil(cache.put(cacheKey, response.clone()));

return response;

// Custom cache control
const cachedResponse = new Response(data, {
  headers: {
    'Cache-Control': 'public, max-age=3600',
    'CDN-Cache-Control': 'public, max-age=7200',
    'Cloudflare-CDN-Cache-Control': 'public, max-age=14400'
  }
});
```

### Scheduled Handler (Cron Triggers)

For scheduled Workers:

```javascript
export default {
  // HTTP requests
  async fetch(request, env, ctx) {
    return new Response('HTTP handler');
  },

  // Scheduled events
  async scheduled(event, env, ctx) {
    // event.cron - cron string that triggered this
    // event.scheduledTime - scheduled time (ms since epoch)

    console.log('Cron job running:', event.cron);

    // Perform scheduled task
    await cleanupOldData(env);

    // Use waitUntil for async operations
    ctx.waitUntil(logScheduledRun(env, event));
  }
};
```

## Global Objects

### console

```javascript
console.log('Info message', { data: 'value' });
console.error('Error message', error);
console.warn('Warning message');
console.debug('Debug message');

// Logs visible in:
// - wrangler dev (local development)
// - wrangler tail (production real-time logs)
// - Cloudflare Dashboard (Workers Logs)
```

### Timers

```javascript
// setTimeout (limited support)
setTimeout(() => {
  console.log('Delayed log');
}, 1000);

// Note: Timers don't extend execution beyond response
// Use ctx.waitUntil() for background tasks

// Date and time
const now = Date.now();
const date = new Date();
const isoString = date.toISOString();
```

## Limits and Quotas

### CPU Time

- **Free tier**: 10ms CPU time per request
- **Paid tier**: 50ms CPU time per request
- Exceeded time results in error

### Memory

- **Memory limit**: 128 MB per isolate
- Exceeded limit results in termination

### Request Size

- **Request body**: 100 MB max
- **Response body**: Unlimited (streaming supported)

### Subrequest Limits

- **Free tier**: 50 subrequests per request
- **Paid tier**: 1,000 subrequests per request
- Subrequest = any fetch() call from your Worker

### Script Size

- **Compressed script**: 1 MB max (after compression)
- **Uncompressed script**: 10 MB max

### Environment Variables

- **Max per Worker**: 64 environment variables
- **Max size per variable**: 5 KB

## Performance Best Practices

### Minimize CPU Time

```javascript
// Bad: Synchronous JSON parsing in loop
for (let i = 0; i < 1000; i++) {
  JSON.parse(largeString);
}

// Good: Parse once, reuse
const parsed = JSON.parse(largeString);
for (let i = 0; i < 1000; i++) {
  processData(parsed);
}
```

### Parallel Requests

```javascript
// Bad: Sequential
const user = await fetch(`/api/users/${id}`);
const posts = await fetch(`/api/posts?userId=${id}`);
const comments = await fetch(`/api/comments?userId=${id}`);

// Good: Parallel
const [user, posts, comments] = await Promise.all([
  fetch(`/api/users/${id}`),
  fetch(`/api/posts?userId=${id}`),
  fetch(`/api/comments?userId=${id}`)
]);
```

### Streaming Responses

```javascript
// Stream large responses instead of buffering
const response = await fetch('https://api.example.com/large-file');
return new Response(response.body, {
  headers: response.headers
});
```

### Avoid Blocking Operations

```javascript
// Bad: Large synchronous computation
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}
const result = fibonacci(40); // Blocks for too long

// Good: Use async with breaks
async function processLargeDataset(data) {
  for (let i = 0; i < data.length; i++) {
    await processItem(data[i]);

    // Yield periodically
    if (i % 100 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
}
```

## Common Patterns

### Request Modification

```javascript
// Add authentication header
const modifiedRequest = new Request(request, {
  headers: {
    ...Object.fromEntries(request.headers),
    'Authorization': `Bearer ${env.API_TOKEN}`
  }
});
const response = await fetch(modifiedRequest);
```

### Response Modification

```javascript
// Add security headers
const response = await fetch(request);
const newHeaders = new Headers(response.headers);
newHeaders.set('X-Frame-Options', 'DENY');
newHeaders.set('X-Content-Type-Options', 'nosniff');

return new Response(response.body, {
  status: response.status,
  headers: newHeaders
});
```

### Conditional Caching

```javascript
const url = new URL(request.url);

// Cache static assets
if (url.pathname.startsWith('/static/')) {
  const cache = caches.default;
  let response = await cache.match(request);

  if (!response) {
    response = await fetch(request);
    ctx.waitUntil(cache.put(request, response.clone()));
  }

  return response;
}

// Don't cache API requests
return fetch(request);
```

This reference covers the most commonly used runtime APIs. For the latest and complete API documentation, consult the official Cloudflare Workers documentation or use the cloudflare-docs-specialist agent.
