import { supabase } from "@/integrations/supabase/client";

/**
 * Upload une image de logo pour une méthode de paiement
 * @param file - Fichier image à uploader
 * @param methodCode - Code de la méthode (ex: 'mpesa_rdc')
 * @returns URL publique de l'image uploadée
 */
export const uploadPaymentMethodLogo = async (
    file: File,
    methodCode: string
): Promise<string> => {
    // Valider le type de fichier
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
        throw new Error('Format de fichier non supporté. Utilisez JPG, PNG, GIF, WebP ou SVG.');
    }

    // Valider la taille (max 2MB)
    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
        throw new Error('Le fichier est trop volumineux. Taille maximale: 2MB.');
    }

    // Générer un nom de fichier unique
    const fileExt = file.name.split('.').pop();
    const fileName = `${methodCode}_${Date.now()}.${fileExt}`;
    const filePath = `logos/${fileName}`;

    // Upload vers Supabase Storage
    const { error: uploadError } = await supabase.storage
        .from('payment_method_logos')
        .upload(filePath, file, {
            cacheControl: '3600',
            upsert: true
        });

    if (uploadError) {
        throw new Error(`Erreur lors de l'upload: ${uploadError.message}`);
    }

    // Récupérer l'URL publique
    const { data: { publicUrl } } = supabase.storage
        .from('payment_method_logos')
        .getPublicUrl(filePath);

    return publicUrl;
};

/**
 * Supprime une image de logo
 * @param imageUrl - URL de l'image à supprimer
 */
export const deletePaymentMethodLogo = async (imageUrl: string): Promise<void> => {
    // Extraire le chemin du fichier depuis l'URL
    const urlParts = imageUrl.split('/payment_method_logos/');
    if (urlParts.length < 2) {
        throw new Error('URL invalide');
    }

    const filePath = urlParts[1];

    const { error } = await supabase.storage
        .from('payment_method_logos')
        .remove([filePath]);

    if (error) {
        throw new Error(`Erreur lors de la suppression: ${error.message}`);
    }
};

/**
 * Met à jour l'image d'une méthode de paiement
 * @param methodId - ID de la méthode
 * @param imageUrl - URL de la nouvelle image
 */
export const updatePaymentMethodImage = async (
    methodId: string,
    imageUrl: string
): Promise<void> => {
    const { error } = await supabase
        .from('payment_methods')
        .update({ image_url: imageUrl })
        .eq('id', methodId);

    if (error) {
        throw new Error(`Erreur lors de la mise à jour: ${error.message}`);
    }
};

/**
 * Met à jour l'image d'une catégorie
 * @param categoryId - ID de la catégorie
 * @param imageUrl - URL de la nouvelle image
 */
export const updateCategoryImage = async (
    categoryId: string,
    imageUrl: string
): Promise<void> => {
    const { error } = await supabase
        .from('payment_categories')
        .update({ image_url: imageUrl })
        .eq('id', categoryId);

    if (error) {
        throw new Error(`Erreur lors de la mise à jour: ${error.message}`);
    }
};
