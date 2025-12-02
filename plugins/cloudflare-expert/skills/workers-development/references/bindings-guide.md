# Workers Bindings Guide

Complete guide to configuring and using Cloudflare Workers bindings. Bindings provide access to Cloudflare platform resources from your Worker code.

## Overview

Bindings are configured in `wrangler.toml` (TOML format) or `wrangler.jsonc` (JSON with comments) and accessed through the `env` parameter in your Worker's fetch handler.

## KV Namespace Bindings

Key-value storage for static content and caching.

### Configuration

**wrangler.toml:**
```toml
[[kv_namespaces]]
binding = "MY_KV"
id = "abc123..."

[[kv_namespaces]]
binding = "CACHE"
id = "def456..."
preview_id = "preview789..."  # Different namespace for preview
```

**wrangler.jsonc:**
```jsonc
{
  "kv_namespaces": [
    {
      "binding": "MY_KV",
      "id": "abc123..."
    },
    {
      "binding": "CACHE",
      "id": "def456...",
      "preview_id": "preview789..."
    }
  ]
}
```

### Usage

```javascript
export default {
  async fetch(request, env) {
    // Read
    const value = await env.MY_KV.get('key');
    const json = await env.MY_KV.get('key', 'json');
    const buffer = await env.MY_KV.get('key', 'arrayBuffer');
    const stream = await env.MY_KV.get('key', 'stream');

    // Write
    await env.MY_KV.put('key', 'value');
    await env.MY_KV.put('key', JSON.stringify({ data: 'value' }));

    // Write with options
    await env.MY_KV.put('key', 'value', {
      expirationTtl: 3600,  // Expire in 1 hour
      metadata: { userId: '123', type: 'cache' }
    });

    // Delete
    await env.MY_KV.delete('key');

    // List keys
    const keys = await env.MY_KV.list();
    const filteredKeys = await env.MY_KV.list({ prefix: 'user:' });

    // Get with metadata
    const { value, metadata } = await env.MY_KV.getWithMetadata('key');

    return new Response(value);
  }
};
```

### Best Practices

- **Eventually consistent**: Writes may take up to 60 seconds to propagate globally
- **Read-heavy**: KV is optimized for reads, not writes
- **Value size**: Max 25 MB per value
- **Use for**: Static assets, configuration, cached API responses
- **Avoid for**: Frequently changing data, strong consistency requirements

## D1 Database Bindings

SQLite database for relational data.

### Configuration

**wrangler.toml:**
```toml
[[d1_databases]]
binding = "DB"
database_name = "my-database"
database_id = "abc-def-ghi"

[[d1_databases]]
binding = "ANALYTICS_DB"
database_name = "analytics"
database_id = "xyz-123-456"
```

**wrangler.jsonc:**
```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "my-database",
      "database_id": "abc-def-ghi"
    }
  ]
}
```

### Usage

```javascript
export default {
  async fetch(request, env) {
    // Simple query
    const result = await env.DB.prepare(
      'SELECT * FROM users WHERE id = ?'
    ).bind(123).first();

    // Multiple results
    const { results } = await env.DB.prepare(
      'SELECT * FROM users WHERE active = ?'
    ).bind(1).all();

    // Insert
    await env.DB.prepare(
      'INSERT INTO users (name, email) VALUES (?, ?)'
    ).bind('John Doe', 'john@example.com').run();

    // Update
    await env.DB.prepare(
      'UPDATE users SET last_login = ? WHERE id = ?'
    ).bind(Date.now(), 123).run();

    // Delete
    await env.DB.prepare(
      'DELETE FROM users WHERE id = ?'
    ).bind(123).run();

    // Batch operations
    await env.DB.batch([
      env.DB.prepare('INSERT INTO users (name) VALUES (?)').bind('Alice'),
      env.DB.prepare('INSERT INTO users (name) VALUES (?)').bind('Bob'),
      env.DB.prepare('INSERT INTO users (name) VALUES (?)').bind('Charlie')
    ]);

    // Transactions are automatic for batch()

    return new Response(JSON.stringify(results));
  }
};
```

### Best Practices

- **Use prepared statements**: Always use bind() for parameters to prevent SQL injection
- **Batch operations**: Use batch() for multiple operations in a transaction
- **Indexing**: Create indexes on frequently queried columns
- **Migrations**: Use `wrangler d1 migrations` for schema changes
- **Limits**: 25 MB database size (beta), 1,000 rows per query result

## R2 Bucket Bindings

Object storage for large files and assets.

### Configuration

**wrangler.toml:**
```toml
[[r2_buckets]]
binding = "MY_BUCKET"
bucket_name = "my-files"

[[r2_buckets]]
binding = "UPLOADS"
bucket_name = "user-uploads"
```

**wrangler.jsonc:**
```jsonc
{
  "r2_buckets": [
    {
      "binding": "MY_BUCKET",
      "bucket_name": "my-files"
    }
  ]
}
```

### Usage

```javascript
export default {
  async fetch(request, env) {
    // Read object
    const object = await env.MY_BUCKET.get('file.txt');
    if (!object) {
      return new Response('Not found', { status: 404 });
    }

    const text = await object.text();
    const arrayBuffer = await object.arrayBuffer();
    const blob = await object.blob();

    // Stream object
    return new Response(object.body, {
      headers: {
        'Content-Type': object.httpMetadata.contentType
      }
    });

    // Write object
    await env.MY_BUCKET.put('file.txt', 'content');
    await env.MY_BUCKET.put('data.json', JSON.stringify({ data: 'value' }));

    // Write with metadata
    await env.MY_BUCKET.put('file.txt', 'content', {
      httpMetadata: {
        contentType: 'text/plain',
        cacheControl: 'max-age=3600'
      },
      customMetadata: {
        userId: '123',
        uploadedAt: Date.now().toString()
      }
    });

    // Delete object
    await env.MY_BUCKET.delete('file.txt');

    // List objects
    const listed = await env.MY_BUCKET.list();
    const prefixListed = await env.MY_BUCKET.list({ prefix: 'uploads/' });

    // Head (metadata only)
    const head = await env.MY_BUCKET.head('file.txt');
    const size = head.size;
    const uploaded = head.uploaded;
  }
};
```

### Best Practices

- **Use for**: Large files, user uploads, static assets, backups
- **No size limit**: Unlike KV's 25 MB limit
- **Streaming**: Stream large files instead of buffering
- **Metadata**: Use customMetadata for searchability
- **Pricing**: Free egress to Workers, charged for external egress

## Durable Objects Bindings

Stateful objects for coordination and real-time features.

### Configuration

**wrangler.toml:**
```toml
[[durable_objects.bindings]]
name = "COUNTER"
class_name = "Counter"
script_name = "my-worker"  # Optional: if class is in different Worker

[[migrations]]
tag = "v1"
new_classes = ["Counter"]
```

**wrangler.jsonc:**
```jsonc
{
  "durable_objects": {
    "bindings": [
      {
        "name": "COUNTER",
        "class_name": "Counter",
        "script_name": "my-worker"
      }
    ]
  },
  "migrations": [
    {
      "tag": "v1",
      "new_classes": ["Counter"]
    }
  ]
}
```

### Usage

**Worker code:**
```javascript
export default {
  async fetch(request, env) {
    // Get Durable Object ID
    const id = env.COUNTER.idFromName('global-counter');
    // or: const id = env.COUNTER.newUniqueId();

    // Get stub (reference to Durable Object)
    const stub = env.COUNTER.get(id);

    // Call method on Durable Object
    const response = await stub.fetch(request);

    return response;
  }
};

// Durable Object class
export class Counter {
  constructor(state, env) {
    this.state = state;
  }

  async fetch(request) {
    // Get stored value
    let count = (await this.state.storage.get('count')) || 0;

    // Increment
    count++;

    // Store new value
    await this.state.storage.put('count', count);

    return new Response(count.toString());
  }
}
```

### Best Practices

- **Use for**: Coordination, rate limiting, real-time collaboration, persistent connections
- **Single-threaded**: Each Durable Object instance processes requests sequentially
- **Strong consistency**: Storage operations are strongly consistent
- **WebSockets**: Durable Objects can handle WebSocket connections
- **Pricing**: Billed per request and duration

## Queue Bindings

Message queuing for async processing.

### Configuration

**wrangler.toml:**
```toml
[[queues.producers]]
binding = "MY_QUEUE"
queue = "my-queue-name"

[[queues.consumers]]
queue = "my-queue-name"
max_batch_size = 10
max_batch_timeout = 5
```

**wrangler.jsonc:**
```jsonc
{
  "queues": {
    "producers": [
      {
        "binding": "MY_QUEUE",
        "queue": "my-queue-name"
      }
    ],
    "consumers": [
      {
        "queue": "my-queue-name",
        "max_batch_size": 10,
        "max_batch_timeout": 5
      }
    ]
  }
}
```

### Usage

**Producer (send messages):**
```javascript
export default {
  async fetch(request, env) {
    // Send single message
    await env.MY_QUEUE.send({ userId: 123, action: 'signup' });

    // Send multiple messages
    await env.MY_QUEUE.sendBatch([
      { body: { userId: 123 } },
      { body: { userId: 456 } },
      { body: { userId: 789 } }
    ]);

    return new Response('Queued');
  }
};
```

**Consumer (process messages):**
```javascript
export default {
  async queue(batch, env) {
    // batch.messages is array of messages
    for (const message of batch.messages) {
      const data = message.body;
      await processMessage(data, env);

      // Acknowledge message
      message.ack();

      // Or retry
      // message.retry();
    }
  }
};
```

### Best Practices

- **Use for**: Async processing, webhooks, batch jobs
- **At-least-once delivery**: Messages may be delivered multiple times
- **Idempotency**: Make consumers idempotent
- **Batching**: Process messages in batches for efficiency
- **Dead letter queue**: Configure DLQ for failed messages

## Vectorize Bindings

Vector database for embeddings and semantic search.

### Configuration

**wrangler.toml:**
```toml
[[vectorize]]
binding = "VECTOR_INDEX"
index_name = "my-index"
```

**wrangler.jsonc:**
```jsonc
{
  "vectorize": [
    {
      "binding": "VECTOR_INDEX",
      "index_name": "my-index"
    }
  ]
}
```

### Usage

```javascript
export default {
  async fetch(request, env) {
    // Insert vectors
    await env.VECTOR_INDEX.insert([
      { id: '1', values: [0.1, 0.2, 0.3], metadata: { text: 'hello' } },
      { id: '2', values: [0.4, 0.5, 0.6], metadata: { text: 'world' } }
    ]);

    // Query (find similar vectors)
    const results = await env.VECTOR_INDEX.query(
      [0.15, 0.25, 0.35],  // Query vector
      { topK: 5 }          // Return top 5 results
    );

    // Results include id, score, metadata
    for (const match of results.matches) {
      console.log(`ID: ${match.id}, Score: ${match.score}`);
    }

    // Delete vectors
    await env.VECTOR_INDEX.deleteByIds(['1', '2']);

    return new Response(JSON.stringify(results));
  }
};
```

### Best Practices

- **Use for**: Semantic search, RAG (Retrieval Augmented Generation), recommendations
- **Dimensions**: Must match embedding model (e.g., 768 for bge-base-en-v1.5)
- **Metadata**: Store original text/data in metadata for retrieval
- **Batch inserts**: Insert vectors in batches for efficiency
- **Integration**: Combine with Workers AI for embedding generation

## Workers AI Binding

AI inference and embedding generation.

### Configuration

**wrangler.toml:**
```toml
[ai]
binding = "AI"
```

**wrangler.jsonc:**
```jsonc
{
  "ai": {
    "binding": "AI"
  }
}
```

### Usage

```javascript
export default {
  async fetch(request, env) {
    // Text generation
    const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'user', content: 'What is Cloudflare?' }
      ]
    });

    // Embeddings
    const embeddings = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
      text: ['Hello world']
    }) as { data: number[][] };

    const vector = embeddings.data[0];  // [0.1, 0.2, ...]

    // Image generation
    const image = await env.AI.run('@cf/stabilityai/stable-diffusion-xl-base-1.0', {
      prompt: 'A beautiful sunset'
    });

    return new Response(JSON.stringify(response));
  }
};
```

### Best Practices

- **Model selection**: Choose appropriate model for task
- **Rate limits**: Be aware of model-specific rate limits
- **Streaming**: Some models support streaming responses
- **Type assertions**: Use TypeScript type assertions for embeddings
- **Integration**: Combine with Vectorize for RAG architectures

## Service Bindings

Call other Workers from your Worker.

### Configuration

**wrangler.toml:**
```toml
[[services]]
binding = "AUTH_SERVICE"
service = "auth-worker"
environment = "production"  # Optional
```

**wrangler.jsonc:**
```jsonc
{
  "services": [
    {
      "binding": "AUTH_SERVICE",
      "service": "auth-worker",
      "environment": "production"
    }
  ]
}
```

### Usage

```javascript
export default {
  async fetch(request, env) {
    // Call another Worker
    const authRequest = new Request('http://internal/verify', {
      method: 'POST',
      headers: { 'Authorization': request.headers.get('Authorization') }
    });

    const authResponse = await env.AUTH_SERVICE.fetch(authRequest);

    if (!authResponse.ok) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Continue with authenticated request
    return new Response('Success');
  }
};
```

### Best Practices

- **Use for**: Microservices architecture, code reuse
- **No network cost**: Service bindings don't count as subrequests
- **RPC pattern**: Treat service bindings like RPC calls
- **Isolation**: Each Worker has isolated code and environment

## Environment Variables and Secrets

Non-binding configuration values.

### Configuration

**Environment variables (wrangler.toml):**
```toml
[vars]
ENVIRONMENT = "production"
API_VERSION = "v2"
DEBUG_MODE = "false"
```

**wrangler.jsonc:**
```jsonc
{
  "vars": {
    "ENVIRONMENT": "production",
    "API_VERSION": "v2",
    "DEBUG_MODE": "false"
  }
}
```

**Secrets (command line):**
```bash
wrangler secret put API_KEY
# Enter value when prompted

wrangler secret put DATABASE_PASSWORD
wrangler secret list
wrangler secret delete API_KEY
```

### Usage

```javascript
export default {
  async fetch(request, env) {
    // Access environment variables
    const environment = env.ENVIRONMENT;  // "production"
    const apiVersion = env.API_VERSION;   // "v2"

    // Access secrets (same syntax, but values not in wrangler.toml)
    const apiKey = env.API_KEY;
    const dbPassword = env.DATABASE_PASSWORD;

    // Use in API calls
    const response = await fetch('https://api.example.com/data', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'X-API-Version': apiVersion
      }
    });

    return response;
  }
};
```

### Best Practices

- **Secrets vs Vars**: Use secrets for sensitive data (API keys, passwords)
- **Never commit secrets**: Secrets are set via CLI, not in configuration files
- **Type**: All values are strings, convert as needed
- **Environment-specific**: Use different values for preview vs production

## Summary Table

| Binding Type | Use Case | Size Limit | Consistency |
|--------------|----------|------------|-------------|
| **KV** | Static content, cache | 25 MB/value | Eventually consistent |
| **D1** | Relational data | 25 MB (beta) | Strongly consistent |
| **R2** | Large files, objects | No limit | Strongly consistent |
| **Durable Objects** | Stateful coordination | No limit | Strongly consistent |
| **Queues** | Async processing | 128 KB/message | At-least-once |
| **Vectorize** | Semantic search | Model-dependent | Eventually consistent |
| **Workers AI** | AI inference | Model-dependent | N/A |
| **Service Bindings** | Call other Workers | N/A | N/A |

## Configuration Examples

### Complete wrangler.toml Example

```toml
name = "my-worker"
main = "src/index.ts"
compatibility_date = "2024-01-01"

# KV
[[kv_namespaces]]
binding = "CACHE"
id = "abc123"

# D1
[[d1_databases]]
binding = "DB"
database_name = "production-db"
database_id = "def456"

# R2
[[r2_buckets]]
binding = "UPLOADS"
bucket_name = "user-uploads"

# Vectorize
[[vectorize]]
binding = "VECTOR_INDEX"
index_name = "embeddings"

# AI
[ai]
binding = "AI"

# Environment variables
[vars]
ENVIRONMENT = "production"

# Durable Objects
[[durable_objects.bindings]]
name = "ROOM"
class_name = "ChatRoom"

[[migrations]]
tag = "v1"
new_classes = ["ChatRoom"]

# Service bindings
[[services]]
binding = "AUTH"
service = "auth-service"
```

### Complete wrangler.jsonc Example

```jsonc
{
  "name": "my-worker",
  "main": "src/index.ts",
  "compatibility_date": "2024-01-01",

  // KV
  "kv_namespaces": [
    { "binding": "CACHE", "id": "abc123" }
  ],

  // D1
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "production-db",
      "database_id": "def456"
    }
  ],

  // R2
  "r2_buckets": [
    { "binding": "UPLOADS", "bucket_name": "user-uploads" }
  ],

  // Vectorize
  "vectorize": [
    { "binding": "VECTOR_INDEX", "index_name": "embeddings" }
  ],

  // AI
  "ai": { "binding": "AI" },

  // Environment variables
  "vars": {
    "ENVIRONMENT": "production"
  },

  // Durable Objects
  "durable_objects": {
    "bindings": [
      {
        "name": "ROOM",
        "class_name": "ChatRoom"
      }
    ]
  },
  "migrations": [
    {
      "tag": "v1",
      "new_classes": ["ChatRoom"]
    }
  ],

  // Service bindings
  "services": [
    {
      "binding": "AUTH",
      "service": "auth-service"
    }
  ]
}
```

For the latest binding options and best practices, consult the Cloudflare documentation or use the cloudflare-docs-specialist agent.
