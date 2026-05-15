import { createClient, User } from 'https://esm.sh/@supabase/supabase-js@2';

export const authenticateUser = async (req: Request): Promise<User> => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new Error('Missing Authorization header');

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  );

  const { data: { user }, error } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (error || !user) {
    console.error('Erreur Supabase Auth:', error);
    throw new Error(`Invalid token: ${error?.message || 'No user found'}`);
  }
  return user;
};

export const isServiceRole = (req: Request): boolean => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return false;
  return authHeader.includes(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'INVALID_KEY');
};
