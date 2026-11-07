# Production Email Template: Neo-Brutalist 3D Paper Journal & Voxel Style

Templat e-mel OTP ini direka khas mengikut gaya **Neo-Brutalist 3D Paper Journal** (kertas buku nota berkotak, bayang-bayang hitam tebal `6px 6px 0px #18181b`, warna kuning highlighter `#facc15`, dan fon kod blok bergaya Minecraft/Voxel).

### Cara Pasang di Supabase Dashboard:
1. Buka [Supabase Dashboard &rarr; Authentication &rarr; Email Templates](https://supabase.com/dashboard/project/uvjwepsawrbrhpywabdu/auth/templates).
2. Pilih tab **Magic Link / Confirmation / OTP**.
3. Tukar **Subject** kepada: `[Forms MESRC] Your Passcode: {{ .Token }}`
4. Salin dan tampal kod HTML di bawah ke dalam bahagian **Body**:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Forms MESRC Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #ebe4d5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #18181b;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ebe4d5; padding: 40px 14px;">
    <tr>
      <td align="center">
        <!-- 3D Paper Journal Card with Hard Brutalist Shadow -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 540px; background-color: #fffdf7; border: 4px solid #18181b; border-radius: 12px; box-shadow: 8px 8px 0px #18181b; overflow: hidden;">
          
          <!-- Top Yellow & Green Block Header -->
          <tr>
            <td style="background-color: #facc15; border-bottom: 4px solid #18181b; padding: 18px 28px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <span style="font-size: 20px; font-weight: 900; letter-spacing: -0.5px; text-transform: uppercase; color: #18181b;">
                      [FORMS MESRC] // JOURNAL
                    </span>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; padding: 4px 10px; background-color: #4ade80; border: 2px solid #18181b; border-radius: 4px; font-size: 11px; font-weight: 900; text-transform: uppercase; color: #18181b; box-shadow: 2px 2px 0px #18181b;">
                      OTP AUTH
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Notebook Content Area -->
          <tr>
            <td style="padding: 32px 28px;">
              <div style="display: inline-block; padding: 3px 8px; background-color: #38bdf8; border: 2px solid #18181b; font-size: 11px; font-weight: 900; text-transform: uppercase; margin-bottom: 12px; box-shadow: 2px 2px 0px #18181b;">
                SECURITY STAMP // ONE-TIME PASSCODE
              </div>

              <h1 style="margin: 0 0 12px 0; font-size: 26px; font-weight: 900; color: #18181b; letter-spacing: -0.5px;">
                Unlock Your Workspace
              </h1>

              <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; font-weight: 600; color: #3f3f46;">
                Enter the 6-digit verification block code below into your open Forms MESRC journal page to verify your email and sign in:
              </p>

              <!-- Tactile Chunky OTP Code Box -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #fef08a; border: 4px solid #18181b; border-radius: 8px; box-shadow: 6px 6px 0px #18181b; margin: 0 0 28px 0;">
                <tr>
                  <td style="padding: 24px 16px; text-align: center;">
                    <div style="font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #18181b; margin-bottom: 6px;">
                      VERIFICATION CODE
                    </div>
                    <span style="font-family: 'Courier New', Consolas, Monaco, monospace; font-size: 40px; font-weight: 900; letter-spacing: 10px; color: #18181b; display: inline-block; background-color: #ffffff; padding: 10px 18px; border: 3px solid #18181b; box-shadow: 3px 3px 0px #18181b;">
                      {{ .Token }}
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Sticky Note Security Warning -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f7f2e4; border: 2px dashed #18181b; border-radius: 6px;">
                <tr>
                  <td style="padding: 14px 16px; font-size: 13px; line-height: 1.5; font-weight: 600; color: #3f3f46;">
                    <strong>NOTE:</strong> This code expires in 10 minutes and works only once. If you did not request this code, you can safely ignore this message.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer Bar -->
          <tr>
            <td style="padding: 16px 28px; background-color: #f7f2e4; border-top: 4px solid #18181b; text-align: center;">
              <p style="margin: 0; font-size: 12px; font-weight: 800; color: #52525b; text-transform: uppercase;">
                FORMS MESRC &bull; INVITE-ONLY COMPANY WORKSPACE
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
