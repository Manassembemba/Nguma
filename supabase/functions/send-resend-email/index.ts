import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@3.2.0";

// Get secrets from environment variables
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM_DOMAIN = Deno.env.get("RESEND_FROM_DOMAIN");
const SITE_URL = Deno.env.get("SITE_URL") || "https://nguma.org";

// Initialize Resend client
const resend = new Resend(RESEND_API_KEY!);

// Helper: Format currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD' }).format(amount);
};

// Helper: Escape HTML to prevent XSS injection
const escapeHtml = (unsafe: string): string => {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

// --- Email Templates (Simplified for better deliverability) ---
const templates: Record<string, (params: any) => { subject: string; text: string; body: string }> = {
  // FOR USER: Deposit Approved
  deposit_approved: (params: any) => ({
    subject: `Statut de votre dépôt`,
    text: `Bonjour ${params.name},\n\nBonne nouvelle ! Votre dépôt de ${formatCurrency(params.amount)} a été approuvé avec succès.\n\nDÉTAILS DE LA TRANSACTION\nMontant crédité : ${formatCurrency(params.amount)}\nStatus : Approuvé\nDate : ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}\n\nACCÉDER À VOTRE COMPTE\n${SITE_URL}/wallet\n\nCordialement,\nL'équipe Nguma`,
    body: `
      <div class="status-badge success">Dépôt Approuvé</div>
      
      <h2>Félicitations ${escapeHtml(params.name)} !</h2>
      
      <p class="lead">Bonne nouvelle ! Votre dépôt a été approuvé avec succès et les fonds sont maintenant disponibles sur votre compte Nguma.</p>
      
      <div class="info-card">
        <h3>Détails de la transaction</h3>
        <table class="info-table">
          <tr>
            <td><strong>Montant crédité :</strong></td>
            <td class="amount-success">${formatCurrency(params.amount)}</td>
          </tr>
          <tr>
            <td><strong>Status :</strong></td>
            <td><span class="badge badge-success">Approuvé</span></td>
          </tr>
          <tr>
            <td><strong>Date :</strong></td>
            <td>${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
          </tr>
        </table>
      </div>
      
      <div class="cta-buttons">
        <a href="${SITE_URL}/wallet" class="btn btn-primary">Voir Mon Solde</a>
      </div>
    `,
  }),

  // FOR USER: Deposit Rejected
  deposit_rejected: (params: any) => ({
    subject: `Mise à jour concernant votre dépôt`,
    text: `Bonjour ${params.name},\n\nNous avons examiné votre demande de dépôt de ${formatCurrency(params.amount)}, mais malheureusement nous ne pouvons pas la valider pour le moment.\n\nINFORMATIONS SUR LE DÉPÔT\nMontant : ${formatCurrency(params.amount)}\nStatus : Rejeté\nRaison : ${params.reason || "Informations de paiement invalides ou incomplètes"}\n\nACCÉDER À VOTRE COMPTE\n${SITE_URL}/wallet\n\nCordialement,\nL'équipe Nguma`,
    body: `
      <div class="status-badge error">Dépôt Non Validé</div>
      
      <h2>Bonjour ${escapeHtml(params.name)},</h2>
      
      <p class="lead">Nous avons examiné votre demande de dépôt, mais malheureusement nous ne pouvons pas la valider pour le moment.</p>
      
      <div class="info-card error-card">
        <h3>Informations sur le dépôt</h3>
        <table class="info-table">
          <tr>
            <td><strong>Montant :</strong></td>
            <td>${formatCurrency(params.amount)}</td>
          </tr>
          <tr>
            <td><strong>Status :</strong></td>
            <td><span class="badge badge-error">Rejeté</span></td>
          </tr>
          <tr>
            <td><strong>Raison :</strong></td>
            <td class="rejection-reason">${escapeHtml(params.reason || "Informations de paiement invalides ou incomplètes")}</td>
          </tr>
        </table>
      </div>
      
      <p><strong>Besoin d'aide ?</strong> Notre équipe support est là pour vous assister.</p>
      
      <div class="cta-buttons">
        <a href="${SITE_URL}/support" class="btn btn-primary">Contacter le Support</a>
      </div>
    `,
  }),

  // FOR USER: Deposit Pending
  deposit_pending: (params: any) => ({
    subject: `Votre demande de dépôt est en cours de traitement`,
    text: `Bonjour ${params.name},\n\nNous avons bien reçu votre demande de dépôt.\n\nDÉTAILS DE VOTRE DEMANDE\nMontant : ${formatCurrency(params.amount)}\nStatus : En attente de validation\nDate de soumission : ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}\n\nACCÉDER À VOTRE COMPTE\n${SITE_URL}/wallet\n\nCordialement,\nL'équipe Nguma`,
    body: `
      <div class="status-badge info">Demande en Cours</div>
      
      <h2>Bonjour ${escapeHtml(params.name)},</h2>
      
      <p class="lead">Nous avons bien reçu votre demande de dépôt. Notre équipe va la vérifier dans les plus brefs délais.</p>
      
      <div class="info-card">
        <h3>Détails de votre demande</h3>
        <table class="info-table">
          <tr>
            <td><strong>Montant :</strong></td>
            <td class="amount-highlight">${formatCurrency(params.amount)}</td>
          </tr>
          <tr>
            <td><strong>Status :</strong></td>
            <td><span class="badge badge-info">En attente de validation</span></td>
          </tr>
          <tr>
            <td><strong>Délai estimé :</strong></td>
            <td>24-48 heures ouvrées</td>
          </tr>
        </table>
      </div>
      
      <div class="cta-buttons">
        <a href="${SITE_URL}/wallet" class="btn btn-primary">Suivre Ma Demande</a>
      </div>
    `,
  }),

  // FOR ADMIN: New Deposit Request
  new_deposit_request: (params: any) => ({
    subject: `Nouvelle demande de dépôt`,
    text: `NOUVELLE DEMANDE DE DÉPÔT À TRAITER\n\nINFORMATIONS UTILISATEUR\nNom : ${params.name}\nEmail : ${params.email}\nMontant : ${formatCurrency(params.amount)}\nDate de soumission : ${new Date().toLocaleString('fr-FR')}\n\nACCÉDER AU PANNEAU ADMIN\n${SITE_URL}/admin/deposits`,
    body: `
      <div class="status-badge info">Nouvelle Demande</div>
      
      <h2>Nouveau Dépôt à Traiter</h2>
      
      <p class="lead">Un utilisateur a soumis une nouvelle demande de dépôt qui nécessite votre validation.</p>
      
      <div class="info-card">
        <h3>Informations Utilisateur</h3>
        <table class="info-table">
          <tr>
            <td><strong>Nom :</strong></td>
            <td>${escapeHtml(params.name)}</td>
          </tr>
          <tr>
            <td><strong>Email :</strong></td>
            <td>${escapeHtml(params.email)}</td>
          </tr>
          <tr>
            <td><strong>Montant :</strong></td>
            <td class="amount-highlight">${formatCurrency(params.amount)}</td>
          </tr>
          <tr>
            <td><strong>Date de soumission :</strong></td>
            <td>${new Date().toLocaleString('fr-FR')}</td>
          </tr>
        </table>
      </div>
      
      <div class="cta-buttons">
        <a href="${SITE_URL}/admin/deposits" class="btn btn-primary">Voir les Détails</a>
      </div>
    `,
  }),

  // FOR USER: Withdrawal Approved
  withdrawal_approved: (params: any) => ({
    subject: `Confirmation de votre demande de retrait`,
    text: `Bonjour ${params.name},\n\nVotre demande de retrait de ${formatCurrency(params.amount)} a été approuvée.\n\nDÉTAILS DU RETRAIT\nMontant : ${formatCurrency(params.amount)}\nStatus : Approuvé\nDélai estimé : 24-48 heures ouvrées\n\nACCÉDER À VOTRE COMPTE\n${SITE_URL}/wallet\n\nCordialement,\nL'équipe Nguma`,
    body: `
      <div class="status-badge success">Retrait Approuvé</div>
      
      <h2>Excellent ${escapeHtml(params.name)} !</h2>
      
      <p class="lead">Votre demande de retrait a été approuvée et est maintenant en cours de traitement.</p>
      
      <div class="info-card">
        <h3>Détails du Retrait</h3>
        <table class="info-table">
          <tr>
            <td><strong>Montant :</strong></td>
            <td class="amount-success">${formatCurrency(params.amount)}</td>
          </tr>
          <tr>
            <td><strong>Status :</strong></td>
            <td><span class="badge badge-success">Approuvé</span></td>
          </tr>
          <tr>
            <td><strong>Délai estimé :</strong></td>
            <td>24-48 heures ouvrées</td>
          </tr>
        </table>
      </div>
      
      <div class="cta-buttons">
        <a href="${SITE_URL}/wallet" class="btn btn-primary">Suivre Mon Retrait</a>
      </div>
    `,
  }),

  // FOR USER: Withdrawal Rejected
  withdrawal_rejected: (params: any) => ({
    subject: `Mise à jour concernant votre retrait`,
    text: `Bonjour ${params.name},\n\nNous avons examiné votre demande de retrait, mais nous ne pouvons pas la traiter pour le moment.\n\nINFORMATIONS SUR LE RETRAIT\nMontant demandé : ${formatCurrency(params.amount)}\nStatus : Rejeté\nRaison : ${params.reason || "Informations de paiement manquantes ou incorrectes"}\n\nACCÉDER À VOTRE COMPTE\n${SITE_URL}/wallet\n\nCordialement,\nL'équipe Nguma`,
    body: `
      <div class="status-badge error">Retrait Non Validé</div>
      
      <h2>Bonjour ${escapeHtml(params.name)},</h2>
      
      <p class="lead">Nous avons examiné votre demande de retrait, mais nous ne pouvons pas la traiter pour le moment.</p>
      
      <div class="info-card error-card">
        <h3>Informations sur le retrait</h3>
        <table class="info-table">
          <tr>
            <td><strong>Montant demandé :</strong></td>
            <td>${formatCurrency(params.amount)}</td>
          </tr>
          <tr>
            <td><strong>Status :</strong></td>
            <td><span class="badge badge-error">Rejeté</span></td>
          </tr>
          <tr>
            <td><strong>Raison :</strong></td>
            <td class="rejection-reason">${escapeHtml(params.reason || "Informations de paiement manquantes ou incorrectes")}</td>
          </tr>
        </table>
      </div>
      
      <p><strong>Votre solde est intact.</strong> Aucun montant n'a été débité de votre compte.</p>
      
      <div class="cta-buttons">
        <a href="${SITE_URL}/wallet" class="btn btn-primary">Voir Mon Solde</a>
      </div>
    `,
  }),

  // FOR USER: Withdrawal Pending
  withdrawal_pending: (params: any) => ({
    subject: `Votre demande de retrait est en cours de traitement`,
    text: `Bonjour ${params.name},\n\nNous avons bien reçu votre demande de retrait.\n\nDÉTAILS DE VOTRE DEMANDE\nMontant demandé : ${formatCurrency(params.amount)}\nStatus : En attente de validation\nDate de soumission : ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}\n\nACCÉDER À VOTRE COMPTE\n${SITE_URL}/wallet\n\nCordialement,\nL'équipe Nguma`,
    body: `
      <div class="status-badge info">Demande en Cours</div>
      
      <h2>Bonjour ${escapeHtml(params.name)},</h2>
      
      <p class="lead">Nous avons bien reçu votre demande de retrait. Notre équipe va la traiter dans les plus brefs délais.</p>
      
      <div class="info-card">
        <h3>Détails de votre demande</h3>
        <table class="info-table">
          <tr>
            <td><strong>Montant demandé :</strong></td>
            <td class="amount-highlight">${formatCurrency(params.amount)}</td>
          </tr>
          <tr>
            <td><strong>Status :</strong></td>
            <td><span class="badge badge-info">En attente de validation</span></td>
          </tr>
          <tr>
            <td><strong>Délai estimé :</strong></td>
            <td>24-48 heures ouvrées</td>
          </tr>
        </table>
      </div>
      
      <div class="cta-buttons">
        <a href="${SITE_URL}/wallet" class="btn btn-primary">Suivre Mon Retrait</a>
      </div>
    `,
  }),

  // FOR ADMIN: New Withdrawal Request
  new_withdrawal_request: (params: any) => ({
    subject: `Nouvelle demande de retrait`,
    text: `NOUVELLE DEMANDE DE RETRAIT À TRAITER\n\nINFORMATIONS UTILISATEUR\nNom : ${params.name}\nEmail : ${params.email}\nMontant demandé : ${formatCurrency(params.amount)}\nDate de soumission : ${new Date().toLocaleString('fr-FR')}\n\nACCÉDER AU PANNEAU ADMIN\n${SITE_URL}/admin/withdrawals`,
    body: `
      <div class="status-badge info">Nouvelle Demande</div>
      
      <h2>Nouveau Retrait à Traiter</h2>
      
      <p class="lead">Un utilisateur a soumis une demande de retrait qui nécessite votre validation.</p>
      
      <div class="info-card">
        <h3>Informations Utilisateur</h3>
        <table class="info-table">
          <tr>
            <td><strong>Nom :</strong></td>
            <td>${escapeHtml(params.name)}</td>
          </tr>
          <tr>
            <td><strong>Email :</strong></td>
            <td>${escapeHtml(params.email)}</td>
          </tr>
          <tr>
            <td><strong>Montant demandé :</strong></td>
            <td class="amount-highlight">${formatCurrency(params.amount)}</td>
          </tr>
          <tr>
            <td><strong>Date de soumission :</strong></td>
            <td>${new Date().toLocaleString('fr-FR')}</td>
          </tr>
        </table>
      </div>
      
      <div class="cta-buttons">
        <a href="${SITE_URL}/admin/withdrawals" class="btn btn-primary">Voir les Détails</a>
      </div>
    `,
  }),

  // FOR USER: Monthly Profit
  monthly_profit: (params: any) => ({
    subject: `Votre profit mensuel est disponible`,
    text: `Félicitations ${params.name} !\n\nVotre profit mensuel vient d'être versé sur votre compte.\n\nPAIEMENT DE PROFIT\nProfit versé : ${formatCurrency(params.amount)}\nType de paiement : Profit mensuel\nDate : ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}\n\nACCÉDER À VOTRE COMPTE\n${SITE_URL}/wallet\n\nCordialement,\nL'équipe Nguma`,
    body: `
      <div class="status-badge success">Profit Versé</div>
      
      <h2>Félicitations ${escapeHtml(params.name)} !</h2>
      
      <p class="lead">Votre profit mensuel vient d'être versé sur votre compte. Votre investissement continue de générer des revenus.</p>
      
      <div class="info-card success-card">
        <h3>Paiement de Profit</h3>
        <table class="info-table">
          <tr>
            <td><strong>Profit versé :</strong></td>
            <td class="amount-success">${formatCurrency(params.amount)}</td>
          </tr>
          <tr>
            <td><strong>Type de paiement :</strong></td>
            <td>Profit mensuel</td>
          </tr>
          <tr>
            <td><strong>Date :</strong></td>
            <td>${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
          </tr>
        </table>
      </div>
      
      <div class="cta-buttons">
        <a href="${SITE_URL}/wallet" class="btn btn-primary">Voir Mes Profits</a>
      </div>
    `,
  }),

  // FOR USER: New Investment
  new_investment: (params: any) => ({
    subject: `Confirmation de votre investissement`,
    text: `Félicitations ${params.name} !\n\nVous avez franchi une étape importante ! Votre contrat d'investissement est maintenant actif.\n\nRÉCAPITULATIF DE VOTRE CONTRAT\nMontant investi : ${formatCurrency(params.amount)}\nDurée du contrat : 12 mois\nTaux mensuel : 15%\nProfit mensuel estimé : ${formatCurrency(params.amount * 0.15)}\n\nACCÉDER À VOTRE COMPTE\n${SITE_URL}/dashboard\n\nMerci de votre confiance,\nL'équipe Nguma`,
    body: `
      <div class="status-badge success">Investissement Actif</div>
      
      <h2>Félicitations ${escapeHtml(params.name)} !</h2>
      
      <p class="lead">Vous avez franchi une étape importante ! Votre contrat d'investissement est maintenant actif et va commencer à générer des profits mensuels.</p>
      
      <div class="info-card success-card">
        <h3>Récapitulatif de votre contrat</h3>
        <table class="info-table">
          <tr>
            <td><strong>Montant investi :</strong></td>
            <td class="amount-success">${formatCurrency(params.amount)}</td>
          </tr>
          <tr>
            <td><strong>Durée du contrat :</strong></td>
            <td>12 mois</td>
          </tr>
          <tr>
            <td><strong>Taux mensuel :</strong></td>
            <td>15%</td>
          </tr>
          <tr>
            <td><strong>Profit mensuel estimé :</strong></td>
            <td class="amount-highlight">${formatCurrency(params.amount * 0.15)}</td>
          </tr>
        </table>
      </div>
      
      <div class="cta-buttons">
        <a href="${SITE_URL}/dashboard" class="btn btn-primary">Voir Mon Contrat</a>
      </div>
    `,
  }),

  // FOR USER: Withdrawal OTP Code
  withdrawal_otp: (params: any) => ({
    subject: `Code de vérification pour votre retrait`,
    text: `Bonjour ${params.name},\n\nVous avez demandé un retrait de ${formatCurrency(params.amount)}.\n\nCODE DE VÉRIFICATION\nVotre code OTP : ${params.otp_code}\nValide pendant : 10 minutes\n\nSÉCURITÉ\nNe partagez jamais ce code avec qui que ce soit. Notre équipe ne vous demandera jamais ce code.\n\nACCÉDER À VOTRE COMPTE\n${SITE_URL}/wallet\n\nCordialement,\nL'équipe Nguma`,
    body: `
      <div class="status-badge info">Code de Vérification</div>
      
      <h2>Bonjour ${escapeHtml(params.name)},</h2>
      
      <p class="lead">Vous avez demandé un retrait de <strong>${formatCurrency(params.amount)}</strong>.</p>
      
      <p>Pour confirmer cette opération, veuillez utiliser le code de vérification ci-dessous :</p>
      
      <div style="background: white; border: 2px solid #667eea; border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0;">
        <p style="margin: 0; font-size: 14px; color: #666; margin-bottom: 12px;">Votre code OTP</p>
        <h1 style="margin: 0; font-size: 48px; color: #667eea; letter-spacing: 12px; font-weight: 700;">${params.otp_code}</h1>
        <p style="margin: 12px 0 0 0; font-size: 12px; color: #999;">Valide pendant 10 minutes</p>
      </div>
      
      <p><strong>Sécurité :</strong> Ne partagez jamais ce code avec qui que ce soit. Notre équipe ne vous demandera jamais ce code.</p>
      
      <div class="cta-buttons">
        <a href="${SITE_URL}/wallet" class="btn btn-primary">Accéder à Mon Compte</a>
      </div>
    `,
  }),
};

// Enhanced HTML template generator with modern design and embedded CSS
function generateEmailHtml(bodyContent: string) {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nguma</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1F2937; background-color: #F3F4F6; }
    .email-wrapper { max-width: 600px; margin: 0 auto; background-color: #FFFFFF; }
    .email-header { background: linear-gradient(135deg, #667EEA 0%, #764BA2 100%); padding: 40px 30px; text-align: center; }
    .logo { font-size: 32px; font-weight: 700; color: #FFFFFF; letter-spacing: 1px; }
    .email-body { padding: 40px 30px; }
    h2 { font-size: 24px; font-weight: 700; color: #1F2937; margin-bottom: 16px; }
    h3 { font-size: 18px; font-weight: 600; color: #374151; margin-bottom: 12px; }
    .lead { font-size: 16px; color: #4B5563; margin-bottom: 24px; line-height: 1.7; }
    p { margin-bottom: 16px; color: #4B5563; }
    .status-badge { display: inline-block; padding: 12px 24px; border-radius: 8px; font-weight: 600; margin-bottom: 24px; font-size: 14px; }
    .status-badge.success { background-color: #ECFDF5; color: #059669; border: 1px solid #10B981; }
    .status-badge.error { background-color: #FEF2F2; color: #DC2626; border: 1px solid #EF4444; }
    .status-badge.info { background-color: #EFF6FF; color: #2563EB; border: 1px solid #3B82F6; }
    .info-card { background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 12px; padding: 24px; margin-bottom: 24px; }
    .info-card.success-card { background-color: #ECFDF5; border-color: #A7F3D0; }
    .info-card.error-card { background-color: #FEF2F2; border-color: #FECACA; }
    .info-table { width: 100%; border-collapse: collapse; }
    .info-table tr { border-bottom: 1px solid #E5E7EB; }
    .info-table tr:last-child { border-bottom: none; }
    .info-table td { padding: 12px 0; }
    .info-table td:first-child { color: #6B7280; width: 50%; }
    .info-table td:last-child { text-align: right; font-weight: 500; }
    .amount-success { color: #059669; font-size: 20px; font-weight: 700; }
    .amount-highlight { color: #7C3AED; font-size: 18px; font-weight: 700; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .badge-success { background-color: #D1FAE5; color: #065F46; }
    .badge-error { background-color: #FEE2E2; color: #991B1B; }
    .badge-info { background-color: #DBEAFE; color: #1E40AF; }
    .rejection-reason { color: #DC2626; font-weight: 600; }
    .cta-buttons { text-align: center; margin: 32px 0; }
    .btn { display: inline-block; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 8px; }
    .btn-primary { background: linear-gradient(135deg, #667EEA 0%, #764BA2 100%); color: #FFFFFF !important; }
    .email-footer { background-color: #F9FAFB; padding: 30px; text-align: center; border-top: 1px solid #E5E7EB; }
    .footer-text { font-size: 13px; color: #6B7280; margin-bottom: 8px; }
    .footer-copyright { font-size: 12px; color: #9CA3AF; }
    @media only screen and (max-width: 600px) {
      .email-header { padding: 30px 20px; }
      .email-body { padding: 30px 20px; }
      .email-footer { padding: 20px; }
      h2 { font-size: 20px; }
      .btn { display: block; margin: 8px 0; }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-header">
      <div class="logo">NGUMA</div>
    </div>
    <div class="email-body">
      ${bodyContent}
    </div>
    <div class="email-footer">
      <p class="footer-text">
        <strong>Nguma</strong> - Votre plateforme d'investissement de confiance<br>
        Vous recevez cet e-mail car vous avez un compte actif sur Nguma.<br>
        <a href="${SITE_URL}/dashboard" style="color: #667EEA; text-decoration: none;">Accéder à mon compte</a>
      </p>
      <p class="footer-text" style="margin-top: 16px;">
        <strong>Nguma Inc.</strong><br>
        Kinshasa, République Démocratique du Congo<br>
        Email: <a href="mailto:contact@nguma.org" style="color: #667EEA; text-decoration: none;">contact@nguma.org</a>
      </p>
      <p class="footer-copyright">© ${new Date().getFullYear()} Nguma. Tous droits réservés.</p>
    </div>
  </div>
</body>
</html>
  `;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
      }
    });
  }

  if (!RESEND_API_KEY || !RESEND_FROM_DOMAIN) {
    const errorMessage = "RESEND_API_KEY or RESEND_FROM_DOMAIN environment variable is not set.";
    console.error(errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const payload = await req.json();
    const { template_id, ...params } = payload;

    // Validation: Ensure required parameters are present
    if (!params?.to || !params?.name) {
      return new Response(JSON.stringify({ error: "Missing required parameters: 'to' and 'name' are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(params.to)) {
      return new Response(JSON.stringify({ error: "Invalid email format" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const templateGenerator = templates[template_id];
    if (!templateGenerator) {
      return new Response(JSON.stringify({ error: `Template with id '${template_id}' not found.` }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    const { subject, body, text } = templateGenerator(params);
    const html = generateEmailHtml(body);
    const fromAddress = `Nguma <notification@${RESEND_FROM_DOMAIN}>`;
    const replyToAddress = `support@${RESEND_FROM_DOMAIN}`;

    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: [params.to],
      reply_to: replyToAddress,
      subject: subject,
      html: html,
      text: text,
      headers: {
        'List-Unsubscribe': `<${SITE_URL}/dashboard>`,
        'X-Entity-Ref-ID': crypto.randomUUID(),
      }
    });

    if (error) {
      console.error({ error });
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});