# Ask AI Prompt Guide

This guide is based on the current photo metadata in the database and the current
Ask AI implementation.

## Current Data Snapshot

Albums with AI text:

| Album | Photos | Photos with search text | People |
| --- | ---: | ---: | ---: |
| `kavya` | 327 | 162 | 144 |
| `nikhith-wedding-2026` | 222 | 107 | 58 |

Common useful photo terms already present in the data include:

- `traditional`
- `floral`
- `ceremony`
- `saree`
- `stage`
- `couple`
- `family`
- `bride`
- `groom`
- `gold`
- `makeup`
- `jewelry`
- `smiling`

The current data has matches for `jewelry`, `gold`, `bangles`, and `necklace`.
It does not currently use the exact word `ornaments` often enough to rely on it.
Use `jewelry`, `gold`, `bangles`, or `necklace` instead.

## What Ask AI Can Do Today

Ask AI currently returns matching photos. It does not yet return a written
analysis like "Person X wore the most jewelry."

It can combine:

- Person numbers, like `person 1`
- Edited names, like `Kavya` or `Shramik`
- Multiple people in the same photo
- The currently selected album
- The currently selected event tab
- Photo/person description keywords, like `jewelry`, `gold`, `saree`, `stage`

## Person Prompts

Use these when you want photos of specific people:

```text
photos of person 1
photos of person 1 and person 23
photos of person 1 with person 23
photos of Kavya
photos of Kavya with Shramik
photos of Shramik
```

Names work after the person has been renamed in the People screen.

## Person + Description Prompts

Use these when you want a specific person doing or wearing something:

```text
photos of Kavya with jewelry
photos of Kavya in saree
photos of Shramik in traditional attire
photos of person 1 with gold jewelry
photos of person 2 with bangles
photos of person 1 smiling
photos of person 1 on stage
photos of person 1 near floral decorations
```

## Scene Prompts

Use these when you do not care who is in the photo:

```text
wedding ceremony
traditional attire
floral decorations
decorated stage
family portrait
couple photos
bride jewelry
groom traditional attire
makeup
gold jewelry
saree
children
group photo
```

## Multi-Person Prompts

These should return photos where selected people appear together:

```text
photos of person 1 and person 2
photos of Kavya and Shramik
photos of person 1 with person 2 on stage
photos of person 1 and person 2 with floral decorations
photos of Kavya and Shramik in wedding ceremony
```

You can also use the People filter in the album header. That is more reliable
than typing many people into the search box because the filter passes exact
person IDs to the backend.

## Ornament / Jewelry Prompts

Do not ask:

```text
who wore a lot of ornaments?
```

That is a ranking/analysis question. Current Ask AI is photo search, not a
people-ranking answer engine.

Better prompts today:

```text
jewelry
gold jewelry
bangles
necklace
saree jewelry
bride jewelry
photos of Kavya with jewelry
photos of Shramik with gold
photos of person 1 with bangles
```

Based on current person-level metadata, the strongest jewelry/ornament-like
matches are:

| Album | Person | Matching photos | Matched terms |
| --- | --- | ---: | --- |
| `nikhith-wedding-2026` | Person 2 | 8 | `bangles`, `gold`, `jewelry`, `ornate` |
| `nikhith-wedding-2026` | Person 1 | 7 | `bangles`, `gold`, `jewelry`, `ornate` |
| `kavya` | Shramik | 7 | `gold`, `jewelry` |
| `kavya` | Kavya | 5 | `gold`, `jewelry` |
| `nikhith-wedding-2026` | Person 3 | 2 | `bangles`, `gold` |
| `kavya` | Person 4 | 1 | `jewelry` |
| `kavya` | Person 5 | 1 | `necklace` |

## Good Prompt Patterns

Use short, keyword-heavy prompts:

```text
[person or name] + [visual keyword]
[person 1] and [person 2] + [scene keyword]
[scene keyword]
[clothing/jewelry keyword]
```

Examples:

```text
Kavya jewelry
Kavya saree gold
Shramik traditional attire
person 1 floral decorations
person 1 and person 2 ceremony
bride colorful saree
groom traditional attire
family portrait
decorated stage
```

## Weak Prompt Patterns

These are less reliable today:

```text
who looked happiest?
who wore the most ornaments?
which person is the bride?
show me the best photos
find emotional photos of uncle
```

They need either better metadata, named people, or a backend answer/ranking layer.

## Backend Improvement Needed For "Who Wore The Most Ornaments?"

To answer this properly, backend should add a separate analytical search mode.
The flow should be:

1. Detect questions like `who wore...`, `who has the most...`, `which person...`.
2. Expand synonyms:

```text
ornaments -> jewelry, gold, bangles, necklace, ornate
jewellery -> jewelry
traditional clothes -> traditional attire, saree, kurta
```

3. Score `photo_people.search_text` and `photo_people.qwen_description`.
4. Group by person.
5. Return people with matching photo counts and sample photos.

Example SQL shape:

```sql
WITH terms(term) AS (
  VALUES ('jewelry'), ('gold'), ('bangles'), ('necklace'), ('ornate')
),
matches AS (
  SELECT
    pp.album_id,
    pp.person_id,
    pp.photo_id,
    t.term
  FROM photo_people pp
  JOIN terms t ON (
    COALESCE(pp.search_text, '') || ' ' || COALESCE(pp.qwen_description, '')
  ) ILIKE '%' || t.term || '%'
)
SELECT
  a.slug AS album_slug,
  pe.id AS person_id,
  pe.person_number,
  COALESCE(pe.display_name, pe.default_name) AS person_name,
  COUNT(DISTINCT m.photo_id) AS matching_photo_count,
  STRING_AGG(DISTINCT m.term, ', ' ORDER BY m.term) AS matched_terms
FROM matches m
JOIN people pe ON pe.id = m.person_id
JOIN albums a ON a.id = m.album_id
WHERE a.slug = $1
GROUP BY a.slug, pe.id, pe.person_number, person_name
ORDER BY matching_photo_count DESC, pe.person_number ASC
LIMIT 10;
```

The frontend can then show:

```text
People most associated with jewelry:
1. Person 2 - 8 photos
2. Person 1 - 7 photos
3. Shramik - 7 photos
```

This should be additive. Do not rewrite Qwen descriptions just to add real
names. Keep names in `people.display_name` / `person_aliases`, and use those to
resolve people before searching descriptions.
