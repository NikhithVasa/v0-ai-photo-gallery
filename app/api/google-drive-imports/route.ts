import { randomUUID } from "node:crypto";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { NextResponse } from "next/server";
import { z } from "zod";
import { queryOne } from "@/lib/db";

import {
  requireAdminAccess,
  requireAlbumCustomerAccess,
} from "@/lib/auth-access";

export const driveFolderLinkSchema = z
  .string()
  .trim()
  .min(1)
  .max(2_048)
  .refine((value) => {
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" || url.hostname !== "drive.google.com") {
        return false;
      }

      const folderId = url.pathname.match(/^\/drive\/(?:u\/\d+\/)?folders\/([A-Za-z0-9_-]+)(?:\/|$)/)?.[1]
        ?? url.pathname.match(/^\/folders\/([A-Za-z0-9_-]+)(?:\/|$)/)?.[1]
        ?? (url.pathname === "/open" ? url.searchParams.get("id") : null);
      return Boolean(folderId && /^[A-Za-z0-9_-]+$/.test(folderId));
    } catch {
      return false;
    }
  }, "Paste a recognizable public Google Drive folder URL.");

const slugSchema = z.string().trim().min(1).max(200);
const nameSchema = z.string().trim().min(1).max(300);

export const requestSchema = z
  .object({
    folderLink: driveFolderLinkSchema,
    mode: z.enum(["existing", "new"]),
    albumSlug: slugSchema.optional(),
    albumName: nameSchema.optional(),
    eventSlug: slugSchema.optional(),
    eventName: nameSchema.optional(),
    runAi: z.boolean().optional().default(true),
  })
  .strict()
  .superRefine((body, context) => {
    if (body.mode === "new") {
      if (!body.albumName) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["albumName"],
          message: "albumName is required when creating an album.",
        });
      }
      if (!body.eventName) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["eventName"],
          message: "eventName is required when creating an album.",
        });
      }
      if (body.albumSlug || body.eventSlug) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "albumSlug and eventSlug are not accepted in new mode.",
        });
      }
      return;
    }

    if (!body.albumSlug) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["albumSlug"],
        message: "albumSlug is required for an existing album.",
      });
    }
    if (!body.eventSlug && !body.eventName) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["eventSlug"],
        message: "eventSlug or eventName is required.",
      });
    }
  });

const importAccessKeyId =
  process.env.GOOGLE_DRIVE_IMPORT_AWS_ACCESS_KEY_ID?.trim();
const importSecretAccessKey =
  process.env.GOOGLE_DRIVE_IMPORT_AWS_SECRET_ACCESS_KEY?.trim();

const globalForLambda = globalThis as unknown as {
  googleDriveImportLambdaClient?: LambdaClient;
};

const lambdaClient =
  globalForLambda.googleDriveImportLambdaClient ??
  new LambdaClient({
    region: process.env.AWS_REGION,
    credentials:
      importAccessKeyId && importSecretAccessKey
        ? {
            accessKeyId: importAccessKeyId,
            secretAccessKey: importSecretAccessKey,
          }
        : undefined,
  });

if (process.env.NODE_ENV !== "production") {
  globalForLambda.googleDriveImportLambdaClient = lambdaClient;
}

export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_ASYNC_GOOGLE_DRIVE_IMPORT_ENABLED !== "true") {
    return NextResponse.json(
      { error: "Asynchronous Google Drive imports are not enabled." },
      { status: 404 },
    );
  }

  if (Boolean(importAccessKeyId) !== Boolean(importSecretAccessKey)) {
    console.error(
      "GOOGLE_DRIVE_IMPORT_AWS_ACCESS_KEY_ID and GOOGLE_DRIVE_IMPORT_AWS_SECRET_ACCESS_KEY must be configured together",
    );
    return NextResponse.json(
      { error: "Google Drive imports are temporarily unavailable." },
      { status: 503 },
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "A valid JSON body is required." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid Google Drive import request.",
        issues: parsed.error.issues.map(({ path, message }) => ({ path, message })),
      },
      { status: 400 },
    );
  }

  const body = parsed.data;
  if (body.mode === "new") {
    const authorization = await requireAdminAccess();
    if (authorization.response) return authorization.response;
  } else {
    const accessDenied = await requireAlbumCustomerAccess(body.albumSlug!);
    if (accessDenied) return accessDenied;
  }

  if (body.mode === "existing" && body.eventSlug && !body.eventName) {
    const target = await queryOne<{ exists: boolean }>(
      `
      SELECT EXISTS (
        SELECT 1
        FROM album_events e
        JOIN albums a ON a.id = e.album_id
        WHERE lower(a.slug) = lower($1)
          AND lower(e.slug) = lower($2)
          AND COALESCE(a.is_deleted, false) = false
          AND COALESCE(e.is_deleted, false) = false
      ) AS exists
      `,
      [body.albumSlug, body.eventSlug],
    );
    if (!target?.exists) {
      return NextResponse.json(
        { error: "Select an existing event or enter a new event name." },
        { status: 404 },
      );
    }
  }

  const functionName = process.env.GOOGLE_DRIVE_IMPORT_LAMBDA_NAME?.trim();
  if (!functionName) {
    console.error("GOOGLE_DRIVE_IMPORT_LAMBDA_NAME is not configured");
    return NextResponse.json(
      { error: "Google Drive imports are temporarily unavailable." },
      { status: 503 },
    );
  }

  const googleDriveApiKey =
    process.env.NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY?.trim();
  if (!googleDriveApiKey) {
    console.error("NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY is not configured");
    return NextResponse.json(
      { error: "Google Drive imports are temporarily unavailable." },
      { status: 503 },
    );
  }

  const requestId = randomUUID();
  try {
    const result = await lambdaClient.send(
      new InvokeCommand({
        FunctionName: functionName,
        InvocationType: "Event",
        Payload: new TextEncoder().encode(
          JSON.stringify({ requestId, ...body, googleDriveApiKey }),
        ),
      }),
    );

    if (result.StatusCode !== 202 || result.FunctionError) {
      throw new Error(
        `Lambda rejected asynchronous invocation (status ${result.StatusCode ?? "unknown"}).`,
      );
    }

    return NextResponse.json(
      {
        requestId,
        message:
          "Your Google Drive folder was queued for import. You can add another folder while it runs.",
      },
      { status: 202 },
    );
  } catch (error) {
    console.error("Failed to queue Google Drive import", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Google Drive import could not be queued. Please try again." },
      { status: 502 },
    );
  }
}
