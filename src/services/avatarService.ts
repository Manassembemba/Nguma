import { supabase } from "@/integrations/supabase/client";
import { updateProfile } from './profileService';

const BUCKET_NAME = 'avatars';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

/**
 * Uploads a new avatar for the current user and updates their profile.
 * @param file The image file to upload.
 * @param userId The ID of the user.
 * @returns The public URL of the uploaded avatar.
 */
export const uploadAvatar = async (file: File, userId: string): Promise<string> => {
    // 1. Validate file type and size
    if (file.size > MAX_FILE_SIZE) {
        throw new Error(`L'image est trop volumineuse. Taille maximale: ${MAX_FILE_SIZE / 1024 / 1024} MB.`);
    }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        throw new Error('Type de fichier non autorisé. Uniquement PNG, JPG, et WEBP.');
    }

    // 2. Create a unique file path
    const fileExt = file.name.split('.').pop();
    // Path format: public/{userId}/{timestamp}.{ext}
    const filePath = `${userId}/${Date.now()}.${fileExt}`;

    // 3. Upload the file to Supabase Storage
    const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, file, {
            cacheControl: '3600', // Cache for 1 hour
            upsert: true, // Overwrite if a file with the same name exists
        });

    if (uploadError) {
        console.error('Avatar upload error:', uploadError);
        throw new Error("Erreur lors de l'envoi de l'avatar.");
    }

    // 4. Get the public URL
    const { data: urlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(filePath);

    if (!urlData?.publicUrl) {
        throw new Error("Impossible d'obtenir l'URL de l'avatar.");
    }
    
    const publicUrl = urlData.publicUrl;

    // 5. Update the user's profile with the new avatar URL
    const updatedProfile = await updateProfile({ avatar_url: publicUrl });

    if (!updatedProfile) {
        // If the profile update fails, we should ideally remove the uploaded file
        await supabase.storage.from(BUCKET_NAME).remove([filePath]);
        throw new Error("La mise à jour du profil avec le nouvel avatar a échoué.");
    }

    return publicUrl;
};

