
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

type Setting = Database['public']['Tables']['settings']['Row'];

/**
 * Fetches all application settings.
 * Requires admin privileges (enforced by RLS).
 * @returns {Promise<Setting[]>} A promise that resolves to an array of settings.
 */
export const getSettings = async (): Promise<Setting[]> => {
  const { data, error } = await supabase.from("settings").select("*");

  if (error) {
    console.error("Error fetching settings:", error);
    throw new Error("Could not fetch settings.");
  }

  return data || [];
};

/**
 * Updates a specific application setting.
 * Requires admin privileges (enforced by RLS).
 * @param key The key of the setting to update.
 * @param value The new value for the setting.
 * @returns {Promise<any>} The result of the update operation.
 */
export const updateSetting = async ({ key, value }: { key: string; value: string }) => {
  const { data, error } = await supabase
    .from("settings")
    .update({ value, updated_at: new Date().toISOString() })
    .eq("key", key);

  if (error) {
    console.error("Error updating setting:", error);
    throw new Error("Could not update setting.");
  }

  return data;
};
