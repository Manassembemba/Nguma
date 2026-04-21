import { EmailTemplate, TemplateHelpers, EmailContent } from '../../types.ts';
import { BaseLayout } from '../../layouts/baseLayout.ts';

/**
 * Template pour les messages de diffusion envoyés par l'administrateur
 */
export const adminBroadcastTemplate: EmailTemplate = {
  id: 'admin_broadcast',
  category: 'admin',
  requiredFields: ['subject', 'message'],
  render: (params: any, helpers: TemplateHelpers): EmailContent => {
    const { subject, message, name } = params;
    
    // Le layout attend : content, previewText, siteUrl
    const html = BaseLayout(
      `
      <div style="padding: 10px; color: #1a1a1a;">
        <h2 style="color: #4f46e5; margin-bottom: 20px;">Message de l'Administration Nguma</h2>
        <p style="font-size: 16px; margin-bottom: 20px;">Bonjour ${name || 'Cher investisseur'},</p>
        <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; border-left: 4px solid #4f46e5; margin-bottom: 20px; line-height: 1.6;">
          ${message.replace(/\n/g, '<br/>')}
        </div>
        <p style="font-size: 14px; color: #4b5563;">
          Si vous avez des questions concernant ce message, n'hésitez pas à contacter notre support.
        </p>
      </div>
      `,
      subject, // Utilise le sujet comme texte de prévisualisation
      helpers.siteUrl
    );

    return {
      subject: subject,
      text: `Message de l'Administration Nguma\n\nBonjour ${name || 'Cher investisseur'},\n\n${message}\n\nL'équipe Nguma`,
      html
    };
  }
};
