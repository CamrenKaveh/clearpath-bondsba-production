import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import { Resend } from 'resend';
import type { ApplicationPipelineStatus, PipelineEmailTemplateInput } from './types';

const STATUS_VALUES = new Set<ApplicationPipelineStatus>(['Draft', 'Under Review', 'Approved', 'Action Required', 'Declined']);

function isPipelineStatus(value: unknown): value is ApplicationPipelineStatus {
  return typeof value === 'string' && STATUS_VALUES.has(value as ApplicationPipelineStatus);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function renderStatusEmail(input: PipelineEmailTemplateInput): string {
  const statusColor = input.nextStatus === 'Approved' ? '#16a34a' : input.nextStatus === 'Action Required' ? '#d97706' : input.nextStatus === 'Declined' ? '#dc2626' : '#2563eb';

  return `<!doctype html>
<html>
  <body style="margin:0;background:#020617;color:#e5e7eb;font-family:Inter,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#020617;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="width:640px;max-width:calc(100% - 32px);border:1px solid #334155;background:#0f172a;">
            <tr>
              <td style="padding:28px 28px 18px;border-bottom:1px solid #334155;">
                <p style="margin:0 0 8px;color:#94a3b8;font:700 11px 'IBM Plex Mono','Courier New',monospace;letter-spacing:.12em;text-transform:uppercase;">BondSBA Pipeline Delta</p>
                <h1 style="margin:0;color:#f8fafc;font-size:24px;line-height:1.2;">${escapeHtml(input.borrowerName)} status changed</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                  <tr>
                    <td style="padding:14px;border:1px solid #334155;color:#94a3b8;font:700 12px 'IBM Plex Mono','Courier New',monospace;">Previous</td>
                    <td style="padding:14px;border:1px solid #334155;color:#e5e7eb;font:700 12px 'IBM Plex Mono','Courier New',monospace;">${escapeHtml(input.previousStatus)}</td>
                  </tr>
                  <tr>
                    <td style="padding:14px;border:1px solid #334155;color:#94a3b8;font:700 12px 'IBM Plex Mono','Courier New',monospace;">Current</td>
                    <td style="padding:14px;border:1px solid #334155;color:${statusColor};font:800 12px 'IBM Plex Mono','Courier New',monospace;">${escapeHtml(input.nextStatus)}</td>
                  </tr>
                </table>
                <p style="margin:22px 0;color:#cbd5e1;line-height:1.7;">The application pipeline state changed in BondSBA. Open the secure dashboard to review the latest underwriting record, audit traces, and required stakeholder actions.</p>
                <a href="${escapeHtml(input.dashboardUrl)}" style="display:inline-block;background:#e5e7eb;color:#020617;text-decoration:none;font-weight:800;padding:13px 18px;border-radius:6px;">Open dashboard</a>
                <p style="margin:24px 0 0;color:#64748b;font:600 11px 'IBM Plex Mono','Courier New',monospace;">Application ID: ${escapeHtml(input.applicationId)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export const sendPipelineStatusEmail = onDocumentUpdated(
  { document: 'applications/{applicationId}', region: 'us-central1' },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    const previousStatus = before.status;
    const nextStatus = after.status;
    if (!isPipelineStatus(previousStatus) || !isPipelineStatus(nextStatus) || previousStatus === nextStatus) return;

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      logger.error('RESEND_API_KEY is not configured; pipeline email skipped.', { applicationId: event.params.applicationId });
      return;
    }

    const recipients = Array.isArray(after.stakeholderEmails) ? after.stakeholderEmails.map(String).filter(Boolean) : [];
    if (recipients.length === 0) return;

    const dashboardBaseUrl = process.env.DASHBOARD_BASE_URL ?? 'https://bondsba.com';
    const applicationId = String(event.params.applicationId);
    const borrowerName = String(after.borrowerName ?? 'Borrower file');
    const dashboardUrl = `${dashboardBaseUrl.replace(/\/$/, '')}/dashboard/applications/${encodeURIComponent(applicationId)}`;
    const resend = new Resend(apiKey);

    await resend.emails.send({
      from: process.env.PIPELINE_EMAIL_FROM ?? 'BondSBA Pipeline <pipeline@bondsba.com>',
      to: recipients,
      subject: `BondSBA status update: ${borrowerName} is ${nextStatus}`,
      html: renderStatusEmail({ applicationId, borrowerName, previousStatus, nextStatus, dashboardUrl }),
    });
  },
);
