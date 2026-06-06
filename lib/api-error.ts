import { NextResponse } from "next/server";
import { isConnectionLimitError } from "@/lib/db";

interface RouteErrorOptions {
  operation: string;
  stage?: string;
}

function errorCode(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return null;
  }

  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "";
}

function hasMessage(error: unknown, pattern: RegExp) {
  return pattern.test(errorMessage(error));
}

function classifiedError(error: unknown) {
  const code = errorCode(error);

  if (isConnectionLimitError(error)) {
    return {
      status: 503,
      code: "DATABASE_BUSY",
      details: "The database has too many active connections. Please retry in a moment.",
      retryAfter: "2",
      sourceCode: code ?? "53300",
    };
  }

  if (
    code === "ENOTFOUND" ||
    code === "ECONNREFUSED" ||
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    hasMessage(error, /timeout|connect|connection refused|getaddrinfo/i)
  ) {
    return {
      status: 503,
      code: "DATABASE_UNREACHABLE",
      details: "The server could not reach the database. Check the database host, networking, and deployment environment variables.",
      sourceCode: code,
    };
  }

  if (code === "28P01" || hasMessage(error, /password authentication failed|PAM authentication failed|expired/i)) {
    return {
      status: 503,
      code: "DATABASE_AUTH_FAILED",
      details: "The server could not authenticate to the database. Check the RDS user, password or IAM auth token configuration.",
      sourceCode: code,
    };
  }

  if (
    hasMessage(error, /credential|access key|secret access key|Resolved credential object is not valid/i)
  ) {
    return {
      status: 503,
      code: "SERVER_CREDENTIALS_MISSING",
      details: "The server is missing required cloud credentials. Check the deployment environment variables.",
      sourceCode: code,
    };
  }

  if (code === "42P01" || code === "42703" || code === "42883") {
    return {
      status: 500,
      code: "DATABASE_SCHEMA_ERROR",
      details: "The database schema is missing a required table, column, or function for this request.",
      sourceCode: code,
    };
  }

  if (hasMessage(error, /supabase|auth/i)) {
    return {
      status: 503,
      code: "AUTH_PROVIDER_ERROR",
      details: "The server could not verify the login session with the auth provider. Sign in again; if it continues, check Supabase configuration.",
      sourceCode: code,
    };
  }

  return {
    status: 500,
    code: "SERVER_ERROR",
    details: "The server hit an unexpected error. Check the server logs for the full exception.",
    sourceCode: code,
  };
}

export function apiErrorResponse(error: unknown, options: RouteErrorOptions) {
  const classified = classifiedError(error);
  const headers: Record<string, string> = {
    "Cache-Control": "no-store",
  };

  if (classified.retryAfter) {
    headers["Retry-After"] = classified.retryAfter;
  }

  return NextResponse.json(
    {
      error: options.operation,
      code: classified.code,
      stage: options.stage ?? null,
      details: options.stage
        ? `${classified.details} Failed while ${options.stage}.`
        : classified.details,
      sourceCode: classified.sourceCode ?? null,
    },
    {
      status: classified.status,
      headers,
    },
  );
}
