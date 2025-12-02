/**
 * Common Fetch Handler Patterns for Cloudflare Workers
 *
 * This file demonstrates various patterns for structuring Workers fetch handlers,
 * including routing, middleware, and request/response handling.
 */

// ============================================================================
// Pattern 1: Simple Path-Based Routing
// ============================================================================

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Route based on pathname
    if (url.pathname === '/') {
      return new Response('Home page');
    }

    if (url.pathname === '/about') {
      return new Response('About page');
    }

    if (url.pathname === '/api/users') {
      return handleUsers(request, env);
    }

    // Default 404
    return new Response('Not Found', { status: 404 });
  }
};

// ============================================================================
// Pattern 2: Method-Based Routing
// ============================================================================

export const methodRouting = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Route based on HTTP method
    switch (request.method) {
      case 'GET':
        return handleGet(request, env);

      case 'POST':
        return handlePost(request, env);

      case 'PUT':
        return handlePut(request, env);

      case 'DELETE':
        return handleDelete(request, env);

      case 'OPTIONS':
        return handleCORS();

      default:
        return new Response('Method Not Allowed', { status: 405 });
    }
  }
};

// ============================================================================
// Pattern 3: Advanced Router with Path Parameters
// ============================================================================

class Router {
  constructor() {
    this.routes = [];
  }

  get(pattern, handler) {
    this.routes.push({ method: 'GET', pattern, handler });
  }

  post(pattern, handler) {
    this.routes.push({ method: 'POST', pattern, handler });
  }

  put(pattern, handler) {
    this.routes.push({ method: 'PUT', pattern, handler });
  }

  delete(pattern, handler) {
    this.routes.push({ method: 'DELETE', pattern, handler });
  }

  async handle(request, env, ctx) {
    const url = new URL(request.url);

    for (const route of this.routes) {
      if (route.method !== request.method) continue;

      const match = this.matchPath(url.pathname, route.pattern);
      if (match) {
        return route.handler(request, env, match.params);
      }
    }

    return new Response('Not Found', { status: 404 });
  }

  matchPath(pathname, pattern) {
    // Convert pattern like "/users/:id" to regex
    const paramNames = [];
    const regexPattern = pattern.replace(/:(\w+)/g, (_, name) => {
      paramNames.push(name);
      return '([^/]+)';
    });

    const regex = new RegExp(`^${regexPattern}$`);
    const match = pathname.match(regex);

    if (!match) return null;

    const params = {};
    paramNames.forEach((name, index) => {
      params[name] = match[index + 1];
    });

    return { params };
  }
}

export const advancedRouting = {
  async fetch(request, env, ctx) {
    const router = new Router();

    // Define routes
    router.get('/', async (req, env) => {
      return new Response('Home');
    });

    router.get('/users/:id', async (req, env, params) => {
      return new Response(`User ID: ${params.id}`);
    });

    router.post('/users', async (req, env) => {
      const data = await req.json();
      // Create user logic
      return new Response('User created', { status: 201 });
    });

    router.get('/posts/:postId/comments/:commentId', async (req, env, params) => {
      return new Response(
        `Post: ${params.postId}, Comment: ${params.commentId}`
      );
    });

    return router.handle(request, env, ctx);
  }
};

// ============================================================================
// Pattern 4: Middleware Pattern
// ============================================================================

// Middleware functions
async function authMiddleware(request, env) {
  const token = request.headers.get('Authorization');

  if (!token) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Validate token (simplified)
  if (!token.startsWith('Bearer ')) {
    return new Response('Invalid token format', { status: 401 });
  }

  // Attach user info to request (using headers as example)
  const newRequest = new Request(request, {
    headers: new Headers({
      ...Object.fromEntries(request.headers),
      'X-User-Id': '123' // Would come from token validation
    })
  });

  return newRequest; // Return modified request to continue
}

async function loggingMiddleware(request, env, ctx) {
  const startTime = Date.now();

  // Log request
  console.log(`${request.method} ${request.url}`);

  // Continue to handler
  const response = await handleRequest(request, env);

  // Log response time
  const duration = Date.now() - startTime;
  console.log(`Response: ${response.status} (${duration}ms)`);

  return response;
}

export const middlewarePattern = {
  async fetch(request, env, ctx) {
    // Apply middleware chain
    const middlewares = [authMiddleware, loggingMiddleware];

    for (const middleware of middlewares) {
      const result = await middleware(request, env, ctx);

      // If middleware returns Response, return it (auth failed, etc.)
      if (result instanceof Response) {
        return result;
      }

      // If middleware returns Request, use it for next step
      if (result instanceof Request) {
        request = result;
      }
    }

    // Final handler
    return handleRequest(request, env);
  }
};

// ============================================================================
// Pattern 5: API with JSON Responses
// ============================================================================

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

export const apiPattern = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // GET /api/users
    if (url.pathname === '/api/users' && request.method === 'GET') {
      const users = await env.DB.prepare(
        'SELECT id, name, email FROM users'
      ).all();

      return jsonResponse({
        success: true,
        data: users.results
      });
    }

    // GET /api/users/:id
    const userMatch = url.pathname.match(/^\/api\/users\/(\d+)$/);
    if (userMatch && request.method === 'GET') {
      const userId = userMatch[1];
      const user = await env.DB.prepare(
        'SELECT id, name, email FROM users WHERE id = ?'
      ).bind(userId).first();

      if (!user) {
        return jsonResponse({ error: 'User not found' }, 404);
      }

      return jsonResponse({ success: true, data: user });
    }

    // POST /api/users
    if (url.pathname === '/api/users' && request.method === 'POST') {
      const body = await request.json();

      // Validate
      if (!body.name || !body.email) {
        return jsonResponse(
          { error: 'Name and email required' },
          400
        );
      }

      // Insert
      const result = await env.DB.prepare(
        'INSERT INTO users (name, email) VALUES (?, ?)'
      ).bind(body.name, body.email).run();

      return jsonResponse(
        {
          success: true,
          data: { id: result.meta.last_row_id }
        },
        201
      );
    }

    return jsonResponse({ error: 'Not found' }, 404);
  }
};

// ============================================================================
// Pattern 6: CORS Handling
// ============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
};

function handleCORS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
}

export const corsPattern = {
  async fetch(request, env, ctx) {
    // Handle preflight
    if (request.method === 'OPTIONS') {
      return handleCORS();
    }

    // Handle actual request
    const response = await handleRequest(request, env);

    // Add CORS headers to response
    const newHeaders = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      newHeaders.set(key, value);
    });

    return new Response(response.body, {
      status: response.status,
      headers: newHeaders
    });
  }
};

// ============================================================================
// Pattern 7: Request Proxying / API Gateway
// ============================================================================

export const proxyPattern = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Proxy API requests to backend
    if (url.pathname.startsWith('/api/')) {
      // Rewrite URL
      const backendUrl = new URL(request.url);
      backendUrl.hostname = 'api.backend.com';
      backendUrl.protocol = 'https:';

      // Modify request
      const modifiedRequest = new Request(backendUrl, {
        method: request.method,
        headers: new Headers({
          ...Object.fromEntries(request.headers),
          'X-Forwarded-For': request.headers.get('CF-Connecting-IP') || '',
          'Authorization': `Bearer ${env.API_TOKEN}` // Add auth
        }),
        body: request.body
      });

      // Forward request
      const response = await fetch(modifiedRequest);

      // Modify response headers
      const newHeaders = new Headers(response.headers);
      newHeaders.set('X-Proxied-By', 'Cloudflare Workers');

      return new Response(response.body, {
        status: response.status,
        headers: newHeaders
      });
    }

    // Serve static content
    return new Response('Static content');
  }
};

// ============================================================================
// Pattern 8: Rate Limiting
// ============================================================================

export const rateLimitPattern = {
  async fetch(request, env, ctx) {
    const ip = request.headers.get('CF-Connecting-IP');
    const key = `ratelimit:${ip}`;

    // Check rate limit
    const count = await env.CACHE.get(key);
    const limit = 100; // 100 requests
    const window = 60; // per 60 seconds

    if (count && parseInt(count) >= limit) {
      return new Response('Rate limit exceeded', {
        status: 429,
        headers: {
          'Retry-After': window.toString()
        }
      });
    }

    // Increment counter
    const newCount = count ? parseInt(count) + 1 : 1;
    await env.CACHE.put(key, newCount.toString(), {
      expirationTtl: window
    });

    // Add rate limit headers
    const response = await handleRequest(request, env);
    response.headers.set('X-RateLimit-Limit', limit.toString());
    response.headers.set('X-RateLimit-Remaining', (limit - newCount).toString());

    return response;
  }
};

// ============================================================================
// Pattern 9: Background Tasks with waitUntil
// ============================================================================

export const backgroundTaskPattern = {
  async fetch(request, env, ctx) {
    // Respond immediately
    const response = new Response('Request received');

    // Schedule background tasks
    ctx.waitUntil(
      logRequest(request, env)
    );

    ctx.waitUntil(
      updateAnalytics(request, env)
    );

    ctx.waitUntil(
      warmCache(request, env)
    );

    return response;
  }
};

async function logRequest(request, env) {
  await env.DB.prepare(
    'INSERT INTO request_logs (url, method, timestamp) VALUES (?, ?, ?)'
  ).bind(request.url, request.method, Date.now()).run();
}

async function updateAnalytics(request, env) {
  const country = request.cf?.country || 'unknown';
  await env.ANALYTICS.send({ country, timestamp: Date.now() });
}

async function warmCache(request, env) {
  // Prefetch related resources
  const relatedUrls = ['/api/related/1', '/api/related/2'];
  await Promise.all(
    relatedUrls.map(url => fetch(url))
  );
}

// ============================================================================
// Pattern 10: Query Parameter Handling
// ============================================================================

export const queryParamPattern = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Read query parameters
    const page = url.searchParams.get('page') || '1';
    const limit = url.searchParams.get('limit') || '10';
    const sort = url.searchParams.get('sort') || 'created_at';
    const order = url.searchParams.get('order') || 'desc';

    // Get all values for multi-value param
    const tags = url.searchParams.getAll('tag'); // ?tag=a&tag=b

    // Check if param exists
    const hasFilter = url.searchParams.has('filter');

    // Build SQL query
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const results = await env.DB.prepare(
      `SELECT * FROM posts
       ORDER BY ${sort} ${order}
       LIMIT ? OFFSET ?`
    ).bind(parseInt(limit), offset).all();

    return jsonResponse({
      page: parseInt(page),
      limit: parseInt(limit),
      data: results.results
    });
  }
};

// ============================================================================
// Helper Functions
// ============================================================================

async function handleRequest(request, env) {
  // Default handler implementation
  return new Response('Default handler');
}

async function handleUsers(request, env) {
  return new Response('Users handler');
}

async function handleGet(request, env) {
  return new Response('GET handler');
}

async function handlePost(request, env) {
  return new Response('POST handler');
}

async function handlePut(request, env) {
  return new Response('PUT handler');
}

async function handleDelete(request, env) {
  return new Response('DELETE handler');
}
