import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

type Transaction = Database['public']['Tables']['transactions']['Row'];

/**
 * Fetches the 5 most recent transactions for the currently authenticated user.
 * @returns {Promise<Transaction[]>} A promise that resolves to an array of the user's recent transactions.
 * @throws {Error} If the user is not authenticated or if there's an error fetching the data.
 */
export const getRecentTransactions = async (): Promise<Transaction[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("User not authenticated. Please log in.");
  }

  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    console.error("Error fetching recent transactions:", error.message);
    throw new Error("Could not fetch recent transactions data.");
  }

  return data || [];
};

interface GetAllTransactionsFilters {
  type?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

interface PaginatedTransactions {
  transactions: Transaction[];
  count: number;
}

/**
 * Fetches all transactions for the currently authenticated user, with optional filters and pagination.
 * @param filters Optional object containing type, search, page, and pageSize filters.
 * @returns {Promise<PaginatedTransactions>} A promise that resolves to an object with paginated transactions and total count.
 * @throws {Error} If the user is not authenticated or if there's an error fetching the data.
 */
export const getAllTransactions = async (filters?: GetAllTransactionsFilters): Promise<PaginatedTransactions> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("User not authenticated. Please log in.");
  }

  let query = supabase
    .from("transactions")
    .select("*", { count: 'exact' })
    .eq("user_id", user.id);

  if (filters?.type && filters.type !== "all") {
    query = query.eq("type", filters.type);
  }

  if (filters?.search) {
    query = query.ilike("description", `%${filters.search}%`);
  }

  query = query.order("created_at", { ascending: false });

  // Apply pagination
  if (filters?.page !== undefined && filters?.pageSize !== undefined) {
    const start = (filters.page - 1) * filters.pageSize;
    const end = start + filters.pageSize - 1;
    query = query.range(start, end);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("Error fetching all transactions:", JSON.stringify(error, null, 2));
    throw new Error("Could not fetch transactions data.");
  }

  return { transactions: data || [], count: count || 0 };
};