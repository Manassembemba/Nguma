
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

type Profit = Database['public']['Tables']['profits']['Row'];

/**
 * Fetches all profit records for the currently authenticated user.
 * @returns {Promise<Profit[]>} A promise that resolves to an array of the user's profit records.
 * @throws {Error} If the user is not authenticated or if there's an error fetching the data.
 */
export const getProfits = async (): Promise<Profit[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("User not authenticated. Please log in.");
  }

  const { data, error } = await supabase.rpc('get_active_contracts_profits');

  if (error) {
    console.error("Error fetching profits:", error.message);
    throw new Error("Could not fetch profits data.");
  }

  return data || [];
};
