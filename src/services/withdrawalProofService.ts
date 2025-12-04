import { supabase } from "@/integrations/supabase/client";

/**
 * Upload a proof of transfer image to Supabase Storage
 * @param file - The image file to upload
 * @param transactionId - The transaction ID (used in filename)
 * @returns The public URL of the uploaded file
 */
export const uploadWithdrawalProof = async (file: File, transactionId: string): Promise<string> => {
    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        throw new Error('Format invalide. Seules les images (JPEG, PNG, WebP) sont acceptées.');
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
        throw new Error('Fichier trop volumineux. Taille maximale: 5MB.');
    }

    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${transactionId}-${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    // Upload to storage
    const { data, error } = await supabase.storage
        .from('withdrawal-proofs')
        .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
        });

    if (error) {
        console.error('Upload error:', error);
        throw new Error(`Erreur d'upload: ${error.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
        .from('withdrawal-proofs')
        .getPublicUrl(filePath);

    return publicUrl;
};

/**
 * Delete a withdrawal proof from storage
 * @param fileUrl - The full URL of the file to delete
 */
export const deleteWithdrawalProof = async (fileUrl: string): Promise<void> => {
    // Extract filename from URL
    const urlParts = fileUrl.split('/');
    const fileName = urlParts[urlParts.length - 1];

    const { error } = await supabase.storage
        .from('withdrawal-proofs')
        .remove([fileName]);

    if (error) {
        console.error('Delete error:', error);
        throw new Error(`Erreur de suppression: ${error.message}`);
    }
};
