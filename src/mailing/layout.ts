export const APP_NAME = 'Urnik VSŠ ŠC Kranj';

const font = "'Helvetica Neue', Helvetica, Arial, sans-serif";

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function renderMail(opts: {
  title: string;
  content: string;
  unsubscribeLink: string | null;
}): string {
  const optOut = opts.unsubscribeLink
    ? `Ne želite več prejemati teh obvestil? <a href="${opts.unsubscribeLink}" style="color:#9A8CFF;">Odjava</a>.`
    : `Kopija za administratorja. Prejemanje izklopite z odstranitvijo ADMIN_MAIL iz konfiguracije.`;

  return `<!DOCTYPE html>
<html lang="sl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#1E2027;">
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#1E2027;">
  <tr><td align="center" style="padding:24px 12px;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;">
      <tr><td style="padding:0 0 16px 0;font-family:${font};font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#9A8CFF;">${APP_NAME}</td></tr>
      <tr><td style="background-color:#2C2F3A;padding:32px 28px;border-radius:8px;font-family:${font};font-size:16px;line-height:24px;color:#EAEAEA;">
        <h1 style="margin:0 0 20px 0;font-size:24px;line-height:30px;font-weight:800;color:#FFFFFF;">${escapeHtml(opts.title)}</h1>
        ${opts.content}
      </td></tr>
      <tr><td align="center" style="padding:24px 10px;font-family:${font};font-size:12px;line-height:18px;color:#888888;">
        <p style="margin:0;">${optOut}</p>
        <p style="margin:6px 0 0 0;">${APP_NAME}</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/** Wraps compareTimetables* output in a bordered box. */
export const changesBox = (html: string) =>
  `<div style="border:1px solid #4A4E5A;border-radius:6px;background-color:#1E2027;padding:4px 16px;">${html}</div>`;

export const unsubscribeLink = (hash: string) =>
  `${process.env.API_DOMAIN}/mailing/remove?email=${encodeURIComponent(hash)}`;
