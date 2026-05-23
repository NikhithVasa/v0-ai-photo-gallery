import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const globalForS3 = globalThis as unknown as {
  s3Client: S3Client | undefined;
};

export const s3 =
  globalForS3.s3Client ??
  new S3Client({
    region: process.env.AWS_REGION!,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

if (process.env.NODE_ENV !== "production") globalForS3.s3Client = s3;

export async function signedUrl(key?: string | null): Promise<string | null> {
  if (!key) return null;

  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: key,
  });

  return getSignedUrl(s3, command, { expiresIn: 60 * 60 });
}

export async function signedDownloadUrl(
  key?: string | null,
  filename?: string
): Promise<string | null> {
  if (!key) return null;

  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: key,
    ResponseContentDisposition: filename
      ? `attachment; filename="${filename}"`
      : "attachment",
  });

  return getSignedUrl(s3, command, { expiresIn: 60 * 60 });
}
