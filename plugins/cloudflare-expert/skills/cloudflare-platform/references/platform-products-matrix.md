# Cloudflare Platform Products Comparison Matrix

Detailed comparison of Cloudflare platform products to help choose the right service for your use case.

## Storage Products Comparison

| Feature | KV | D1 | R2 |
|---------|----|----|-----|
| **Type** | Key-Value | SQL Database | Object Storage |
| **Consistency** | Eventually consistent (~60s) | Strongly consistent | Strongly consistent |
| **Max Item Size** | 25 MB | Row-dependent | Unlimited |
| **Query Type** | Key lookup | SQL with JOINs | Object key lookup |
| **Best For** | Cache, config | Structured data | Large files, media |
| **Transactions** | No | Yes (via batch) | No |
| **Global Replication** | Automatic | Single region (beta) | Multi-region |
| **Pricing Model** | Per operation + storage | Per row read/written | Per operation + storage |
| **Free Tier** | 1k writes, 100k reads/day | 5M rows read, 100k written | 10 GB + 1M Class A ops |

## Coordination Products Comparison

| Feature | Durable Objects | Queues |
|---------|-----------------|--------|
| **Purpose** | Stateful coordination | Async message processing |
| **Execution Model** | Single-threaded per object | Batched consumer |
| **State** | Persistent storage | No state (messages only) |
| **Delivery** | Exactly-once (single thread) | At-least-once |
| **WebSockets** | Yes | No |
| **Use Case** | Real-time, rate limiting | Background jobs, webhooks |
| **Latency** | Low (ms) | Higher (async) |
| **Pricing** | Per request + duration | Per operation |

## Data Products Comparison

| Feature | Vectorize | Hyperdrive | Analytics Engine |
|---------|-----------|------------|------------------|
| **Purpose** | Vector similarity search | Postgres connection pooling | Custom analytics |
| **Query Type** | Vector similarity (cosine, etc.) | SQL (Postgres) | SQL (time-series) |
| **Consistency** | Eventually consistent | Strong (Postgres) | Eventually consistent |
| **Latency** | Low | Reduced via pooling | High (batch processing) |
| **Use Case** | RAG, semantic search | External database access | Metrics, events |
| **Free Tier** | 30M queried vectors/month | 100k queries/month | 10M data points/month |

## When to Use Each Product

### KV: Key-Value Storage

**✅ Use KV when:**
- Caching API responses or computed results
- Storing small configuration files or feature flags
- Session data with expiration
- Static asset metadata
- Read-heavy workloads (100:1 read/write ratio or higher)
- Global distribution needed automatically
- Data changes infrequently (< hourly)

**❌ Don't use KV when:**
- Need strong consistency (use D1 or Durable Objects)
- Frequently updating values (< 60s between writes)
- Need complex queries (use D1)
- Storing large files > 25 MB (use R2)
- Need transactions (use D1)

**Example use cases:**
- API response caching
- User session storage
- Feature flag configuration
- Geolocation data
- Translation strings
- Rate limit counters (if eventual consistency OK)

### D1: SQL Database

**✅ Use D1 when:**
- Need relational data with JOINs
- Complex queries across multiple tables
- Strong consistency required
- ACID transactions needed
- Data has clear schema
- Total dataset < 25 MB (current beta limit)
- Migrations-driven development

**❌ Don't use D1 when:**
- Dataset > 25 MB (use external Postgres + Hyperdrive)
- Simple key-value lookups (use KV)
- Storing large files (use R2)
- Very high write throughput (thousands/second)
- Unstructured or schema-less data

**Example use cases:**
- User accounts and profiles
- Product catalogs
- Order management
- Blog posts with comments
- Multi-tenant applications
- Application metadata

### R2: Object Storage

**✅ Use R2 when:**
- Storing files > 25 MB
- User-uploaded content (images, videos, documents)
- Media serving
- Backups and archives
- Static website hosting
- Large datasets that don't need querying
- S3 compatibility needed

**❌ Don't use R2 when:**
- Small values < 1 KB (use KV)
- Need to query object contents (use D1 for metadata)
- Frequently updating small files (use KV)
- Need atomic operations across objects (use D1)

**Example use cases:**
- User profile pictures and uploads
- Video streaming
- File downloads
- Database backups
- Log archives
- Static website assets
- ML model storage

### Durable Objects

**✅ Use Durable Objects when:**
- Need strong consistency
- Coordinating distributed operations
- Real-time collaboration (chat, docs)
- WebSocket connections
- Rate limiting per user/resource
- Game state management
- Sequential processing required
- Need exactly-once semantics

**❌ Don't use Durable Objects when:**
- Simple stateless operations (use regular Workers)
- Pure data storage (use D1/R2)
- High-throughput parallel processing
- Just need caching (use KV)
- Async background jobs (use Queues)

**Example use cases:**
- Chat rooms
- Collaborative document editing
- Rate limiting and quotas
- Real-time game servers
- WebSocket connection management
- Distributed locks
- Order of operations matters

### Queues

**✅ Use Queues when:**
- Background processing
- Asynchronous workflows
- Decoupling services
- Handling webhooks
- Batch processing
- Email sending
- Event-driven architecture
- Can tolerate at-least-once delivery

**❌ Don't use Queues when:**
- Need exactly-once delivery (handle idempotency in consumer)
- Real-time requirements (use Durable Objects)
- Synchronous request-response
- Simple fire-and-forget (use ctx.waitUntil)

**Example use cases:**
- Email notifications
- Image processing pipelines
- Webhook delivery
- Report generation
- Data import/export
- Third-party API calls
- Scheduled tasks

### Vectorize

**✅ Use Vectorize when:**
- Semantic search
- RAG (Retrieval Augmented Generation)
- Recommendation engines
- Image similarity
- Duplicate detection
- Clustering similar content
- Working with embeddings from ML models

**❌ Don't use Vectorize when:**
- Exact text search (use D1 with LIKE or full-text)
- Simple key-value lookup (use KV)
- No embeddings needed
- Dataset is very small and fits in memory

**Example use cases:**
- Document search with semantic understanding
- RAG for LLM applications
- Product recommendations
- Content deduplication
- Similar image finding
- Chatbot knowledge bases

### Hyperdrive

**✅ Use Hyperdrive when:**
- Connecting to external Postgres database
- High connection churn
- Need to reduce database latency
- Migrating from traditional architecture
- Database is outside Cloudflare network

**❌ Don't use Hyperdrive when:**
- Can use D1 instead (dataset fits in 25 MB)
- Not using Postgres (use appropriate service)
- Database already has good connection pooling

**Example use cases:**
- Legacy Postgres database access
- Multi-region Postgres replication
- Reducing cold start connection times
- External database migration path

### Analytics Engine

**✅ Use Analytics Engine when:**
- Custom application metrics
- High-cardinality analytics
- Time-series data
- Event tracking
- Business intelligence
- Can tolerate ~1 minute delay

**❌ Don't use Analytics Engine when:**
- Need real-time queries
- Transactional data (use D1)
- Simple counters (use Durable Objects)
- Very high write rates (> 1M/minute)

**Example use cases:**
- API usage metrics
- User behavior tracking
- Performance monitoring
- A/B test results
- Business KPIs
- Custom dashboards

## Multi-Product Architecture Patterns

### Pattern 1: RAG Application

```
User Query
  ↓
Workers AI (generate query embedding)
  ↓
Vectorize (find similar documents)
  ↓
D1 (fetch original document text)
  ↓
Workers AI (generate answer with context)
  ↓
Response
```

**Why this combination:**
- Workers AI: Embeddings and text generation
- Vectorize: Fast semantic similarity search
- D1: Structured metadata and full text storage

### Pattern 2: E-Commerce Platform

```
Product Catalog: D1 (structured data, queries)
Product Images: R2 (large files)
Session Data: KV (fast reads, TTL)
Order Processing: Queues (async)
Inventory: Durable Objects (strong consistency)
```

**Why this combination:**
- D1: Complex queries for products, orders, users
- R2: Large product images and media
- KV: Fast session lookups with auto-expiration
- Queues: Decouple order processing, notifications
- Durable Objects: Prevent overselling with consistent inventory

### Pattern 3: Real-Time Collaboration

```
Room State: Durable Objects (WebSockets, coordination)
Persistent Documents: D1 (structured storage)
File Attachments: R2 (large files)
Notifications: Queues (async delivery)
Access Logs: Analytics Engine (metrics)
```

**Why this combination:**
- Durable Objects: Real-time WebSocket coordination
- D1: Persist document versions and metadata
- R2: Store uploaded files
- Queues: Send notifications without blocking
- Analytics Engine: Track usage patterns

### Pattern 4: Content Platform

```
Media Files: R2 (videos, images)
Metadata: D1 (titles, descriptions, tags)
CDN Cache: KV (frequently accessed metadata)
Processing: Queues (video transcoding)
Recommendations: Vectorize (similar content)
Metrics: Analytics Engine (views, engagement)
```

**Why this combination:**
- R2: Large media files
- D1: Structured metadata and relationships
- KV: Cache hot metadata to reduce D1 queries
- Queues: Heavy processing like video transcoding
- Vectorize: Content-based recommendations
- Analytics Engine: View counts, engagement metrics

## Migration Strategies

### From Traditional Stack to Cloudflare

**Scenario: Node.js + Postgres + Redis + S3**

1. **Workers** replaces Node.js server
2. **D1** replaces Postgres (if < 25 MB) or **Hyperdrive** (if > 25 MB)
3. **KV** replaces Redis cache
4. **R2** replaces S3
5. **Queues** replace background job processors

**Migration approach:**
1. Start with Workers (stateless logic)
2. Add KV for caching (easy wins)
3. Migrate static assets to R2
4. Move database to D1 (small) or Hyperdrive (large)
5. Convert background jobs to Queues
6. Add Durable Objects for stateful features

### From Serverless Stack to Cloudflare

**Scenario: Lambda + DynamoDB + SQS + S3**

1. **Workers** replaces Lambda
2. **D1** or **KV** replaces DynamoDB (depends on query patterns)
3. **Queues** replace SQS
4. **R2** replaces S3

**Benefits:**
- No cold starts (Workers)
- Lower latency (edge deployment)
- Simpler pricing
- Integrated platform

## Cost Optimization Matrix

| Product | Free Tier | Optimization Strategy |
|---------|-----------|----------------------|
| **KV** | 100k reads, 1k writes/day | Cache aggressively, batch writes |
| **D1** | 5M rows read, 100k rows written | Use KV cache, optimize queries |
| **R2** | 10 GB + 1M Class A ops | Leverage zero egress from Workers |
| **Durable Objects** | 1M requests | Batch operations, cache in memory |
| **Queues** | 1M operations | Use batching, adjust batch size |
| **Vectorize** | 30M queried vectors | Batch inserts, optimize topK |
| **Workers AI** | Limited free requests | Cache results in KV, batch processing |

## Summary Decision Matrix

| Need | Primary Choice | Fallback | Notes |
|------|---------------|----------|-------|
| **Cache** | KV | Durable Objects | KV for eventually consistent, DO for strong |
| **Relational Data** | D1 | Hyperdrive | D1 if < 25 MB, Hyperdrive for external Postgres |
| **Files > 25 MB** | R2 | - | Only option for large files |
| **Real-Time** | Durable Objects | - | Only option for WebSockets |
| **Async Jobs** | Queues | ctx.waitUntil | Queues for reliability, waitUntil for simple |
| **Semantic Search** | Vectorize | - | Specialized for embeddings |
| **Metrics** | Analytics Engine | D1 | AE for high cardinality, D1 for simple |

For the latest product information and detailed documentation, use the cloudflare-docs-specialist agent.
