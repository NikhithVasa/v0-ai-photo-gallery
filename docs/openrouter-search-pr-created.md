# OpenRouter pgvector search checklist

- Set `OPENROUTER_API_KEY` in Vercel.
- Set `OPENROUTER_EMBEDDING_MODEL=google/gemini-embedding-2`.
- Run the worker's `image_embedding=true` step before semantic search, so `photos.image_embedding` is populated with the same model.
- The search route falls back to keyword/person search if OpenRouter is unavailable.
