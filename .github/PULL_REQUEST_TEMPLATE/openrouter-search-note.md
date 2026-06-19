## OpenRouter pgvector search rollout

Required Vercel env:

```env
OPENROUTER_API_KEY=...
OPENROUTER_EMBEDDING_MODEL=sentence-transformers/all-minilm-l6-v2
OPENROUTER_APP_TITLE=Saathidesk AI Photo Search
OPENROUTER_HTTP_REFERER=https://www.saathidesk.com
```

Before enabling broadly, make sure the album has completed `search_embedding` rows from the worker's `embeddings=true` step.
