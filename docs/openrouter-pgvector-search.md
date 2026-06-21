# OpenRouter pgvector search

The album search API embeds the user's natural-language query with OpenRouter Gemini Embedding 2 and ranks photos by pgvector cosine distance against `photos.image_embedding`.

## Required Vercel env

```env
OPENROUTER_API_KEY=...
```

## Optional env

```env
OPENROUTER_EMBEDDING_MODEL=google/gemini-embedding-2
OPENROUTER_APP_TITLE=Saathidesk AI Photo Search
OPENROUTER_HTTP_REFERER=https://www.saathidesk.com
```

## Data requirement

The face worker must have run the full-image embedding step so photos have 768-dimensional Gemini vectors:

```json
{
  "full_mode": false,
  "steps": {
    "ingest": false,
    "compress": false,
    "image_embedding": true,
    "face_index": false,
    "safe_people_reconcile": false,
    "crop_person_covers": false,
    "enqueue_qwen": false
  }
}
```

The worker needs `OPENROUTER_API_KEY` and stores:

- `photos.image_embedding`
- `photos.image_embedding_model = 'google/gemini-embedding-2'`
- `photos.image_embedding_status`
- `photos.image_embedded_at`

The web app needs the same `OPENROUTER_API_KEY`. Both image indexing and text search request `dimensions: 768`. The search API falls back to keyword/person search when OpenRouter embedding is unavailable or fails.
