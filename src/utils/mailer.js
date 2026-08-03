// mailer.js
// Sends notification emails. Every call is fire-and-forget: a mail failure must
// never fail the request that triggered it, because nobody should be unable to
// reserve a listing just because an SMTP host is down.

const nodemailer = require('nodemailer');
const model = require('../models/Notification.model');

// Built lazily and cached. Creating it at require time would make the whole app
// fail to boot when SMTP is not configured — which is the normal case in tests.
let transport = null;

function isConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransport() {
  if (transport) return transport;

  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    // Port 465 is implicit TLS; 587 upgrades via STARTTLS after connecting.
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transport;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildHtml(username, title, message) {
  const appUrl = process.env.APP_URL || '';
  const link = appUrl ? `${appUrl}/html/notifications.html` : '';

  return `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px">
      <p style="color:#666;font-size:14px;margin:0 0 16px">Hi ${escapeHtml(username)},</p>
      <h2 style="margin:0 0 8px;font-size:18px;color:#111">${escapeHtml(title)}</h2>
      <p style="margin:0 0 20px;font-size:15px;color:#333;line-height:1.5">${escapeHtml(message)}</p>
      ${
        link
          ? `<a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 18px;background:#111;color:#fff;text-decoration:none;border-radius:6px;font-size:14px">View in GitMart</a>`
          : ''
      }
      <p style="color:#999;font-size:12px;margin:24px 0 0;border-top:1px solid #eee;padding-top:16px">
        You are receiving this because email notifications are on for your GitMart account.
        You can turn them off in Settings.
      </p>
    </div>
  `;
}

function onMailError(error) {
  // Logged, never rethrown — see the file header.
  console.error('Failed to send notification email:', error.message);
}

module.exports.isConfigured = isConfigured;

module.exports.sendNotificationEmail = (userId, title, message) => {
  // Checked before the database lookup so an unconfigured environment costs
  // nothing at all — no query, no connection.
  if (!isConfigured() || !userId) return;

  const callback = (error, result) => {
    if (error) {
      console.error(error);
      return;
    }
    if (result.rows.length === 0) return;

    const user = result.rows[0];

    // Respect the per-user preference.
    if (!user.notify_email || !user.email) return;

    getTransport()
      .sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: user.email,
        subject: title,
        text: `Hi ${user.username},\n\n${title}\n\n${message}\n\n— GitMart`,
        html: buildHtml(user.username, title, message),
      })
      .catch(onMailError);
  };

  model.getEmailRecipient({ userId }, callback);
};

// Exposed for tests so the cached transport can be dropped between cases.
module.exports._resetTransport = () => {
  transport = null;
};
