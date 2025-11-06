import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

type Profile = Database['public']['Tables']['profiles']['Row'];

/**
 * Fetches the profile for the currently authenticated user.
 */
export const getProfile = async (): Promise<Profile | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated.");

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found, which is a valid case
    console.error("Error fetching profile:", error);
    throw new Error("Could not fetch profile data.");
  }

  return data;
};

/**
 * Updates the profile for the currently authenticated user.
 */
export const updateProfile = async (profileData: Partial<Profile>) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated.");

  // Prevent updating the id
  const { id, ...updatableData } = profileData;

  const { data, error } = await supabase
    .from("profiles")
    .update({
      ...updatableData,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .select()
    .single();

  if (error) {
    console.error("Error updating profile:", error);
    throw new Error("Could not update profile.");
  }

  return data;
};
