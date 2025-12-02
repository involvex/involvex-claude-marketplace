/**
 * Error Handling Patterns for Cloudflare Workers
 *
 * This file demonstrates comprehensive error handling strategies including
 * try-catch patterns, custom error classes, error responses, and logging.
 */

// ============================================================================
// Pattern 1: Basic Try-Catch with Error Responses
// ============================================================================

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);

      if (url.pathname === '/api/users') {
        return await handleUsers(request, env);
      }

      return new Response('Not Found', { status: 404 });
    } catch (error) {
      console.error('Worker error:', error);

      return new Response(
        JSON.stringify({
          error: 'Internal Server Error',
          message: error.message
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  }
};

// ============================================================================
// Pattern 2: Custom Error Classes
// ============================================================================

class APIError extends Error {
  constructor(message, status = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.code = code;
  }
}

class ValidationError extends APIError {
  constructor(message, fields = {}) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.fields = fields;
  }
}

class NotFoundError extends APIError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

class UnauthorizedError extends APIError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

class RateLimitError extends APIError {
  constructor(retryAfter = 60) {
    super('Rate limit exceeded', 429, 'RATE_LIMIT_EXCEEDED');
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

// ============================================================================
// Pattern 3: Centralized Error Handler
// ============================================================================

function handleError(error) {
  // Log error with context
  console.error('Error occurred:', {
    name: error.name,
    message: error.message,
    stack: error.stack,
    ...(error instanceof APIError && {
      status: error.status,
      code: error.code
    })
  });

  // Handle custom API errors
  if (error instanceof APIError) {
    const body = {
      error: error.code,
      message: error.message
    };

    // Add validation fields if present
    if (error instanceof ValidationError) {
      body.fields = error.fields;
    }

    const headers = { 'Content-Type': 'application/json' };

    // Add retry-after for rate limit errors
    if (error instanceof RateLimitError) {
      headers['Retry-After'] = error.retryAfter.toString();
    }

    return new Response(JSON.stringify(body), {
      status: error.status,
      headers
    });
  }

  // Handle unknown errors (don't expose internal details)
  return new Response(
    JSON.stringify({
      error: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    }),
    {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

export const centralizedErrorHandling = {
  async fetch(request, env, ctx) {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      return handleError(error);
    }
  }
};

// ============================================================================
// Pattern 4: Input Validation with Detailed Errors
// ============================================================================

function validateUserInput(data) {
  const errors = {};

  if (!data.name || data.name.trim().length === 0) {
    errors.name = 'Name is required';
  } else if (data.name.length > 100) {
    errors.name = 'Name must be 100 characters or less';
  }

  if (!data.email || data.email.trim().length === 0) {
    errors.email = 'Email is required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = 'Invalid email format';
  }

  if (data.age !== undefined) {
    if (typeof data.age !== 'number' || data.age < 0) {
      errors.age = 'Age must be a positive number';
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError('Validation failed', errors);
  }
}

export const validationPattern = {
  async fetch(request, env, ctx) {
    try {
      if (request.method !== 'POST') {
        throw new APIError('Method not allowed', 405, 'METHOD_NOT_ALLOWED');
      }

      const data = await request.json();

      // Validate input
      validateUserInput(data);

      // Process valid data
      const result = await env.DB.prepare(
        'INSERT INTO users (name, email, age) VALUES (?, ?, ?)'
      ).bind(data.name, data.email, data.age || null).run();

      return new Response(
        JSON.stringify({
          success: true,
          id: result.meta.last_row_id
        }),
        {
          status: 201,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    } catch (error) {
      return handleError(error);
    }
  }
};

// ============================================================================
// Pattern 5: Database Error Handling
// ============================================================================

async function safeDBQuery(env, query, ...bindings) {
  try {
    return await env.DB.prepare(query).bind(...bindings).first();
  } catch (error) {
    console.error('Database error:', error);

    // Handle specific database errors
    if (error.message.includes('UNIQUE constraint')) {
      throw new APIError(
        'Record already exists',
        409,
        'DUPLICATE_ENTRY'
      );
    }

    if (error.message.includes('NOT NULL constraint')) {
      throw new APIError(
        'Required field missing',
        400,
        'MISSING_REQUIRED_FIELD'
      );
    }

    // Generic database error
    throw new APIError(
      'Database operation failed',
      500,
      'DATABASE_ERROR'
    );
  }
}

export const dbErrorHandling = {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const userId = url.searchParams.get('id');

      if (!userId) {
        throw new ValidationError('User ID is required', {
          id: 'Missing id parameter'
        });
      }

      const user = await safeDBQuery(
        env,
        'SELECT * FROM users WHERE id = ?',
        userId
      );

      if (!user) {
        throw new NotFoundError('User');
      }

      return new Response(JSON.stringify(user), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return handleError(error);
    }
  }
};

// ============================================================================
// Pattern 6: External API Error Handling
// ============================================================================

async function safeFetch(url, options = {}) {
  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      // Handle HTTP errors
      if (response.status === 404) {
        throw new NotFoundError('External resource');
      }

      if (response.status === 401 || response.status === 403) {
        throw new UnauthorizedError('External API authentication failed');
      }

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || 60;
        throw new RateLimitError(parseInt(retryAfter));
      }

      if (response.status >= 500) {
        throw new APIError(
          'External service unavailable',
          503,
          'SERVICE_UNAVAILABLE'
        );
      }

      throw new APIError(
        `External API error: ${response.status}`,
        502,
        'BAD_GATEWAY'
      );
    }

    return response;
  } catch (error) {
    // Handle network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new APIError(
        'Failed to connect to external service',
        503,
        'CONNECTION_FAILED'
      );
    }

    // Re-throw API errors
    if (error instanceof APIError) {
      throw error;
    }

    // Unknown error
    throw new APIError(
      'External request failed',
      500,
      'EXTERNAL_REQUEST_FAILED'
    );
  }
}

export const externalAPIPattern = {
  async fetch(request, env, ctx) {
    try {
      const apiResponse = await safeFetch('https://api.example.com/data', {
        headers: {
          'Authorization': `Bearer ${env.API_TOKEN}`
        }
      });

      const data = await apiResponse.json();

      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return handleError(error);
    }
  }
};

// ============================================================================
// Pattern 7: Timeout Handling
// ============================================================================

async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      throw new APIError(
        'Request timeout',
        504,
        'GATEWAY_TIMEOUT'
      );
    }

    throw error;
  }
}

export const timeoutPattern = {
  async fetch(request, env, ctx) {
    try {
      // Fetch with 3 second timeout
      const response = await fetchWithTimeout(
        'https://slow-api.example.com/data',
        { headers: { 'Authorization': `Bearer ${env.API_TOKEN}` } },
        3000
      );

      const data = await response.json();

      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return handleError(error);
    }
  }
};

// ============================================================================
// Pattern 8: Graceful Degradation
// ============================================================================

export const gracefulDegradation = {
  async fetch(request, env, ctx) {
    try {
      // Try primary data source
      const data = await fetchPrimarySource(env);
      return jsonResponse({ source: 'primary', data });
    } catch (primaryError) {
      console.warn('Primary source failed:', primaryError);

      try {
        // Fall back to cache
        const cached = await env.CACHE.get('fallback-data', 'json');
        if (cached) {
          return jsonResponse({ source: 'cache', data: cached });
        }
      } catch (cacheError) {
        console.warn('Cache fallback failed:', cacheError);
      }

      try {
        // Fall back to secondary source
        const data = await fetchSecondarySource(env);
        return jsonResponse({ source: 'secondary', data });
      } catch (secondaryError) {
        console.error('All sources failed');

        // Return degraded response
        return jsonResponse(
          {
            error: 'Service temporarily unavailable',
            message: 'Please try again later'
          },
          503
        );
      }
    }
  }
};

// ============================================================================
// Pattern 9: Error Logging and Monitoring
// ============================================================================

async function logError(error, request, env) {
  const errorLog = {
    timestamp: new Date().toISOString(),
    message: error.message,
    name: error.name,
    stack: error.stack,
    url: request.url,
    method: request.method,
    userAgent: request.headers.get('User-Agent'),
    ip: request.headers.get('CF-Connecting-IP'),
    country: request.cf?.country,
    ...(error instanceof APIError && {
      status: error.status,
      code: error.code
    })
  };

  // Log to console
  console.error('Error log:', errorLog);

  // Store in database
  try {
    await env.DB.prepare(
      'INSERT INTO error_logs (timestamp, error, request_info) VALUES (?, ?, ?)'
    ).bind(
      errorLog.timestamp,
      JSON.stringify({ message: error.message, name: error.name }),
      JSON.stringify({ url: request.url, method: request.method })
    ).run();
  } catch (dbError) {
    console.error('Failed to log error to database:', dbError);
  }

  // Send to external monitoring (optional)
  try {
    await fetch('https://monitoring.example.com/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(errorLog)
    });
  } catch (monitoringError) {
    console.error('Failed to send error to monitoring:', monitoringError);
  }
}

export const errorLogging = {
  async fetch(request, env, ctx) {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      // Log error asynchronously
      ctx.waitUntil(logError(error, request, env));

      return handleError(error);
    }
  }
};

// ============================================================================
// Pattern 10: Retry Logic with Exponential Backoff
// ============================================================================

async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Only retry on specific status codes
      if (response.status < 500 && response.status !== 429) {
        return response;
      }

      // Retry on 5xx or 429
      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw new APIError(
    `Request failed after ${maxRetries} attempts`,
    503,
    'MAX_RETRIES_EXCEEDED'
  );
}

export const retryPattern = {
  async fetch(request, env, ctx) {
    try {
      const response = await fetchWithRetry(
        'https://unreliable-api.example.com/data',
        { headers: { 'Authorization': `Bearer ${env.API_TOKEN}` } },
        3
      );

      const data = await response.json();

      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return handleError(error);
    }
  }
};

// ============================================================================
// Helper Functions
// ============================================================================

async function handleRequest(request, env) {
  // Sample handler implementation
  const url = new URL(request.url);

  if (url.pathname === '/error') {
    throw new APIError('Sample error', 500, 'SAMPLE_ERROR');
  }

  return new Response('Success');
}

async function handleUsers(request, env) {
  // Sample users handler
  return new Response(JSON.stringify({ users: [] }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function fetchPrimarySource(env) {
  const response = await fetch('https://primary.example.com/data');
  return response.json();
}

async function fetchSecondarySource(env) {
  const response = await fetch('https://secondary.example.com/data');
  return response.json();
}
