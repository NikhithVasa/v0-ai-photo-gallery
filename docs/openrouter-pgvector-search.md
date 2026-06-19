# OpenRouter pgvector search

The album search API can embed the user's natural-language query with OpenRouter and rank photos by pgvector cosine distance against `photos.search_embedding`.

## Required Vercel env

```env
OPENROUTER_API_KEY=...
```

## Optional env

```env
OPENROUTER_EMBEDDING_MODEL=sentence-transformers/all-minilm-l6-v2
OPENROUTER_APP_TITLE=Saathidesk AI Photo Search
OPENROUTER_HTTP_REFERER=https://www.saathidesk.com
```

## Data requirement

The photo AI worker must have run the embeddings step so photos have `search_embedding` values:

```json
{
  "qwen": true,
  "embeddings": true
}
```

The search API falls back to the existing keyword/person search when OpenRouter embedding is unavailable or fails.
