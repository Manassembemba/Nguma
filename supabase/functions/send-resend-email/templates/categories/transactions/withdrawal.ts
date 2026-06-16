import { EmailTemplate, EmailParams, TemplateHelpers, TemplateData } from '../../types.ts';
import { StatusBadge } from '../../components/StatusBadge.ts';
import { InfoCard } from '../../components/InfoCard.ts';
import { BaseLayout } from '../../layouts/baseLayout.ts';

const renderWithdrawalApproved = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
  const { formatCurrency, siteUrl } = helpers;
  const { name, amount } = params;

  const subject = `Validation de votre transfert sortant`;
  const previewText = `Le retrait de ${formatCurrency(amount)} a été approuvé.`;

  const content = `
    ${StatusBadge('success', 'Transfert validé')}
    <h2>Opération confirmée</h2>
    <p class="lead" style="font-size: 16px; line-height: 1.5; color: #4B5563;">
      Votre demande de retrait a été validée par nos services financiers. Les fonds sont en route vers votre compte de destination.
    </p>
    ${InfoCard(`
      <table class="info-table">
        <tr><td>Montant retiré :</td><td class="amount-success">${formatCurrency(amount)}</td></tr>
        <tr><td>Statut :</td><td>Envoyé</td></tr>
      </table>
    `)}
  `;
  const html = BaseLayout(content, previewText, siteUrl);
  return {
    subject,
    previewText,
    text: `Bonjour ${name}, votre retrait est validé.`,
    html
  };
};

const renderWithdrawalRejected = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
  const { formatCurrency, escapeHtml, siteUrl } = helpers;
  const { name, amount, reason } = params;

  const subject = `Information sur votre demande de retrait`;
  const previewText = `Impossible de traiter le retrait de ${formatCurrency(amount)}.`;

  const content = `
    ${StatusBadge('error', 'Transfert annulé')}
    <p class="lead" style="font-size: 16px; line-height: 1.5; color: #4B5563;">
      Votre demande de retrait n'a pas pu être finalisée. Aucun montant n'a été débité de votre solde.
    </p>
    ${InfoCard(`
      <table class="info-table" style="width: 100%; table-layout: fixed;">
        <tr>
          <td style="width: 35%; vertical-align: top;">Montant :</td>
          <td style="width: 65%; vertical-align: top;" class="amount-success">${formatCurrency(amount)}</td>
        </tr>
        <tr>
          <td style="width: 35%; vertical-align: top;">Raison :</td>
          <td style="width: 65%; vertical-align: top; word-wrap: break-word;" class="rejection-reason">${escapeHtml(reason || "Données incorrectes")}</td>
        </tr>
      </table>
    `, 'error')}
  `;
  const html = BaseLayout(content, previewText, siteUrl);
  return {
    subject,
    previewText,
    text: `Bonjour ${name}, votre retrait n'a pas pu être traité.`,
    html
  };
};

const renderWithdrawalPending = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
  const { formatCurrency, siteUrl } = helpers;
  const { name, amount } = params;

  const subject = `Demande de retrait enregistrée`;
  const previewText = `Confirmation de votre demande de ${formatCurrency(amount)}.`;

  const content = `
    ${StatusBadge('info', 'Vérification en cours')}
    <h2>Demande enregistrée</h2>
    <p style="font-size: 15px; line-height: 1.6; color: #374151;">
      Bonjour <strong>${name}</strong>,<br><br>
      Votre demande de retrait a bien été reçue !
    </p>

    ${InfoCard(`
      <table class="info-table">
        <tr><td>Montant :</td><td class="amount-highlight">${formatCurrency(amount)}</td></tr>
      </table>
    `)}

    <p style="font-size: 15px; line-height: 1.6; color: #374151; margin-top: 20px;">
      Notre délai standard de traitement est de <strong>5 jours ouvrables</strong>. Toutefois, face à un grand nombre de demandes simultanées, ce délai peut parfois être prolongé jusqu'à <strong>60 jours</strong>.
    </p>

    <p style="font-size: 15px; line-height: 1.6; color: #374151; margin-top: 20px;">
      Chaque demande compte énormément pour nous, et nous vous remercions sincèrement pour votre patience et votre confiance pendant que nous finalisons la vôtre. Le plus important est en marche : votre patience sera bientôt récompensée !
    </p>

    <p style="font-size: 15px; line-height: 1.6; color: #374151; margin-top: 20px;">
      Un e-mail de confirmation vous sera envoyé dès que le virement sera validé.
    </p>
  `;
  const html = BaseLayout(content, previewText, siteUrl);
  return {
    subject,
    previewText,
    text: `Bonjour ${name}, votre demande de retrait de ${formatCurrency(amount)} a bien été reçue. Elle est en cours de traitement (délai standard 5 jours, pouvant aller jusqu'à 60 jours en cas de forte affluence). Merci de votre patience.`,
    html
  };
};

const renderWithdrawalApprovedWithProof = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
  const { formatCurrency, escapeHtml, formatDate, siteUrl } = helpers;
  const { name, amount, proof_url, method, date } = params;

  const subject = `Confirmation de transfert - ${formatCurrency(amount)}`;
  const previewText = `Votre retrait a été transféré. Preuve jointe.`;

  const content = `
    ${StatusBadge('success', 'Transfert Effectué ✅')}
    <h2>Opération Confirmée</h2>
    <p class="lead" style="font-size: 16px; line-height: 1.5; color: #4B5563;">
      Votre demande de retrait a été approuvée et transférée vers votre compte. Vous trouverez ci-dessous la preuve officielle du transfert.
    </p>
    
    ${InfoCard(`
      <h3 style="margin-top:0;">📋 Détails du Transfert</h3>
      <table class="info-table" style="width: 100%; table-layout: fixed;">
        <tr>
          <td style="width: 35%; vertical-align: top;">Méthode :</td>
          <td style="width: 65%; vertical-align: top;"><strong>${escapeHtml(method || 'N/A')}</strong></td>
        </tr>
        <tr>
          <td style="width: 35%; vertical-align: top;">Montant net :</td>
          <td style="width: 65%; vertical-align: top;" class="amount-success">${formatCurrency(amount)}</td>
        </tr>
        <tr>
          <td style="width: 35%; vertical-align: top;">Date :</td>
          <td style="width: 65%; vertical-align: top;">${date || formatDate()}</td>
        </tr>
        <tr>
          <td style="width: 35%; vertical-align: top;">Statut :</td>
          <td style="width: 65%; vertical-align: top; color:#059669;">✓ Envoyé</td>
        </tr>
      </table>
    `, 'success')}

    <div class="info-card" style="margin-top: 30px; background: #F0FDF4; border-color: #BBF7D0;">
      <h3 style="margin-top:0; color: #059669;">📑 Preuve de Transfert</h3>
      <p>Voici la confirmation officielle de votre transfert :</p>
      <div style="text-align: center; margin: 20px 0; background: white; padding: 15px; border-radius: 8px;">
        <img src="${proof_url}" alt="Preuve de transfert" 
             style="max-width: 100%; height: auto; border-radius: 8px; border: 2px solid #D1FAE5; box-shadow: 0 4px 6px rgba(0,0,0,0.1);" />
      </div>
      <div class="cta-buttons">
        <a href="${proof_url}" download class="btn btn-primary" style="background-color: #059669;">
          📥 Télécharger la preuve
        </a>
      </div>
      <p style="font-size: 12px; color: #059669; margin-top: 15px; text-align: center;">
        💡 Conservez cette preuve pour vos archives personnelles.
      </p>
    </div>
    
    <div class="cta-buttons" style="margin-top: 30px;">
      <a href="${siteUrl}/wallet" class="btn btn-primary">Voir mon historique</a>
    </div>
  `;
  const html = BaseLayout(content, previewText, siteUrl);
  return {
    subject,
    previewText,
    text: `Bonjour ${name}, votre retrait de ${formatCurrency(amount)} a été transféré. Preuve disponible : ${proof_url}`,
    html
  };
};

export const withdrawalApprovedTemplate: EmailTemplate = {
  id: 'withdrawal_approved',
  category: 'transaction',
  requiredFields: ['to', 'name', 'amount'],
  render: renderWithdrawalApproved
};

export const withdrawalRejectedTemplate: EmailTemplate = {
  id: 'withdrawal_rejected',
  category: 'transaction',
  requiredFields: ['to', 'name', 'amount'],
  render: renderWithdrawalRejected
};

export const withdrawalPendingTemplate: EmailTemplate = {
  id: 'withdrawal_pending',
  category: 'transaction',
  requiredFields: ['to', 'name', 'amount'],
  render: renderWithdrawalPending
};

export const withdrawalApprovedWithProofTemplate: EmailTemplate = {
  id: 'withdrawal_approved_with_proof',
  category: 'transaction',
  requiredFields: ['to', 'name', 'amount', 'proof_url'],
  render: renderWithdrawalApprovedWithProof
};
