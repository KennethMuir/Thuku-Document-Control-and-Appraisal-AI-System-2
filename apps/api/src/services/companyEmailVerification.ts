import { Resend } from "resend";

type ResendSendResult = {
  id: string;
};

export async function sendCompanyEmailVerificationEmail(
  companyEmail: string,
  verificationUrl: string
): Promise<ResendSendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim();

  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  if (!fromEmail) {
    throw new Error("RESEND_FROM_EMAIL is not configured.");
  }

  const resend = new Resend(apiKey);

  const safeUrl = verificationUrl
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const { data, error } = await resend.emails.send({
    from: fromEmail,
    to: [companyEmail],
    subject: "Verify your company email",
    text: [
      "Please verify the company email address registered for your document workspace.",
      "",
      `Confirm your company email using this link: ${verificationUrl}`,
      "",
      "If you did not request this registration, you can ignore this email.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#24364b">
        <h2>Verify your company email</h2>
        <p>
          Please confirm the company email address registered for your
          document workspace.
        </p>
        <p>
          <a href="${safeUrl}"
             style="display:inline-block;padding:12px 20px;background:#243b75;color:#ffffff;text-decoration:none;border-radius:6px">
            Verify company email
          </a>
        </p>
        <p>If you did not request this registration, you can ignore this email.</p>
      </div>
    `,
  });

  if (error) {
    console.error("Resend company verification email failed:", {
      name: error.name,
      statusCode: error.statusCode,
    });

    throw new Error("Unable to send company verification email.");
  }

  if (!data?.id) {
    throw new Error("Resend did not return an email ID.");
  }

  return { id: data.id };
}
