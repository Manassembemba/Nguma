import { supabase } from "@/integrations/supabase/client";

/**
 * Uploads a file to Supabase Storage with proper user folder structure.
 * Files are stored in: {bucket}/{userId}/{timestamp}_{random}.{ext}
 * 
 * @param bucket - The storage bucket name
 * @param file - The file to upload
 * @returns The public URL of the uploaded file
 */
export const uploadFile = async (bucket: string, file: File): Promise<string> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Utilisateur non authentifié");
  }

  const fileExt = file.name.split('.').pop();
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  const fileName = `${user.id}/${timestamp}_${random}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (uploadError) {
    console.error(`Upload error to bucket "${bucket}":`, uploadError.message);
    throw new Error(`Échec de l'upload: ${uploadError.message}`);
  }

  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(fileName);

  return publicUrl;
};

/**
 * Uploads a payment proof to the payment_proofs bucket.
 * 
 * @param file - The payment proof file
 * @returns The public URL of the uploaded file
 */
export const uploadPaymentProof = async (file: File): Promise<string> => {
  return uploadFile('payment_proofs', file);
};

/**
 * Uploads a withdrawal proof to the withdrawal-proofs bucket.
 * 
 * @param file - The withdrawal proof file
 * @returns The public URL of the uploaded file
 */
export const uploadWithdrawalProof = async (file: File): Promise<string> => {
  return uploadFile('withdrawal-proofs', file);
};

/**
 * Uploads an avatar image to the avatars bucket.
 * 
 * @param file - The avatar image file
 * @returns The public URL of the uploaded file
 */
export const uploadAvatar = async (file: File): Promise<string> => {
  return uploadFile('avatars', file);
};

/**
 * Uploads a chat attachment to the chat_attachments bucket.
 * 
 * @param file - The attachment file
 * @returns The public URL of the uploaded file
 */
export const uploadChatAttachment = async (file: File): Promise<string> => {
  return uploadFile('chat_attachments', file);
};
