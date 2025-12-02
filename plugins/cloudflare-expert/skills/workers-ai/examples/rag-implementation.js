/**
 * RAG (Retrieval Augmented Generation) Implementation
 *
 * Complete example of building a RAG system with Workers AI and Vectorize
 */

// ============================================================================
// Complete RAG Worker with Document Ingestion and Query
// ============================================================================

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Add documents to knowledge base
    if (url.pathname === '/documents' && request.method === 'POST') {
      return await addDocument(request, env);
    }

    // Query knowledge base
    if (url.pathname === '/query' && request.method === 'POST') {
      return await queryKnowledgeBase(request, env);
    }

    // List all documents
    if (url.pathname === '/documents' && request.method === 'GET') {
      return await listDocuments(env);
    }

    // Delete document
    if (url.pathname.match(/^\/documents\/\d+$/) && request.method === 'DELETE') {
      const docId = url.pathname.split('/')[2];
      return await deleteDocument(docId, env);
    }

    return new Response('Not Found', { status: 404 });
  }
};

// ============================================================================
// Document Ingestion with Chunking
// ============================================================================

async function addDocument(request, env) {
  const { title, text, metadata = {} } = await request.json();

  // 1. Store document in D1
  const result = await env.DB.prepare(
    'INSERT INTO documents (title, text, metadata, created_at) VALUES (?, ?, ?, ?)'
  ).bind(title, text, JSON.stringify(metadata), Date.now()).run();

  const docId = result.meta.last_row_id;

  // 2. Chunk the document
  const chunks = chunkText(text, 500, 50);

  // 3. Generate embeddings for all chunks
  const embeddings = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
    text: chunks
  }) as { data: number[][] };

  // 4. Insert vectors into Vectorize
  const vectors = chunks.map((chunk, i) => ({
    id: `${docId}-chunk-${i}`,
    values: embeddings.data[i],
    metadata: {
      docId: docId.toString(),
      chunkIndex: i,
      text: chunk,
      title
    }
  }));

  await env.VECTOR_INDEX.insert(vectors);

  return new Response(JSON.stringify({
    success: true,
    docId,
    chunks: chunks.length
  }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' }
  });
}

// ============================================================================
// Knowledge Base Query with RAG
// ============================================================================

async function queryKnowledgeBase(request, env) {
  const { question, topK = 3, includeDebug = false } = await request.json();

  // 1. Generate question embedding
  const questionEmbedding = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
    text: [question]
  }) as { data: number[][] };

  // 2. Find similar chunks
  const similar = await env.VECTOR_INDEX.query(questionEmbedding.data[0], {
    topK: topK * 2,  // Retrieve more for potential deduplication
    returnMetadata: true
  });

  // 3. Deduplicate by document (keep best chunk per document)
  const uniqueDocs = new Map();
  for (const match of similar.matches) {
    const docId = match.metadata.docId;
    if (!uniqueDocs.has(docId) || uniqueDocs.get(docId).score < match.score) {
      uniqueDocs.set(docId, match);
    }
  }

  // Take top K unique documents
  const topMatches = Array.from(uniqueDocs.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  // 4. Build context
  const context = topMatches
    .map((match, i) => `[Source ${i + 1}: ${match.metadata.title}]\n${match.metadata.text}`)
    .join('\n\n');

  // 5. Generate answer
  const answer = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [
      {
        role: 'system',
        content: 'You are a helpful assistant. Answer the question using ONLY the information provided in the context. If the answer cannot be found in the context, say "I don\'t have enough information to answer that question." Always cite which source(s) you used.'
      },
      {
        role: 'user',
        content: `Context:\n${context}\n\nQuestion: ${question}\n\nAnswer (with source citations):`
      }
    ],
    temperature: 0.3,
    max_tokens: 512
  });

  // 6. Prepare response
  const response = {
    answer: answer.response,
    sources: topMatches.map((match, i) => ({
      number: i + 1,
      title: match.metadata.title,
      excerpt: match.metadata.text.substring(0, 200) + '...',
      score: match.score,
      docId: match.metadata.docId
    }))
  };

  if (includeDebug) {
    response.debug = {
      questionEmbedding: questionEmbedding.data[0].slice(0, 5),
      totalMatches: similar.matches.length,
      context
    };
  }

  return new Response(JSON.stringify(response), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// ============================================================================
// List Documents
// ============================================================================

async function listDocuments(env) {
  const { results } = await env.DB.prepare(
    'SELECT id, title, created_at FROM documents ORDER BY created_at DESC'
  ).all();

  return new Response(JSON.stringify({ documents: results }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// ============================================================================
// Delete Document and Vectors
// ============================================================================

async function deleteDocument(docId, env) {
  // 1. Delete from D1
  await env.DB.prepare('DELETE FROM documents WHERE id = ?').bind(docId).run();

  // 2. Find and delete all chunks from Vectorize
  // Note: Vectorize doesn't support metadata filtering for deletion yet,
  // so we need to track chunk IDs
  const maxChunks = 100;  // Assume max 100 chunks per document
  const vectorIds = [];
  for (let i = 0; i < maxChunks; i++) {
    vectorIds.push(`${docId}-chunk-${i}`);
  }

  await env.VECTOR_INDEX.deleteByIds(vectorIds);

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// ============================================================================
// Utility: Text Chunking
// ============================================================================

function chunkText(text, chunkSize = 500, chunkOverlap = 50) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    let chunk = text.substring(start, end);

    // Try to end on a sentence boundary
    if (end < text.length) {
      const lastPeriod = chunk.lastIndexOf('.');
      const lastNewline = chunk.lastIndexOf('\n');
      const boundary = Math.max(lastPeriod, lastNewline);

      if (boundary > chunkSize / 2) {
        chunk = chunk.substring(0, boundary + 1);
        start += boundary + 1;
      } else {
        start = end;
      }
    } else {
      start = end;
    }

    chunks.push(chunk.trim());

    // Apply overlap
    if (start < text.length) {
      start -= chunkOverlap;
    }
  }

  return chunks.filter(c => c.length > 0);
}

// ============================================================================
// Advanced RAG Pattern: Hybrid Search
// ============================================================================

export async function hybridSearch(question, env) {
  // Combine vector similarity with keyword search

  // 1. Vector search
  const questionEmbedding = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
    text: [question]
  }) as { data: number[][] };

  const vectorResults = await env.VECTOR_INDEX.query(questionEmbedding.data[0], {
    topK: 10
  });

  // 2. Keyword search in D1
  const keywords = question.toLowerCase().split(' ').filter(w => w.length > 3);
  const keywordQuery = keywords.map(() => 'text LIKE ?').join(' OR ');
  const keywordParams = keywords.map(k => `%${k}%`);

  const { results: keywordResults } = await env.DB.prepare(
    `SELECT id, title, text FROM documents WHERE ${keywordQuery}`
  ).bind(...keywordParams).all();

  // 3. Merge and rerank results
  const combined = new Map();

  // Add vector results
  vectorResults.matches.forEach(match => {
    combined.set(match.metadata.docId, {
      ...match,
      vectorScore: match.score,
      keywordScore: 0
    });
  });

  // Add keyword results
  keywordResults.forEach(doc => {
    if (combined.has(doc.id.toString())) {
      combined.get(doc.id.toString()).keywordScore = 1;
    } else {
      combined.set(doc.id.toString(), {
        metadata: { docId: doc.id, title: doc.title, text: doc.text },
        vectorScore: 0,
        keywordScore: 1
      });
    }
  });

  // 4. Calculate hybrid score (weighted combination)
  const vectorWeight = 0.7;
  const keywordWeight = 0.3;

  const ranked = Array.from(combined.values())
    .map(item => ({
      ...item,
      hybridScore: (item.vectorScore * vectorWeight) + (item.keywordScore * keywordWeight)
    }))
    .sort((a, b) => b.hybridScore - a.hybridScore)
    .slice(0, 3);

  return ranked;
}

// ============================================================================
// Advanced RAG Pattern: Query Expansion
// ============================================================================

export async function queryExpansion(question, env) {
  // Generate alternative phrasings of the question

  const expandedQuestions = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [{
      role: 'user',
      content: `Generate 3 alternative ways to phrase this question:\n\n"${question}"\n\nReturn only the 3 questions, one per line, without numbering.`
    }],
    max_tokens: 100
  });

  const questions = [question, ...expandedQuestions.response.split('\n').filter(q => q.trim())];

  // Generate embeddings for all variants
  const embeddings = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
    text: questions
  }) as { data: number[][] };

  // Search with each variant and combine results
  const allMatches = new Map();

  for (const embedding of embeddings.data) {
    const results = await env.VECTOR_INDEX.query(embedding, { topK: 5 });

    results.matches.forEach(match => {
      const existing = allMatches.get(match.id);
      if (!existing || existing.score < match.score) {
        allMatches.set(match.id, match);
      }
    });
  }

  return Array.from(allMatches.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

// ============================================================================
// Database Schema (for reference)
// ============================================================================

/*
CREATE TABLE documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  text TEXT NOT NULL,
  metadata TEXT,  -- JSON string
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_documents_created_at ON documents(created_at);
*/
