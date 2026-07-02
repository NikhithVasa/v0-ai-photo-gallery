import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireCustomerAccessBySlug } from "@/lib/auth-access";
import { ensureCustomerAccessSchema } from "@/lib/customer-schema";
import { s3PrefixStorageStats } from "@/lib/s3";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Props {
  params: Promise<{ customerSlug: string }>;
}

interface CustomerRow {
  id: string;
  slug: string;
  name: string;
}

interface AlbumRow {
  id: string;
  slug: string;
  name: string;
}

interface DbTableEstimate {
  tableName: string;
  rowCount: number;
  bytes: number;
}

interface TableScope {
  tableName: string;
  sql: string;
}

function countValue(value: number | string | null) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number.parseInt(value, 10) || 0;
  return 0;
}

function bytesValue(value: number | string | null) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number.parseInt(value, 10) || 0;
  return 0;
}

function storageUsdPerGbMonth() {
  const value =
    process.env.S3_STORAGE_USD_PER_GB_MONTH ||
    process.env.S3_STANDARD_STORAGE_USD_PER_GB_MONTH ||
    "0.023";
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0.023;
}

function rdsUsdPerGbMonth() {
  const value =
    process.env.RDS_STORAGE_USD_PER_GB_MONTH ||
    process.env.RDS_POSTGRES_STORAGE_USD_PER_GB_MONTH ||
    "0.115";
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0.115;
}

function estimate(bytes: number, pricePerGbMonth: number) {
  const gb = bytes / 1024 ** 3;
  return {
    bytes,
    gb,
    estimatedMonthlyUsd: gb * pricePerGbMonth,
    pricePerGbMonth,
  };
}

async function tableExists(tableName: string) {
  const row = await queryOne<{ exists: boolean }>(
    `
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = $1
    ) AS exists
    `,
    [tableName],
  );

  return Boolean(row?.exists);
}

async function tableEstimate(scope: TableScope, customerId: string) {
  if (!(await tableExists(scope.tableName))) {
    return { tableName: scope.tableName, rowCount: 0, bytes: 0 };
  }

  const row = await queryOne<{
    row_count: number | string | null;
    bytes: number | string | null;
  }>(scope.sql, [customerId]).catch((error) => {
    console.warn("Could not estimate customer table storage", {
      tableName: scope.tableName,
      error,
    });
    return null;
  });

  return {
    tableName: scope.tableName,
    rowCount: countValue(row?.row_count ?? 0),
    bytes: bytesValue(row?.bytes ?? 0),
  };
}

const dbTableScopes: TableScope[] = [
  {
    tableName: "customers",
    sql: `SELECT COUNT(*)::int AS row_count, COALESCE(SUM(pg_column_size(c)), 0)::bigint AS bytes FROM customers c WHERE c.id = $1::uuid`,
  },
  {
    tableName: "customer_users",
    sql: `SELECT COUNT(*)::int AS row_count, COALESCE(SUM(pg_column_size(cu)), 0)::bigint AS bytes FROM customer_users cu WHERE cu.customer_id = $1::uuid`,
  },
  {
    tableName: "albums",
    sql: `SELECT COUNT(*)::int AS row_count, COALESCE(SUM(pg_column_size(a)), 0)::bigint AS bytes FROM albums a WHERE a.customer_id = $1::uuid`,
  },
  {
    tableName: "album_events",
    sql: `SELECT COUNT(*)::int AS row_count, COALESCE(SUM(pg_column_size(e)), 0)::bigint AS bytes FROM album_events e JOIN albums a ON a.id = e.album_id WHERE a.customer_id = $1::uuid`,
  },
  {
    tableName: "photos",
    sql: `SELECT COUNT(*)::int AS row_count, COALESCE(SUM(pg_column_size(p)), 0)::bigint AS bytes FROM photos p JOIN albums a ON a.id = p.album_id WHERE a.customer_id = $1::uuid`,
  },
  {
    tableName: "people",
    sql: `SELECT COUNT(*)::int AS row_count, COALESCE(SUM(pg_column_size(pe)), 0)::bigint AS bytes FROM people pe JOIN albums a ON a.id = pe.album_id WHERE a.customer_id = $1::uuid`,
  },
  {
    tableName: "faces",
    sql: `SELECT COUNT(*)::int AS row_count, COALESCE(SUM(pg_column_size(f)), 0)::bigint AS bytes FROM faces f JOIN albums a ON a.id = f.album_id WHERE a.customer_id = $1::uuid`,
  },
  {
    tableName: "photo_people",
    sql: `SELECT COUNT(*)::int AS row_count, COALESCE(SUM(pg_column_size(pp)), 0)::bigint AS bytes FROM photo_people pp JOIN photos p ON p.id = pp.photo_id JOIN albums a ON a.id = p.album_id WHERE a.customer_id = $1::uuid`,
  },
  {
    tableName: "photo_sort_positions",
    sql: `SELECT COUNT(*)::int AS row_count, COALESCE(SUM(pg_column_size(psp)), 0)::bigint AS bytes FROM photo_sort_positions psp JOIN album_events e ON e.id = psp.album_event_id JOIN albums a ON a.id = e.album_id WHERE a.customer_id = $1::uuid`,
  },
  {
    tableName: "photo_edits",
    sql: `SELECT COUNT(*)::int AS row_count, COALESCE(SUM(pg_column_size(pe)), 0)::bigint AS bytes FROM photo_edits pe JOIN albums a ON a.id = pe.album_id WHERE a.customer_id = $1::uuid`,
  },
  {
    tableName: "processing_jobs",
    sql: `SELECT COUNT(*)::int AS row_count, COALESCE(SUM(pg_column_size(pj)), 0)::bigint AS bytes FROM processing_jobs pj JOIN albums a ON a.id = pj.album_id WHERE a.customer_id = $1::uuid`,
  },
  {
    tableName: "person_event_stats",
    sql: `SELECT COUNT(*)::int AS row_count, COALESCE(SUM(pg_column_size(pes)), 0)::bigint AS bytes FROM person_event_stats pes JOIN albums a ON a.id = pes.album_id WHERE a.customer_id = $1::uuid`,
  },
  {
    tableName: "person_aliases",
    sql: `SELECT COUNT(*)::int AS row_count, COALESCE(SUM(pg_column_size(pa)), 0)::bigint AS bytes FROM person_aliases pa JOIN people pe ON pe.id = pa.person_id JOIN albums a ON a.id = pe.album_id WHERE a.customer_id = $1::uuid`,
  },
  {
    tableName: "person_merge_history",
    sql: `SELECT COUNT(*)::int AS row_count, COALESCE(SUM(pg_column_size(pmh)), 0)::bigint AS bytes FROM person_merge_history pmh JOIN albums a ON a.id = pmh.album_id WHERE a.customer_id = $1::uuid`,
  },
  {
    tableName: "person_merge_candidates",
    sql: `SELECT COUNT(*)::int AS row_count, COALESCE(SUM(pg_column_size(pmc)), 0)::bigint AS bytes FROM person_merge_candidates pmc JOIN albums a ON a.id = pmc.album_id WHERE a.customer_id = $1::uuid`,
  },
  {
    tableName: "person_cooccurrence_stats",
    sql: `SELECT COUNT(*)::int AS row_count, COALESCE(SUM(pg_column_size(pcs)), 0)::bigint AS bytes FROM person_cooccurrence_stats pcs JOIN albums a ON a.id = pcs.album_id WHERE a.customer_id = $1::uuid`,
  },
  {
    tableName: "photo_relationships",
    sql: `SELECT COUNT(*)::int AS row_count, COALESCE(SUM(pg_column_size(pr)), 0)::bigint AS bytes FROM photo_relationships pr JOIN albums a ON a.id = pr.album_id WHERE a.customer_id = $1::uuid`,
  },
  {
    tableName: "photo_similarity_clusters",
    sql: `SELECT COUNT(*)::int AS row_count, COALESCE(SUM(pg_column_size(psc)), 0)::bigint AS bytes FROM photo_similarity_clusters psc JOIN albums a ON a.id = psc.album_id WHERE a.customer_id = $1::uuid`,
  },
  {
    tableName: "photo_similarity_cluster_items",
    sql: `SELECT COUNT(*)::int AS row_count, COALESCE(SUM(pg_column_size(psci)), 0)::bigint AS bytes FROM photo_similarity_cluster_items psci JOIN photo_similarity_clusters psc ON psc.id = psci.cluster_id JOIN albums a ON a.id = psc.album_id WHERE a.customer_id = $1::uuid`,
  },
  {
    tableName: "photo_culling_scores",
    sql: `SELECT COUNT(*)::int AS row_count, COALESCE(SUM(pg_column_size(pcs)), 0)::bigint AS bytes FROM photo_culling_scores pcs JOIN photos p ON p.id = pcs.photo_id JOIN albums a ON a.id = p.album_id WHERE a.customer_id = $1::uuid`,
  },
  {
    tableName: "album_share_links",
    sql: `SELECT COUNT(*)::int AS row_count, COALESCE(SUM(pg_column_size(asl)), 0)::bigint AS bytes FROM album_share_links asl WHERE asl.customer_id = $1::uuid OR EXISTS (SELECT 1 FROM albums a WHERE a.id = asl.album_id AND a.customer_id = $1::uuid)`,
  },
  {
    tableName: "videos",
    sql: `SELECT COUNT(*)::int AS row_count, COALESCE(SUM(pg_column_size(v)), 0)::bigint AS bytes FROM videos v JOIN albums a ON a.id = v.album_id WHERE a.customer_id = $1::uuid`,
  },
  {
    tableName: "video_face_matches",
    sql: `SELECT COUNT(*)::int AS row_count, COALESCE(SUM(pg_column_size(vfm)), 0)::bigint AS bytes FROM video_face_matches vfm JOIN videos v ON v.id = vfm.video_id JOIN albums a ON a.id = v.album_id WHERE a.customer_id = $1::uuid`,
  },
];

export async function GET(request: Request, { params }: Props) {
  try {
    const { customerSlug } = await params;
    const accessDenied = await requireCustomerAccessBySlug(request, customerSlug);
    if (accessDenied) return accessDenied;

    await ensureCustomerAccessSchema();

    const customer = await queryOne<CustomerRow>(
      `
      SELECT id, slug, name
      FROM customers
      WHERE slug = $1
        AND COALESCE(is_deleted, false) = false
      LIMIT 1
      `,
      [customerSlug],
    );

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const albums = await query<AlbumRow>(
      `
      SELECT id, slug, name
      FROM albums
      WHERE customer_id = $1::uuid
      ORDER BY name ASC
      `,
      [customer.id],
    );

    const s3Prefixes = [
      { kind: "customer", label: customer.name, prefix: `customers/${customer.slug}/` },
      ...albums.map((album) => ({
        kind: "album",
        label: album.name,
        prefix: `albums/${album.slug}/`,
      })),
    ];

    const s3PrefixStats = await Promise.all(
      s3Prefixes.map(async (entry) => {
        const stats = await s3PrefixStorageStats(entry.prefix);
        return { ...entry, ...stats };
      }),
    );
    const s3Bytes = s3PrefixStats.reduce((total, entry) => total + entry.bytes, 0);
    const s3ObjectCount = s3PrefixStats.reduce((total, entry) => total + entry.objectCount, 0);
    const s3PricePerGbMonth = storageUsdPerGbMonth();

    const s3EstimatedMonthlyUsd = (s3Bytes / 1024 ** 3) * s3PricePerGbMonth;

    const dbTables = await Promise.all(
      dbTableScopes.map((scope) => tableEstimate(scope, customer.id)),
    );
    const dbBytes = dbTables.reduce((total, table) => total + table.bytes, 0);
    const dbRowCount = dbTables.reduce((total, table) => total + table.rowCount, 0);
    const dbPricePerGbMonth = rdsUsdPerGbMonth();
    const dbEstimatedMonthlyUsd = (dbBytes / 1024 ** 3) * dbPricePerGbMonth;

    return NextResponse.json(
      {
        customer: {
          id: customer.id,
          slug: customer.slug,
          name: customer.name,
        },
        costs: {
          total: {
            bytes: s3Bytes + dbBytes,
            gb: (s3Bytes + dbBytes) / 1024 ** 3,
            estimatedMonthlyUsd: s3EstimatedMonthlyUsd + dbEstimatedMonthlyUsd,
          },
          s3: {
            ...estimate(s3Bytes, s3PricePerGbMonth),
            objectCount: s3ObjectCount,
            prefixes: s3PrefixStats,
          },
          rds: {
            ...estimate(dbBytes, dbPricePerGbMonth),
            rowCount: dbRowCount,
            tables: dbTables.filter((table): table is DbTableEstimate => table.rowCount > 0 || table.bytes > 0),
          },
          estimatedMonthlyUsd: s3EstimatedMonthlyUsd + dbEstimatedMonthlyUsd,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      },
    );
  } catch (error) {
    console.error("Error fetching customer costs:", error);
    return NextResponse.json(
      { error: "Failed to fetch customer costs" },
      { status: 500 },
    );
  }
}