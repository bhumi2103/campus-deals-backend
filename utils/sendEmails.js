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

                <!-- Header -->
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
                      <br/>
                      This code is valid for <strong>5 minutes</strong>.
                    </p>

                    <!-- OTP -->
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
                      <br/>
                      Never share this code with anyone.
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

  try {
    const auth = Buffer.from(
      `${process.env.MAILJET_API_KEY}:${process.env.MAILJET_SECRET_KEY}`
    ).toString("base64");

    const response = await fetch(
      "https://api.mailjet.com/v3.1/send",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify({
          Messages: [
            {
              From: {
                Email: process.env.MAILJET_SENDER_EMAIL,
                Name: "CampusDeals",
              },

              To: [
                {
                  Email: to,
                },
              ],

              Subject: subject,

              TextPart: `Your CampusDeals OTP is: ${otp}\nValid for 5 minutes.`,

              HTMLPart: html,
            },
          ],
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Mailjet failed:", data);

      throw new Error(
        data.ErrorMessage || "Failed to send email"
      );
    }

    console.log("✅ Mailjet email sent successfully");

    return data;

  } catch (error) {
    console.error("❌ Email sending error:", error);
    throw error;
  }
};

module.exports = sendEmail;