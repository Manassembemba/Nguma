import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@3.2.0";

// Get secrets from environment variables
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM_DOMAIN = Deno.env.get("RESEND_FROM_DOMAIN");

// Initialize Resend client
const resend = new Resend(RESEND_API_KEY!);

// --- Email Templates ---
const templates = {
  // For User: Deposit Approved
  deposit_approved: (params) => ({
    subject: `Votre dépôt de ${params.amount} USD a été approuvé`,
    body: `
      <p>Bonjour ${params.name},</p>
      <p>Bonne nouvelle ! Votre dépôt de <strong>${params.amount} USD</strong> a été approuvé et les fonds ont été ajoutés à votre solde.</p>
      <p>Vous pouvez consulter votre solde mis à jour dans votre portefeuille.</p>
    `,
  }),
  // For User: Deposit Rejected
  deposit_rejected: (params) => ({
    subject: `Votre dépôt de ${params.amount} USD a été rejeté`,
    body: `
      <p>Bonjour ${params.name},</p>
      <p>Votre dépôt de <strong>${params.amount} USD</strong> a été rejeté.</p>
      <p><strong>Raison :</strong> ${params.reason || "Aucune raison spécifiée."}</p>
      <p>Si vous avez des questions, n'hésitez pas à contacter le support.</p>
    `,
  }),
  // For Admin: New Deposit Request
  new_deposit_request: (params) => ({
    subject: `Nouvelle demande de dépôt de ${params.amount} USD`,
    body: `
      <p>Une nouvelle demande de dépôt a été soumise.</p>
      <ul>
        <li><strong>Utilisateur :</strong> ${params.name} (${params.email})</li>
        <li><strong>Montant :</strong> ${params.amount} USD</li>
      </ul>
      <p>Veuillez vous connecter au panneau d'administration pour l'approuver ou la rejeter.</p>
    `,
  }),
  // Add other templates here...
  // For User: Withdrawal Approved
  withdrawal_approved: (params) => ({
    subject: `Votre retrait de ${params.amount} USD a été approuvé`,
    body: `<p>Bonjour ${params.name},</p><p>Votre demande de retrait de <strong>${params.amount} USD</strong> a été approuvée et est en cours de traitement.</p>`,
  }),
  // For User: Withdrawal Rejected
  withdrawal_rejected: (params) => ({
    subject: `Votre retrait de ${params.amount} USD a été rejeté`,
    body: `<p>Bonjour ${params.name},</p><p>Votre demande de retrait de <strong>${params.amount} USD</strong> a été rejetée.</p><p><strong>Raison :</strong> ${params.reason || "Aucune raison spécifiée."}</p>`,
  }),
  // For Admin: New Withdrawal Request
  new_withdrawal_request: (params) => ({
    subject: `Nouvelle demande de retrait de ${params.amount} USD`,
    body: `<p>Une nouvelle demande de retrait a été soumise.</p><ul><li><strong>Utilisateur :</strong> ${params.name} (${params.email})</li><li><strong>Montant :</strong> ${params.amount} USD</li></ul><p>Veuillez vous connecter au panneau d'administration.</p>`,
  }),
  // For User: New Investment
  new_investment: (params) => ({
    subject: `Confirmation de votre investissement de ${params.amount} USD`,
    body: `<p>Bonjour ${params.name},</p><p>Félicitations ! Votre nouvel investissement de <strong>${params.amount} USD</strong> a été créé avec succès.</p>`,
  }),
  // For User: Monthly Profit
  monthly_profit: (params) => ({
    subject: `Paiement de votre profit mensuel de ${params.amount} USD`,
    body: `<p>Bonjour ${params.name},</p><p>Vous avez reçu un paiement de profit de <strong>${params.amount} USD</strong> pour votre contrat.</p>`,
  }),
};

function generateEmailHtml(bodyContent) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
        .header { font-size: 24px; font-weight: bold; margin-bottom: 20px; color: #007bff; }
        .content { margin-bottom: 20px; }
        .footer { font-size: 12px; color: #777; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">Notification Nguma</div>
        <div class="content">${bodyContent}</div>
        <div class="footer">
          <p>Cet e-mail est généré automatiquement, veuillez ne pas y répondre.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } });
  }

  if (!RESEND_API_KEY || !RESEND_FROM_DOMAIN) {
    const errorMessage = "RESEND_API_KEY or RESEND_FROM_DOMAIN environment variable is not set.";
    console.error(errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  try {
    const payload = await req.json();
    const { template_id, ...params } = payload;

    const templateGenerator = templates[template_id];
    if (!templateGenerator) {
      throw new Error(`Template with id '${template_id}' not found.`);
    }

    const { subject, body } = templateGenerator(params);
    const html = generateEmailHtml(body);
    const fromAddress = `Nguma <notification@${RESEND_FROM_DOMAIN}>`;

    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: [params.to],
      subject: subject,
      html: html,
    });

    if (error) {
      console.error({ error });
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } });

  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});