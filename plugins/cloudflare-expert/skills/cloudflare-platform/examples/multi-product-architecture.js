/**
 * Multi-Product Architecture Examples
 *
 * Demonstrates integrating multiple Cloudflare platform products
 * in real-world application patterns.
 */

// ============================================================================
// Example 1: RAG (Retrieval Augmented Generation) Application
// ============================================================================

// Uses: Workers AI, Vectorize, D1
export const RAGApplication = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Add document to knowledge base
    if (url.pathname === '/documents' && request.method === 'POST') {
      const { title, text } = await request.json();

      // 1. Store document in D1
      const result = await env.DB.prepare(
        'INSERT INTO documents (title, text) VALUES (?, ?)'
      ).bind(title, text).run();

      const docId = result.meta.last_row_id;

      // 2. Generate embedding
      const embeddings = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
        text: [text]
      });

      // 3. Store vector in Vectorize
      await env.VECTOR_INDEX.insert([{
        id: docId.toString(),
        values: embeddings.data[0],
        metadata: { title }
      }]);

      return new Response(JSON.stringify({ id: docId }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Query knowledge base
    if (url.pathname === '/query' && request.method === 'POST') {
      const { question } = await request.json();

      // 1. Generate query embedding
      const queryEmbedding = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
        text: [question]
      });

      // 2. Find similar documents
      const similar = await env.VECTOR_INDEX.query(queryEmbedding.data[0], {
        topK: 3
      });

      // 3. Fetch full document text from D1
      const docIds = similar.matches.map(m => m.id);
      const docs = await env.DB.prepare(
        `SELECT text FROM documents WHERE id IN (${docIds.map(() => '?').join(',')})`
      ).bind(...docIds).all();

      // 4. Build context
      const context = docs.results.map(d => d.text).join('\n\n');

      // 5. Generate answer with context
      const answer = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          {
            role: 'system',
            content: 'Answer the question using only the provided context.'
          },
          {
            role: 'user',
            content: `Context:\n${context}\n\nQuestion: ${question}`
          }
        ]
      });

      return new Response(JSON.stringify({
        answer: answer.response,
        sources: similar.matches.map(m => m.metadata.title)
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not Found', { status: 404 });
  }
};

// ============================================================================
// Example 2: E-Commerce Platform
// ============================================================================

// Uses: D1, R2, KV, Queues, Durable Objects
export const ECommercePlatform = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Get product (with KV cache)
    if (url.pathname.startsWith('/products/')) {
      const productId = url.pathname.split('/')[2];
      const cacheKey = `product:${productId}`;

      // Check cache first
      let product = await env.CACHE.get(cacheKey, 'json');

      if (!product) {
        // Fetch from D1
        product = await env.DB.prepare(
          'SELECT * FROM products WHERE id = ?'
        ).bind(productId).first();

        // Cache for 1 hour
        await env.CACHE.put(cacheKey, JSON.stringify(product), {
          expirationTtl: 3600
        });
      }

      // Get image URL from R2
      const imageUrl = await env.PRODUCTS.get(`images/${productId}.jpg`)
        ? `https://products.example.com/${productId}.jpg`
        : null;

      return new Response(JSON.stringify({ ...product, imageUrl }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create order (with Queue for processing)
    if (url.pathname === '/orders' && request.method === 'POST') {
      const order = await request.json();

      // Check inventory with Durable Object (strong consistency)
      const inventoryId = env.INVENTORY.idFromName(order.productId);
      const inventory = env.INVENTORY.get(inventoryId);

      const inventoryCheck = await inventory.fetch(
        new Request('http://internal/reserve', {
          method: 'POST',
          body: JSON.stringify({ quantity: order.quantity })
        })
      );

      if (!inventoryCheck.ok) {
        return new Response('Out of stock', { status: 409 });
      }

      // Create order in D1
      const result = await env.DB.prepare(
        'INSERT INTO orders (user_id, product_id, quantity, total) VALUES (?, ?, ?, ?)'
      ).bind(order.userId, order.productId, order.quantity, order.total).run();

      const orderId = result.meta.last_row_id;

      // Queue order processing (email, fulfillment, etc.)
      await env.ORDER_QUEUE.send({
        orderId,
        userId: order.userId,
        email: order.email,
        action: 'process_order'
      });

      return new Response(JSON.stringify({ orderId }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not Found', { status: 404 });
  },

  // Queue consumer for order processing
  async queue(batch, env) {
    for (const message of batch.messages) {
      const { orderId, userId, email } = message.body;

      try {
        // Send confirmation email
        await sendOrderConfirmation(email, orderId, env);

        // Trigger fulfillment
        await triggerFulfillment(orderId, env);

        // Update order status
        await env.DB.prepare(
          'UPDATE orders SET status = ? WHERE id = ?'
        ).bind('processing', orderId).run();

        message.ack();
      } catch (error) {
        console.error('Order processing failed:', error);
        message.retry();
      }
    }
  }
};

// Inventory Durable Object
export class Inventory {
  constructor(state, env) {
    this.state = state;
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/reserve' && request.method === 'POST') {
      const { quantity } = await request.json();

      // Get current inventory
      const available = await this.state.storage.get('available') || 0;

      if (available < quantity) {
        return new Response('Insufficient inventory', { status: 409 });
      }

      // Reserve inventory
      await this.state.storage.put('available', available - quantity);

      return new Response('Reserved', { status: 200 });
    }

    return new Response('Not Found', { status: 404 });
  }
}

// ============================================================================
// Example 3: Real-Time Collaboration App
// ============================================================================

// Uses: Durable Objects, D1, R2, Queues, Analytics Engine
export const CollaborationApp = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Join collaboration room
    if (url.pathname.startsWith('/rooms/')) {
      const roomId = url.pathname.split('/')[2];

      // Get Durable Object for room
      const id = env.ROOM.idFromName(roomId);
      const room = env.ROOM.get(id);

      // Proxy request to room
      return room.fetch(request);
    }

    // Save document
    if (url.pathname === '/documents' && request.method === 'POST') {
      const { roomId, content } = await request.json();

      // Store in D1
      await env.DB.prepare(
        'INSERT INTO documents (room_id, content, updated_at) VALUES (?, ?, ?)'
      ).bind(roomId, content, Date.now()).run();

      // Log analytics event
      await env.ANALYTICS.writeDataPoint({
        blobs: ['document_save', roomId],
        doubles: [content.length],
        indexes: [Date.now()]
      });

      return new Response('Saved', { status: 201 });
    }

    // Upload file attachment
    if (url.pathname === '/attachments' && request.method === 'POST') {
      const formData = await request.formData();
      const file = formData.get('file');
      const roomId = formData.get('roomId');

      // Store in R2
      const fileKey = `${roomId}/${Date.now()}-${file.name}`;
      await env.ATTACHMENTS.put(fileKey, file.stream(), {
        httpMetadata: {
          contentType: file.type
        },
        customMetadata: {
          roomId,
          originalName: file.name
        }
      });

      return new Response(JSON.stringify({ fileKey }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not Found', { status: 404 });
  }
};

// Room Durable Object for real-time collaboration
export class Room {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = [];
  }

  async fetch(request) {
    // Upgrade to WebSocket
    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      this.sessions.push(server);

      server.accept();

      server.addEventListener('message', async event => {
        // Broadcast to all sessions
        const message = JSON.parse(event.data);

        // Save state
        await this.state.storage.put('lastUpdate', message);

        // Broadcast
        this.sessions.forEach(session => {
          if (session !== server) {
            session.send(event.data);
          }
        });
      });

      server.addEventListener('close', () => {
        this.sessions = this.sessions.filter(s => s !== server);
      });

      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response('Expected WebSocket', { status: 400 });
  }
}

// ============================================================================
// Example 4: Content Platform with Recommendations
// ============================================================================

// Uses: R2, D1, KV, Vectorize, Queues, Analytics Engine
export const ContentPlatform = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Upload video
    if (url.pathname === '/videos' && request.method === 'POST') {
      const formData = await request.formData();
      const video = formData.get('video');
      const metadata = JSON.parse(formData.get('metadata'));

      // Generate unique ID
      const videoId = crypto.randomUUID();

      // Store video in R2
      await env.MEDIA.put(`videos/${videoId}.mp4`, video.stream());

      // Store metadata in D1
      await env.DB.prepare(
        'INSERT INTO videos (id, title, description, user_id) VALUES (?, ?, ?, ?)'
      ).bind(videoId, metadata.title, metadata.description, metadata.userId).run();

      // Queue video processing (transcoding, thumbnails)
      await env.PROCESSING_QUEUE.send({
        videoId,
        action: 'process_video'
      });

      // Generate embeddings for recommendations
      const embeddings = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
        text: [`${metadata.title} ${metadata.description}`]
      });

      await env.VECTOR_INDEX.insert([{
        id: videoId,
        values: embeddings.data[0],
        metadata: { title: metadata.title }
      }]);

      return new Response(JSON.stringify({ videoId }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get video with recommendations
    if (url.pathname.startsWith('/videos/') && request.method === 'GET') {
      const videoId = url.pathname.split('/')[2];

      // Check cache
      const cacheKey = `video:${videoId}`;
      let video = await env.CACHE.get(cacheKey, 'json');

      if (!video) {
        // Fetch from D1
        video = await env.DB.prepare(
          'SELECT * FROM videos WHERE id = ?'
        ).bind(videoId).first();

        // Cache
        await env.CACHE.put(cacheKey, JSON.stringify(video), {
          expirationTtl: 3600
        });
      }

      // Get video embedding for recommendations
      const embedding = await env.VECTOR_INDEX.query(video.id, { topK: 5 });

      // Get recommended videos
      const recommendedIds = embedding.matches.slice(1).map(m => m.id); // Skip self
      const recommended = await env.DB.prepare(
        `SELECT id, title FROM videos WHERE id IN (${recommendedIds.map(() => '?').join(',')})`
      ).bind(...recommendedIds).all();

      // Log view
      ctx.waitUntil(
        env.ANALYTICS.writeDataPoint({
          blobs: ['video_view', videoId],
          indexes: [video.user_id]
        })
      );

      // Increment view count
      await env.DB.prepare(
        'UPDATE videos SET views = views + 1 WHERE id = ?'
      ).bind(videoId).run();

      return new Response(JSON.stringify({
        video,
        streamUrl: `https://media.example.com/videos/${videoId}.mp4`,
        recommended: recommended.results
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not Found', { status: 404 });
  },

  // Queue consumer for video processing
  async queue(batch, env) {
    for (const message of batch.messages) {
      const { videoId } = message.body;

      try {
        // Process video (transcoding, thumbnails, etc.)
        await processVideo(videoId, env);

        message.ack();
      } catch (error) {
        console.error('Video processing failed:', error);
        message.retry();
      }
    }
  }
};

// ============================================================================
// Helper Functions
// ============================================================================

async function sendOrderConfirmation(email, orderId, env) {
  // Send email via external service or Email Routing
  console.log(`Sending confirmation to ${email} for order ${orderId}`);
}

async function triggerFulfillment(orderId, env) {
  // Trigger warehouse/fulfillment system
  console.log(`Triggering fulfillment for order ${orderId}`);
}

async function processVideo(videoId, env) {
  // Video processing logic (transcoding, thumbnail generation)
  console.log(`Processing video ${videoId}`);
}
