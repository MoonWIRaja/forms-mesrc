# Production Email Template: Supabase Auth Magic Link & OTP

Untuk memastikan e-mel kod pengesahan (OTP) kelihatan **sangat cantik, profesional, dan eksklusif** (bukan e-mel teks kosong), salin templat HTML di bawah ke dalam tetapan Supabase Dashboard anda:

1. Buka [Supabase Dashboard &rarr; Authentication &rarr; Email Templates](https://supabase.com/dashboard/project/uvjwepsawrbrhpywabdu/auth/templates).
2. Pilih tab **Magic Link / Confirmation / OTP**.
3. Tukar subjek kepada: `Your Forms MESRC Security Code: {{ .Token }}`
4. Tampal kod HTML di bawah ke dalam bahagian **Body**:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Security Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Inter', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #f3f4f6;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0b0f19; padding: 40px 10px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; background-color: #111827; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);">
          <!-- Top Accent Bar -->
          <tr>
            <td height="4" style="background: linear-gradient(90deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%); font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>
          
          <!-- Header with Logo / Brand Name -->
          <tr>
            <td style="padding: 36px 40px 20px 40px; text-align: left;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <span style="font-size: 20px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff;">Forms MESRC</span>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; padding: 4px 10px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; border-radius: 999px; background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3);">Secure Auth</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 10px 40px 30px 40px;">
              <h1 style="margin: 0 0 12px 0; font-size: 24px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">Verification Passcode</h1>
              <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #94a3b8;">
                Use the following one-time passcode (OTP) to securely access your account or complete your setup process:
              </p>

              <!-- OTP Code Display Box -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #1e293b; border: 1px dashed #3b82f6; border-radius: 12px; margin: 0 0 24px 0;">
                <tr>
                  <td style="padding: 24px; text-align: center;">
                    <span style="font-family: 'SF Mono', Monaco, Consolas, 'Courier New', monospace; font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #60a5fa; display: inline-block; margin-left: 10px;">
                      {{ .Token }}
                    </span>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 20px 0; font-size: 13px; line-height: 1.5; color: #64748b;">
                <strong>Security note:</strong> This code is valid for 10 minutes and can only be used once. Never share this code with anyone. Forms MESRC administrators will never ask for your code.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #0b0f19; border-top: 1px solid rgba(255, 255, 255, 0.05); text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #475569;">
                &copy; Forms MESRC. All rights reserved. Automated security notification.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```
