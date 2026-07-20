import { NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";

const newsletterSchema = z.object({
  email: z.string().trim().email().max(254),
  website: z.string().max(0).optional(),
});

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const result = newsletterSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 },
    );
  }

  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.error("Newsletter signup is not configured.");
    return NextResponse.json(
      { error: "Newsletter signup is temporarily unavailable." },
      { status: 503 },
    );
  }

  const { email } = result.data;
  const segmentId = process.env.RESEND_NEWSLETTER_SEGMENT_ID;
  const resend = new Resend(apiKey);

  try {
    const existing = await resend.contacts.get({ email });

    if (existing.data) {
      if (segmentId) {
        const { error } = await resend.contacts.segments.add({
          contactId: existing.data.id,
          segmentId,
        });

        if (error && error.statusCode !== 409) {
          throw new Error(error.message);
        }
      }

      return NextResponse.json({ ok: true });
    }

    if (existing.error && existing.error.statusCode !== 404) {
      throw new Error(existing.error.message);
    }

    const { error } = await resend.contacts.create({
      email,
      unsubscribed: false,
      ...(segmentId ? { segments: [{ id: segmentId }] } : {}),
    });

    if (!error) {
      return NextResponse.json({ ok: true }, { status: 201 });
    }

    if (error.statusCode === 409) {
      return NextResponse.json({ ok: true });
    }

    throw new Error(error.message);
  } catch (error) {
    console.error("Failed to add newsletter contact in Resend:", error);
    return NextResponse.json(
      { error: "We could not subscribe you. Please try again." },
      { status: 502 },
    );
  }
}
