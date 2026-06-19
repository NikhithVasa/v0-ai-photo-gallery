import { NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";

const CONTACT_EMAIL = "brunoboy0102@gmail.com";

const contactSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().min(7).max(30),
  description: z.string().trim().min(10).max(5000),
  website: z.string().max(0).optional(),
});

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character] ?? character,
  );
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const result = contactSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Please complete every field with valid information." },
      { status: 400 },
    );
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.RESEND_FROM_EMAIL ?? "SaathiDesk <onboarding@resend.dev>";

  if (!apiKey) {
    console.error("Contact form email is not configured.");
    return NextResponse.json(
      { error: "The contact form is temporarily unavailable." },
      { status: 503 },
    );
  }

  const { name, email, phone, description } = result.data;
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safePhone = escapeHtml(phone);
  const safeDescription = escapeHtml(description).replace(/\n/g, "<br />");
  const resend = new Resend(apiKey);

  try {
    const { error } = await resend.emails.send({
      from,
      to: [CONTACT_EMAIL],
      replyTo: email,
      subject: `New SaathiDesk contact request from ${name.replace(/[\r\n]+/g, " ")}`,
      html: `
        <h1>New SaathiDesk contact request</h1>
        <p><strong>Name:</strong> ${safeName}</p>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <p><strong>Phone:</strong> ${safePhone}</p>
        <p><strong>Description:</strong></p>
        <p>${safeDescription}</p>
      `,
      text: [
        "New SaathiDesk contact request",
        "",
        `Name: ${name}`,
        `Email: ${email}`,
        `Phone: ${phone}`,
        "",
        "Description:",
        description,
      ].join("\n"),
    });

    if (!error) {
      return NextResponse.json({ ok: true });
    }

    console.error("Failed to send contact form email:", error);
  } catch (error) {
    console.error("Failed to send contact form email:", error);
  }

  return NextResponse.json(
    { error: "We could not send your message. Please try again." },
    { status: 502 },
  );
}
