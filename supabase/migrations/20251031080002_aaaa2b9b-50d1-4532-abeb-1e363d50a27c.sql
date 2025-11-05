-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'investor');

-- Create user_roles table (CRITICAL for security - roles must be in separate table)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL DEFAULT 'investor',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  country TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create wallets table
CREATE TABLE public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  total_balance NUMERIC(20,8) NOT NULL DEFAULT 0,
  invested_balance NUMERIC(20,8) NOT NULL DEFAULT 0,
  profit_balance NUMERIC(20,8) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT positive_balances CHECK (
    total_balance >= 0 AND 
    invested_balance >= 0 AND 
    profit_balance >= 0
  )
);

-- Create contracts table
CREATE TABLE public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC(20,8) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  monthly_rate NUMERIC(10,8) NOT NULL,
  duration_months INTEGER NOT NULL DEFAULT 10,
  status TEXT NOT NULL DEFAULT 'active',
  start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_date TIMESTAMPTZ NOT NULL,
  months_paid INTEGER NOT NULL DEFAULT 0,
  total_profit_paid NUMERIC(20,8) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_amount CHECK (amount > 0),
  CONSTRAINT valid_status CHECK (status IN ('active', 'completed', 'refunded', 'cancelled'))
);

-- Create profits table
CREATE TABLE public.profits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC(20,8) NOT NULL,
  month_number INTEGER NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_profit_amount CHECK (amount > 0)
);

-- Create transactions table
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  amount NUMERIC(20,8) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'completed',
  reference_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_transaction_type CHECK (type IN ('deposit', 'withdrawal', 'profit', 'refund', 'investment')),
  CONSTRAINT valid_transaction_status CHECK (status IN ('pending', 'completed', 'failed', 'cancelled'))
);

-- Create settings table
CREATE TABLE public.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create admin_actions table
CREATE TABLE public.admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security on all tables
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check user roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for wallets
CREATE POLICY "Users can view their own wallet"
  ON public.wallets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own wallet"
  ON public.wallets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all wallets"
  ON public.wallets FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all wallets"
  ON public.wallets FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for contracts
CREATE POLICY "Users can view their own contracts"
  ON public.contracts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own contracts"
  ON public.contracts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own contracts"
  ON public.contracts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all contracts"
  ON public.contracts FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all contracts"
  ON public.contracts FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for profits
CREATE POLICY "Users can view their own profits"
  ON public.profits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profits"
  ON public.profits FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for transactions
CREATE POLICY "Users can view their own transactions"
  ON public.transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own transactions"
  ON public.transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all transactions"
  ON public.transactions FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for settings
CREATE POLICY "Everyone can view settings"
  ON public.settings FOR SELECT
  USING (true);

CREATE POLICY "Admins can update settings"
  ON public.settings FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for admin_actions
CREATE POLICY "Admins can view all admin actions"
  ON public.admin_actions FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create admin actions"
  ON public.admin_actions FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );

  -- Insert wallet
  INSERT INTO public.wallets (user_id)
  VALUES (NEW.id);

  -- Assign investor role by default
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'investor');

  RETURN NEW;
END;
$$;

-- Create trigger for new user
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create function to calculate monthly profits
CREATE OR REPLACE FUNCTION public.calculate_monthly_profits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  contract_record RECORD;
  profit_amount NUMERIC(20,8);
  current_month INTEGER;
BEGIN
  -- Loop through all active contracts
  FOR contract_record IN 
    SELECT * FROM public.contracts 
    WHERE status = 'active' 
    AND months_paid < duration_months
  LOOP
    -- Calculate current month number
    current_month := contract_record.months_paid + 1;
    
    -- Calculate profit amount
    profit_amount := contract_record.amount * contract_record.monthly_rate;
    
    -- Insert profit record
    INSERT INTO public.profits (contract_id, user_id, amount, month_number)
    VALUES (
      contract_record.id,
      contract_record.user_id,
      profit_amount,
      current_month
    );
    
    -- Update wallet profit balance
    UPDATE public.wallets
    SET 
      profit_balance = profit_balance + profit_amount,
      updated_at = now()
    WHERE user_id = contract_record.user_id;
    
    -- Create transaction record
    INSERT INTO public.transactions (user_id, type, amount, currency, reference_id, description)
    VALUES (
      contract_record.user_id,
      'profit',
      profit_amount,
      contract_record.currency,
      contract_record.id,
      'Monthly profit from contract month ' || current_month::TEXT
    );
    
    -- Update contract
    UPDATE public.contracts
    SET 
      months_paid = current_month,
      total_profit_paid = total_profit_paid + profit_amount,
      status = CASE WHEN current_month >= duration_months THEN 'completed' ELSE 'active' END,
      updated_at = now()
    WHERE id = contract_record.id;

    -- Notify user about monthly profit
    INSERT INTO public.notifications (user_id, message, link_to)
    VALUES (contract_record.user_id, 'Votre profit mensuel de ' || profit_amount || ' ' || contract_record.currency || ' a été versé.', '/wallet');
  END LOOP;
END;
$$;

-- Create function to execute refund
CREATE OR REPLACE FUNCTION public.execute_refund(_contract_id UUID, _user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  contract_record RECORD;
  refund_amount NUMERIC(20,8);
  result JSONB;
BEGIN
  -- Get contract details
  SELECT * INTO contract_record
  FROM public.contracts
  WHERE id = _contract_id AND user_id = _user_id AND status = 'active';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contract not found or not active');
  END IF;

  -- Add new rule: check if contract is older than 5 months
  IF contract_record.months_paid >= 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Early refund is only possible within the first 5 months.');
  END IF;
  
  -- Calculate refund amount: invested amount - profits already paid
  refund_amount := contract_record.amount - contract_record.total_profit_paid;
  
  IF refund_amount < 0 THEN
    refund_amount := 0;
  END IF;
  
  -- Update wallet
  UPDATE public.wallets
  SET 
    total_balance = total_balance + refund_amount,
    invested_balance = invested_balance - contract_record.amount,
    updated_at = now()
  WHERE user_id = _user_id;
  
  -- Create transaction record
  INSERT INTO public.transactions (user_id, type, amount, currency, reference_id, description)
  VALUES (
    _user_id,
    'refund',
    refund_amount,
    contract_record.currency,
    _contract_id,
    'Early refund from contract'
  );
  
  -- Update contract status
  UPDATE public.contracts
  SET 
    status = 'refunded',
    updated_at = now()
  WHERE id = _contract_id;
  
  result := jsonb_build_object(
    'success', true,
    'refund_amount', refund_amount,
    'contract_id', _contract_id
  );
  
  RETURN result;
END;
$$;

-- Create indexes for performance
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_wallets_user_id ON public.wallets(user_id);
CREATE INDEX idx_contracts_user_id ON public.contracts(user_id);
CREATE INDEX idx_contracts_status ON public.contracts(status);
CREATE INDEX idx_profits_user_id ON public.profits(user_id);
CREATE INDEX idx_profits_contract_id ON public.profits(contract_id);
CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX idx_transactions_type ON public.transactions(type);
CREATE INDEX idx_transactions_created_at ON public.transactions(created_at DESC);

-- Insert default settings
INSERT INTO public.settings (key, value, description)
VALUES 
  ('monthly_profit_rate', '0.10', 'Default monthly profit rate (10%)'),
  ('min_investment', '100', 'Minimum investment amount'),
  ('max_investment', '1000000', 'Maximum investment amount'),
  ('contract_duration_months', '10', 'Default contract duration in months')
ON CONFLICT (key) DO NOTHING;