import { EmailTemplate, EmailParams, TemplateHelpers, TemplateData } from '../../types.ts';
import { StatusBadge } from '../../components/StatusBadge.ts';
import { InfoCard } from '../../components/InfoCard.ts';
import { BaseLayout } from '../../layouts/baseLayout.ts';

const renderAdminActionLog = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
  const { escapeHtml, formatDate, formatCurrency, siteUrl } = helpers;
  const { 
    adminName, 
    actionType, 
    targetUserName, 
    amount, 
    reason, 
    details,
    ipAddress,
    location
  } = params as any;

  const isCritical = actionType?.toLowerCase().includes('critique') || actionType?.toLowerCase().includes('delete') || actionType?.toLowerCase().includes('update');
  const badgeType = isCritical ? 'error' : 'info';
  const badgeLabel = isCritical ? 'Action Critique Admin' : 'Log Activité Admin';

  const subject = `[LOG ADMIN] ${isCritical ? 'CRITIQUE : ' : ''}${actionType} - par ${adminName}`;
  const previewText = `${adminName} a effectué l'action : ${actionType}`;

  const content = `
    ${StatusBadge(badgeType, badgeLabel)}
    <h2 style="color: ${isCritical ? '#991B1B' : '#1F2937'};">Rapport d'action administrative</h2>
    <p style="font-size: 15px; color: #374151;">
      Une action ${isCritical ? '<strong>critique</strong> ' : 'sensible '}a été effectuée sur la plateforme Nguma.
    </p>

    ${InfoCard(`
      <table class="info-table">
        <tr><td>Administrateur :</td><td><strong>${escapeHtml(adminName)}</strong></td></tr>
        <tr><td>Action :</td><td><span style="color:${isCritical ? '#DC2626' : '#4F46E5'}; font-weight:bold;">${escapeHtml(actionType)}</span></td></tr>
        <tr><td>Cible :</td><td>${escapeHtml(targetUserName || 'N/A')}</td></tr>
        ${amount ? `<tr><td>Montant :</td><td>${formatCurrency(amount)}</td></tr>` : ''}
        <tr><td>Date :</td><td>${formatDate()}</td></tr>
        ${ipAddress ? `<tr><td>Adresse IP :</td><td><code style="background:#F3F4F6; padding:2px 4px; border-radius:4px;">${escapeHtml(ipAddress)}</code> ${location ? `(${escapeHtml(location)})` : ''}</td></tr>` : ''}
      </table>
    `, isCritical ? 'error' : 'info')}

    ${details ? `
    <div style="margin-top: 20px; padding: 15px; background: #F3F4F6; border-radius: 8px; border: 1px solid #E5E7EB;">
      <p style="margin:0 0 10px 0; font-weight:bold; color: #374151;">Détails de la modification :</p>
      <div style="font-family: monospace; font-size: 13px; color: #4B5563; white-space: pre-wrap;">${escapeHtml(typeof details === 'object' ? JSON.stringify(details, null, 2) : details)}</div>
    </div>
    ` : ''}

    ${reason ? `
    <div style="margin-top: 20px; padding: 15px; background: #FFFBEB; border-radius: 8px; border-left: 4px solid #F59E0B;">
      <p style="margin:0; font-weight:bold; color: #92400E;">Motif renseigné :</p>
      <p style="margin:5px 0 0 0; color: #B45309; font-style: italic;">"${escapeHtml(reason)}"</p>
    </div>
    ` : ''}

    <div class="cta-buttons" style="margin-top: 30px;">
      <a href="${siteUrl}/admin" class="btn ${isCritical ? 'btn-danger' : 'btn-primary'}">Ouvrir le panel Admin</a>
    </div>

    <p style="font-size: 12px; color: #9CA3AF; margin-top: 30px; text-align: center;">
      Cet email est envoyé automatiquement à tous les administrateurs pour garantir la transparence des actions critiques.
    </p>
  `;

  return {
    subject,
    previewText,
    text: `Log Admin: ${adminName} a effectué ${actionType} sur ${targetUserName}. IP: ${ipAddress || 'N/A'}`,
    html: BaseLayout(content, previewText, siteUrl)
  };
};

export const adminActionLogTemplate: EmailTemplate = {
  id: 'admin_action_log',
  category: 'admin',
  requiredFields: ['to', 'adminName', 'actionType'],
  render: renderAdminActionLog
};
