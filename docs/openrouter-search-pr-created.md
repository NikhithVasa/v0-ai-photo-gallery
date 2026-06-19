# OpenRouter pgvector search checklist

- Set `OPENROUTER_API_KEY` in Vercel.
- Keep `OPENROUTER_EMBEDDING_MODEL=sentence-transformers/all-minilm-l6-v2` unless all stored embeddings are regenerated with another model.
- Run worker embeddings before semantic search, so `photos.search_embedding` is populated.
- The search route falls back to keyword/person search if OpenRouter is unavailable.
