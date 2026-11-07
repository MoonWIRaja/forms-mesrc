# Production Email Template: Refined Paper Journal OTP

Templat e-mel OTP ini menggunakan palet kertas jurnal hangat yang bersih (`#f3efe6`, `#faf8f5`) dengan sempadan dakwat hitam (`#1c1917`), tanpa warna neon yang keterlaluan.

### Cara Pasang di Supabase Dashboard:
1. Buka [Supabase Dashboard &rarr; Authentication &rarr; Email Templates](https://supabase.com/dashboard/project/uvjwepsawrbrhpywabdu/auth/templates).
2. Pilih tab **Magic Link / Confirmation / OTP**.
3. Tukar **Subject** kepada: `Forms MESRC Verification Code: {{ slice .Token 0 4 }}`
4. Salin dan tampal kod HTML di bawah ke dalam bahagian **Body**:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3efe6; font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1c1917;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f3efe6; padding: 40px 14px;">
    <tr>
      <td align="center">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 500px; background-color: #faf8f5; border: 2px solid #1c1917; border-radius: 6px; box-shadow: 5px 5px 0px #1c1917; overflow: hidden;">
          
          <tr>
            <td style="background-color: #efeae0; border-bottom: 2px solid #1c1917; padding: 16px 28px;">
              <strong style="font-size: 16px; font-weight: 800; letter-spacing: -0.3px; color: #1c1917;">
                Forms MESRC
              </strong>
            </td>
          </tr>

          <tr>
            <td style="padding: 28px;">
              <h1 style="margin: 0 0 10px 0; font-size: 22px; font-weight: 800; color: #1c1917; letter-spacing: -0.4px;">
                Verification Passcode
              </h1>

              <p style="margin: 0 0 22px 0; font-size: 15px; line-height: 1.6; color: #57534e;">
                Enter the 4-digit verification code below to sign in or complete your setup:
              </p>

              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff; border: 2px solid #1c1917; border-radius: 4px; box-shadow: 3px 3px 0px #1c1917; margin: 0 0 22px 0;">
                <tr>
                  <td style="padding: 20px; text-align: center;">
                    <span style="font-family: 'SF Mono', Consolas, Monaco, monospace; font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #1c1917;">
                      {{ slice .Token 0 4 }}
                    </span>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #57534e;">
                This 4-digit code expires in 10 minutes and can only be used once. If you did not request this code, you can ignore this email.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding: 14px 28px; background-color: #efeae0; border-top: 2px solid #1c1917; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #57534e;">
                Forms MESRC &bull; Invite-Only Workspace
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
