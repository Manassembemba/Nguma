import { sendResendNotification, NotificationTemplate, NotificationParams } from "./resendNotificationService";

/**
 * Interface combining the template ID and the email parameters.
 */
export type SendEmailPayload = NotificationParams & {
  template_id: NotificationTemplate;
};

/**
 * Triggers the notification queue via sendResendNotification.
 * This ensures all emails go through the sequential processor with rate limiting.
 *
 * @param payload The data required to populate the email template.
 * @returns The result from the queue insertion.
 */
export const sendEmailNotification = async (payload: SendEmailPayload) => {
  const { template_id, ...params } = payload;

  console.log(`[Orchestration] Enqueuing email ${template_id} to ${params.to}`);

  return await sendResendNotification(template_id, params);
};
