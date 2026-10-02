const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * sendEmail(to, otp, type)
 * @param {string} to    - recipient email
 * @param {string} otp   - 6-digit OTP string
 * @param {string} type  - "login" | "signup"
 *
 * 
 */
const sendEmail = async (to, otp, type = "login") => {
  const isSignup = type === "signup";

  const subject = isSignup
    ? "Welcome to CampusDeals – Verify your email"
    : "Your CampusDeals login code";

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
          <tr>
            <td align="center">
              <table width="480" cellpadding="0" cellspacing="0"
                style="background:#fffaf6;border-radius:16px;overflow:hidden;
                       box-shadow:0 4px 24px rgba(0,0,0,0.08);">

                <!-- Header bar -->
                <tr>
                  <td style="background:linear-gradient(90deg,#f97316,#ef4444);
                              padding:16px 32px;">
                    <p style="margin:0;font-size:20px;font-weight:700;color:#fff;
                               letter-spacing:0.3px;">
                      Campus<span style="opacity:0.85;">Deals</span>
                    </p>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding:36px 40px 28px;">
                    <h2 style="margin:0 0 8px;font-size:22px;color:#111827;">
                      ${isSignup ? "Verify your email" : "Your login code"}
                    </h2>
                    <p style="margin:0 0 28px;font-size:15px;color:#6b7280;line-height:1.6;">
                      ${
                        isSignup
                          ? "Thanks for joining CampusDeals! Use the code below to complete your registration."
                          : "Use the code below to sign in to your CampusDeals account."
                      }
                      <br/>This code is valid for <strong>5 minutes</strong>.
                    </p>

                    <!-- OTP box -->
                    <table cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
                      <tr>
                        <td style="background:#fff5eb;border:2px solid #fdba74;
                                    border-radius:12px;padding:18px 40px;text-align:center;">
                          <span style="font-size:36px;font-weight:800;
                                       letter-spacing:10px;color:#f97316;">
                            ${otp}
                          </span>
                        </td>
                      </tr>
                    </table>

                    <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
                      If you didn't request this, you can safely ignore this email.
                      <br/>Never share this code with anyone.
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding:16px 40px;border-top:1px solid #f3f4f6;">
                    <p style="margin:0;font-size:12px;color:#d1d5db;text-align:center;">
                      © ${new Date().getFullYear()} CampusDeals · All rights reserved
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  const { data, error } = await resend.emails.send({
    // Use "onboarding@resend.dev" while testing (no domain verification needed).
    // Once you verify your own domain on resend.com, switch this to
    // something like "CampusDeals <noreply@yourdomain.com>".
    from: "CampusDeals <onboarding@resend.dev>",
    to,
    subject,
    html,
    text: `Your CampusDeals OTP is: ${otp}\nValid for 5 minutes.`,
  });

  if (error) {
    console.error("❌ Resend failed to send email:", error);
    throw new Error(error.message || "Failed to send email");
  }

  return data;
};

module.exports = sendEmail;