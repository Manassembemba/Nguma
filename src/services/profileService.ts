import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { sendEmailNotification } from "./notificationOrchestrationService"; // Import the notification service

type Profile = Database['public']['Tables']['profiles']['Row'];

/**
 * Fetches the profile for the currently authenticated user with roles.
 */
export const getProfile = async (): Promise<any | null> => {
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Utilisateur non authentifié.");
  }

  // Fetch profile first
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Error fetching profile:", profileError);
    throw new Error("Impossible de charger les données du profil.");
  }

  // Fetch user roles separately (foreign key is on auth.users, not profiles)
  const { data: roles, error: rolesError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  if (rolesError) {
    console.error("Error fetching user roles:", rolesError);
  }

  // Combine profile with roles
  const data = profile ? {
    ...profile,
    user_roles: roles || []
  } : null;

  // Si le profil existe déjà, le retourner
  if (data) {
    return data;
  }

  // Si aucun profil n'existe (ex: 1ère connexion OAuth/email), le créer
  const nameParts = (user.user_metadata?.full_name || '').split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  const newProfile: Profile = {
    id: user.id,
    email: user.email || '',
    first_name: user.user_metadata?.first_name || firstName,
    last_name: user.user_metadata?.last_name || lastName,
    avatar_url: user.user_metadata?.avatar_url || null,
    post_nom: null,
    phone: null,
    country: null,
    city: null,
    address: null,
    birth_date: null,
    updated_at: new Date().toISOString(),
    created_at: user.created_at,
    last_dormant_reminder_at: null,
    banned_until: null,
  };

  const { data: insertedProfile, error: insertError } = await supabase
    .from('profiles')
    .insert(newProfile)
    .select()
    .single();

  if (insertError) {
    throw new Error("Could not create new user profile.");
  }

  return insertedProfile;
};

/**
 * Updates the profile for the currently authenticated user.
 */
export const updateProfile = async (profileData: Partial<Profile>) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated.");

  // Prevent updating the id
  const { id, ...updatableData } = profileData;

  // Map profileData to RPC parameters
  const { data, error } = await supabase.rpc('update_user_profile', {
    p_first_name: updatableData.first_name || undefined,
    p_last_name: updatableData.last_name || undefined,
    p_post_nom: updatableData.post_nom || undefined,
    p_phone: updatableData.phone || undefined,
    p_country: updatableData.country || undefined,
    p_city: updatableData.city || undefined,
    p_address: updatableData.address || undefined,
    p_birth_date: updatableData.birth_date || undefined,
    p_avatar_url: updatableData.avatar_url || undefined,
  });

  if (error || (data as any)?.success === false) {
    console.error("Error updating profile:", error || (data as any)?.error);
    throw new Error((data as any)?.error || "Saisie invalide ou erreur serveur.");
  }

  // Refetch the updated profile for return and notification
  const { data: updatedProfile, error: fetchError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (fetchError || !updatedProfile) {
    throw new Error("Profil mis à jour mais impossible de récupérer les nouvelles données.");
  }

  // Send a notification email as a side effect
  if (updatedProfile) {
    try {
      const fullName = `${updatedProfile.first_name || ''} ${updatedProfile.last_name || ''}`.trim();
      await sendEmailNotification({
        template_id: 'profile_updated_by_user',
        to: updatedProfile.email,
        name: fullName || 'Cher utilisateur',
        userId: updatedProfile.id,
        date: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      });
    } catch (emailError) {
      console.error("Profile updated, but failed to send notification email:", emailError);
    }
  }

  return updatedProfile;
};
