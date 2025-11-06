
import { supabase } from "@/integrations/supabase/client";

// --- Deposit Management ---
export const getPendingDeposits = async () => {
  const { data: transactions, error } = await supabase
    .from("transactions")
    .select(`*`)
    .eq("type", "deposit")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching pending deposits:", error);
    throw new Error("Could not fetch pending deposits.");
  }

  const transactionsWithProfiles = await Promise.all(
    (transactions || []).map(async (tx) => {
      const { data: profile } = await supabase.from('profiles').select('email, full_name').eq('id', tx.user_id).single();
      return { ...tx, profile };
    })
  );
  return transactionsWithProfiles;
};

export const approveDeposit = async (transactionId: string) => {
  const { data, error } = await supabase.rpc('approve_deposit', { transaction_id_to_approve: transactionId });
  if (error) throw new Error(error.message);
  if (data && !data.success) throw new Error(data.error || "An unknown error occurred.");
  return data;
};

// --- User Management ---
export const getAllUsers = async () => {
  const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
  if (error) throw new Error("Could not fetch users.");
  return data || [];
};

export const getUserDetails = async (userId: string) => {
  const [profile, wallet, contracts, transactions] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('wallets').select('*').eq('user_id', userId).single(),
    supabase.from('contracts').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('transactions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(10)
  ]);
  if (profile.error || wallet.error || contracts.error || transactions.error) {
    throw new Error("Could not fetch complete user details.");
  }
  return { profile: profile.data, wallet: wallet.data, contracts: contracts.data, transactions: transactions.data };
};

export const getInvestorsList = async (searchQuery?: string, page: number = 1, pageSize: number = 10) => {
  let profilesQuery = supabase
    .from("profiles")
    .select("id, email, first_name, last_name, post_nom", { count: 'exact' });

  if (searchQuery) {
    profilesQuery = profilesQuery.or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,post_nom.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`);
  }

  const from = (page - 1) * pageSize;
  const to = page * pageSize - 1;

  const { data: profiles, error: profilesError, count } = await profilesQuery
    .order("created_at", { ascending: false })
    .range(from, to);

  if (profilesError) {
    console.error("Error fetching investors list:", profilesError);
    throw new Error("Could not fetch investors list.");
  }

  const investorsData = await Promise.all(
    (profiles || []).map(async (profile) => {
      const { data: wallet } = await supabase.from('wallets').select('*').eq('user_id', profile.id).single();
      const { data: contracts } = await supabase.from('contracts').select('status').eq('user_id', profile.id);
      return { ...profile, wallet, contracts: contracts || [] };
    })
  );

  return { data: investorsData, count: count || 0 };
};

// --- Admin Actions ---
export const creditUser = async ({ userId, amount, reason }: { userId: string; amount: number; reason: string }) => {
  const { data, error } = await supabase.rpc('admin_credit_user', { target_user_id: userId, credit_amount: amount, reason: reason });
  if (error) throw new Error("Could not credit user.");
  if (data && !data.success) throw new Error(data.error || "An unknown error occurred.");
  return data;
};

// --- Stats ---
export const getAdminDashboardStats = async () => {
  const { data, error } = await supabase.rpc('get_admin_stats');
  if (error) throw new Error("Could not fetch admin dashboard stats.");
  if (data && !data.success) throw new Error(data.error || "An unknown error occurred.");
  return data;
};

export const getAggregateProfitsByMonth = async () => {
  const { data, error } = await supabase.rpc('get_aggregate_profits_by_month');
  if (error) throw new Error("Could not fetch aggregate profits.");
  return data || [];
};

// --- Withdrawal Management ---
export const getPendingWithdrawals = async () => {
  const { data: transactions, error } = await supabase
    .from("transactions")
    .select(`*`)
    .eq("type", "withdrawal")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching pending withdrawals:", error);
    throw new Error("Could not fetch pending withdrawals.");
  }

  const transactionsWithProfiles = await Promise.all(
    (transactions || []).map(async (tx) => {
      const { data: profile } = await supabase.from('profiles').select('email, full_name').eq('id', tx.user_id).single();
      return { ...tx, profile };
    })
  );
  return transactionsWithProfiles;
};

export const approveWithdrawal = async (transactionId: string) => {
  const { data, error } = await supabase.rpc('approve_withdrawal', { transaction_id_to_approve: transactionId });
  if (error) throw new Error(error.message);
  if (data && !data.success) throw new Error(data.error);
  return data;
};

export const rejectWithdrawal = async (transactionId: string, reason: string) => {
  const { data, error } = await supabase.rpc('reject_withdrawal', { transaction_id_to_reject: transactionId, reason: reason });
  if (error) throw new Error(error.message);
  if (data && !data.success) throw new Error(data.error);
  return data;
};
