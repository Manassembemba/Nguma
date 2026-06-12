import { EmailTemplate, EmailParams, TemplateHelpers, TemplateData } from '../../types.ts';
import { StatusBadge } from '../../components/StatusBadge.ts';
import { InfoCard } from '../../components/InfoCard.ts';
import { BaseLayout } from '../../layouts/baseLayout.ts';

const renderKycApproved = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
  const { siteUrl } = helpers;
  const { name } = params;

  const subject = `Félicitations ! Votre identité a été vérifiée`;
  const previewText = `Votre vérification KYC sur Nguma a été approuvée avec succès.`;

  const content = `
    ${StatusBadge('success', 'Identité Vérifiée')}
    <h2>Vérification KYC Approuvée</h2>
    <p class="lead" style="font-size: 16px; line-height: 1.5; color: #4B5563;">
      Bonjour <strong>${name}</strong>,<br><br>
      Nous avons le plaisir de vous informer que votre vérification d'identité (KYC) a été validée par notre équipe de conformité.
    </p>
    
    ${InfoCard(`
      <p style="margin:0; text-align:center; font-weight:bold; color: #059669;">
        ✅ Votre compte est désormais pleinement opérationnel pour toutes les transactions.
      </p>
    `, 'success')}
    
    <p>Vous pouvez maintenant effectuer des retraits et souscrire à de nouveaux contrats sans restrictions liées à l'identité.</p>
    
    <div class="cta-buttons">
      <a href="${siteUrl}/dashboard" class="btn btn-primary">Accéder à mon tableau de bord</a>
    </div>
  `;
  const html = BaseLayout(content, previewText, siteUrl);
  return {
    subject,
    previewText,
    text: `Bonjour ${name}, votre vérification d'identité KYC a été approuvée sur Nguma.`,
    html
  };
};

const renderKycRejected = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
  const { siteUrl, escapeHtml } = helpers;
  const { name, reason } = params;

  const subject = `Information importante concernant votre vérification d'identité`;
  const previewText = `Votre demande de vérification KYC n'a pas pu être validée.`;

  const content = `
    ${StatusBadge('error', 'Vérification Refusée')}
    <h2>Mise à jour de votre KYC</h2>
    <p class="lead" style="font-size: 16px; line-height: 1.5; color: #4B5563;">
      Bonjour <strong>${name}</strong>,<br><br>
      Après examen de vos documents, nous ne sommes pas en mesure de valider votre vérification d'identité pour la raison suivante :
    </p>
    
    ${InfoCard(`
      <p style="margin:0; font-weight:bold; color: #DC2626;">
        Raison du refus : ${escapeHtml(reason || 'Document illisible ou non conforme.')}
      </p>
    `, 'error')}
    
    <p>Ne vous inquiétez pas, vous pouvez soumettre à nouveau vos documents en suivant nos recommandations (photo claire, document en cours de validité).</p>
    
    <div class="cta-buttons">
      <a href="${siteUrl}/profile" class="btn btn-primary">Soumettre à nouveau</a>
    </div>
  `;
  const html = BaseLayout(content, previewText, siteUrl);
  return {
    subject,
    previewText,
    text: `Bonjour ${name}, votre vérification d'identité KYC a été refusée. Raison : ${reason}.`,
    html
  };
};

export const kycApprovedTemplate: EmailTemplate = {
  id: 'kyc_approved',
  category: 'security',
  requiredFields: ['to', 'name'],
  render: renderKycApproved
};

export const kycRejectedTemplate: EmailTemplate = {
  id: 'kyc_rejected',
  category: 'security',
  requiredFields: ['to', 'name', 'reason'],
  render: renderKycRejected
};
