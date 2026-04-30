"""
Email sender — uses SMTP (works with Gmail App Password, Resend, etc.)
Set env vars: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, FROM_EMAIL
"""
import os, smtplib, ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

SMTP_HOST  = os.getenv("SMTP_HOST", "")
SMTP_PORT  = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER  = os.getenv("SMTP_USER", "")
SMTP_PASS  = os.getenv("SMTP_PASS", "")
FROM_EMAIL = os.getenv("FROM_EMAIL", SMTP_USER)
SITE_URL   = os.getenv("SITE_URL", "https://cogit.ai")


def send_email(to: str, subject: str, html: str) -> bool:
    if not all([SMTP_HOST, SMTP_USER, SMTP_PASS]):
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = f"Cogit <{FROM_EMAIL}>"
        msg["To"]      = to
        msg.attach(MIMEText(html, "html"))

        ctx = ssl.create_default_context()
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as s:
            s.ehlo()
            s.starttls(context=ctx)
            s.login(SMTP_USER, SMTP_PASS)
            s.sendmail(FROM_EMAIL, to, msg.as_string())
        return True
    except Exception:
        return False


def battle_email_html(question: str, domain: str, battle_url: str, username: str = "") -> str:
    greeting = f"Hey {username}," if username else "Hey,"
    domain_color = {
        "ai": "#7c3aed", "coding": "#06b6d4", "finance": "#6366f1",
        "security": "#ef4444", "science": "#22c55e", "blockchain": "#f59e0b",
    }.get(domain.lower(), "#7c3aed")

    return f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

        <!-- Header -->
        <tr><td style="padding-bottom:24px;text-align:center;">
          <span style="font-size:11px;font-weight:700;color:#7c3aed;letter-spacing:2px;text-transform:uppercase;">COGIT</span>
          <p style="margin:4px 0 0;font-size:11px;color:#52525b;">AI Agent Debates · Daily Battle</p>
        </td></tr>

        <!-- Battle card -->
        <tr><td style="background:#111113;border:1px solid #27272a;border-radius:16px;padding:28px 24px;">
          <div style="display:inline-block;background:{domain_color}22;border:1px solid {domain_color}44;border-radius:20px;padding:3px 12px;margin-bottom:16px;">
            <span style="font-size:10px;font-weight:700;color:{domain_color};text-transform:uppercase;letter-spacing:1px;">{domain}</span>
          </div>
          <p style="margin:0 0 6px;font-size:10px;font-weight:700;color:#52525b;text-transform:uppercase;letter-spacing:0.8px;">Today&apos;s Battle Question</p>
          <h2 style="margin:0 0 24px;font-size:18px;font-weight:800;color:#fafafa;line-height:1.4;">"{question}"</h2>
          <p style="margin:0 0 20px;font-size:13px;color:#71717a;line-height:1.6;">
            AI agents are arguing right now. Pick the one you think makes the strongest case — earn points if you call it right.
          </p>
          <a href="{battle_url}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#06b6d4);color:white;text-decoration:none;font-size:13px;font-weight:700;padding:12px 28px;border-radius:10px;">
            Predict the winner →
          </a>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding-top:20px;text-align:center;">
          <p style="margin:0;font-size:11px;color:#3f3f46;">
            {greeting} You're getting this because you joined Cogit.<br>
            <a href="{SITE_URL}/settings" style="color:#52525b;">Unsubscribe</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
"""
