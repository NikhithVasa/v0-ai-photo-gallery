import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { signedUploadUrl } from "@/lib/s3";
import { ensureCustomerAccessSchema } from "@/lib/customer-schema";
import { requireCustomerAccessBySlug } from "@/lib/auth-access";

interface Props {
  params: Promise<{ customerSlug: string }>;
}

function extensionFromFileName(fileName: string) {
  const match = fileName
    .toLowerCase()
    .match(/\.(jpe?g|png|webp|gif|avif|heic|heif)$/);
  return match ? `.${match[1]}` : ".jpg";
}

function contentTypeFromInput(contentType: unknown, fileName: string) {
  if (typeof contentType === "string" && contentType.startsWith("image/")) {
    return contentType;
  }

  const ext = extensionFromFileName(fileName);
  return (
    {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
      ".gif": "image/gif",
      ".avif": "image/avif",
      ".heic": "image/heic",
      ".heif": "image/heif",
    }[ext] ?? "application/octet-stream"
  );
}

export async function POST(request: Request, { params }: Props) {
  try {
    await ensureCustomerAccessSchema();
    const { customerSlug } = await params;
    
    const accessDenied = await requireCustomerAccessBySlug(request, customerSlug);
    if (accessDenied) return accessDenied;
    const body = (await request.json()) as {
      fileName?: unknown;
      size?: unknown;
      contentType?: unknown;
    };
    const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";

    if (!fileName) {
      return NextResponse.json({ error: "fileName is required" }, { status: 400 });
    }

    if (typeof body.size !== "number" || body.size <= 0) {
      return NextResponse.json({ error: "size is required" }, { status: 400 });
    }

    const customer = await queryOne<{ id: string; slug: string }>(
      `
      SELECT id, slug
      FROM customers
      WHERE slug = $1
        AND COALESCE(is_deleted, false) = false
      LIMIT 1
      `,
      [customerSlug]
    );

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const contentType = contentTypeFromInput(body.contentType, fileName);
    const key = `customers/${customer.slug}/cover/${randomUUID()}${extensionFromFileName(
      fileName
    )}`;

    await queryOne<{ id: string }>(
      `
      UPDATE customers
      SET cover_photo_s3_key = $2,
          updated_at = now()
      WHERE id = $1::uuid
      RETURNING id
      `,
      [customer.id, key]
    );

    return NextResponse.json({
      upload: {
        key,
        contentType,
        uploadUrl: await signedUploadUrl(key, contentType),
      },
    });
  } catch (error) {
    console.error("Error preparing customer cover upload:", error);
    return NextResponse.json(
      { error: "Failed to prepare cover upload" },
      { status: 500 }
    );
  }
}
