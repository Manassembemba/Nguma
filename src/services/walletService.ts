
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

// Define the type for a single wallet based on your Database types
type Wallet = Database['public']['Tables']['wallets']['Row'];

/**
 * Fetches the wallet data for the currently authenticated user.
 * This function encapsulates the logic for retrieving wallet information from Supabase.
 * @returns {Promise<Wallet>} A promise that resolves to the user's wallet data.
 * @throws {Error} If the user is not authenticated or if there's an error fetching the data.
 */
export const getWallet = async (): Promise<Wallet | null> => {
  const { data, error } = await supabase.rpc('get_or_create_wallet').single();

  if (error) {
    console.error("Error fetching or creating wallet:", error.message);
    throw new Error("Could not fetch or create wallet data.");
  }

  return data;
};

/**
 * Processes a user deposit request by creating a pending transaction.
 * @param amount The amount to deposit.
 * @param method The payment method used.
 * @returns {Promise<any>} The result of the RPC call.
 */
export const requestDeposit = async (amount: number, method: string, reference?: string, phone?: string) => {
  const { data, error } = await supabase.rpc('request_deposit', { 
    deposit_amount: amount,
    deposit_method: method,
    p_payment_reference: reference,
    p_payment_phone_number: phone
  });
  if (error) throw new Error(error.message);
  if (data && !data.success) throw new Error(data.error);
  return data;
};

/**
 * Processes a user withdrawal request by creating a pending transaction.
 * @param amount The amount to withdraw.
 * @returns {Promise<any>} The result of the RPC call.
 */
export const requestWithdrawal = async ({ amount, method, details }: { amount: number; method: "crypto" | "mobile_money"; details: string }) => {
  const rpcArgs: { withdraw_amount: number; withdraw_method: string; p_payment_reference?: string; p_payment_phone_number?: string } = {
    withdraw_amount: amount,
    withdraw_method: method,
  };

  if (method === "crypto") {
    rpcArgs.p_payment_reference = details;
  } else if (method === "mobile_money") {
    rpcArgs.p_payment_phone_number = details;
  }

  const { data, error } = await supabase.rpc('user_withdraw', rpcArgs);
  if (error) throw new Error(error.message);
  if (data && !data.success) throw new Error(data.error);
  return data;
};
