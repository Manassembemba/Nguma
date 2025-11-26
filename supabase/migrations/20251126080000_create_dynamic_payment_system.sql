-- Migration: Système Dynamique de Moyens de Paiement avec Catégories
-- Description: Création d'un système flexible pour gérer tous les moyens de paiement

-- ============================================================================
-- 1. CRÉATION DES TABLES
-- ============================================================================

-- Table des catégories de moyens de paiement
CREATE TABLE IF NOT EXISTS public.payment_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table des moyens de paiement
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES payment_categories(id) ON DELETE SET NULL,
  
  -- Identification
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'mobile_money', 'crypto', 'bank_transfer', 'international_transfer'
  icon TEXT,
  description TEXT,
  
  -- Configuration
  is_active BOOLEAN DEFAULT true,
  available_for_deposit BOOLEAN DEFAULT true,
  available_for_withdrawal BOOLEAN DEFAULT true,
  
  -- Limites
  min_amount NUMERIC(20,8),
  max_amount NUMERIC(20,8),
  
  -- Frais
  fee_type TEXT DEFAULT 'none', -- 'none', 'fixed', 'percentage', 'combined'
  fee_fixed NUMERIC(20,8) DEFAULT 0,
  fee_percentage NUMERIC(10,4) DEFAULT 0,
  
  -- Instructions
  instructions TEXT,
  admin_instructions TEXT,
  
  -- Métadonnées
  display_order INTEGER DEFAULT 0,
  requires_proof BOOLEAN DEFAULT true,
  processing_time TEXT,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Table des champs configurables par méthode
CREATE TABLE IF NOT EXISTS public.payment_method_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_method_id UUID REFERENCES payment_methods(id) ON DELETE CASCADE,
  
  -- Configuration du champ
  field_key TEXT NOT NULL,
  field_label TEXT NOT NULL,
  field_type TEXT NOT NULL, -- 'text', 'textarea', 'number', 'tel', 'email', 'file'
  field_placeholder TEXT,
  
  -- Validation
  is_required BOOLEAN DEFAULT false,
  validation_regex TEXT,
  validation_message TEXT,
  
  -- Valeur (pour les champs admin comme adresse de réception)
  field_value TEXT,
  is_user_input BOOLEAN DEFAULT true, -- false = champ admin (affichage), true = champ utilisateur (saisie)
  
  -- Affichage
  display_order INTEGER DEFAULT 0,
  help_text TEXT,
  show_copy_button BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table des métadonnées de transaction (données dynamiques)
CREATE TABLE IF NOT EXISTS public.transaction_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  field_value TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 2. CRÉATION DES INDEX
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_payment_categories_active ON payment_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_payment_categories_order ON payment_categories(display_order);

CREATE INDEX IF NOT EXISTS idx_payment_methods_category ON payment_methods(category_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_active ON payment_methods(is_active);
CREATE INDEX IF NOT EXISTS idx_payment_methods_type ON payment_methods(type);
CREATE INDEX IF NOT EXISTS idx_payment_methods_order ON payment_methods(display_order);

CREATE INDEX IF NOT EXISTS idx_payment_method_fields_method ON payment_method_fields(payment_method_id);
CREATE INDEX IF NOT EXISTS idx_payment_method_fields_order ON payment_method_fields(display_order);

CREATE INDEX IF NOT EXISTS idx_transaction_metadata_transaction ON transaction_metadata(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_metadata_field_key ON transaction_metadata(field_key);

-- ============================================================================
-- 3. INSERTION DES CATÉGORIES
-- ============================================================================

INSERT INTO public.payment_categories (code, name, description, icon, display_order) VALUES
('mobile_money_rdc', 'Mobile Money (RDC)', 'Paiements mobiles en République Démocratique du Congo', 'Smartphone', 1),
('crypto', 'Cryptomonnaies', 'Paiements en cryptomonnaies (USDT, Binance)', 'Bitcoin', 2),
('international_transfer', 'Transferts Internationaux', 'Western Union, MoneyGram, Ria', 'Globe', 3),
('bank_transfer', 'Virements Bancaires', 'Transferts bancaires (Ecobank, Equity)', 'Building2', 4);

-- ============================================================================
-- 4. INSERTION DES MOYENS DE PAIEMENT
-- ============================================================================

-- Variable pour stocker les IDs de catégories
DO $$
DECLARE
  cat_mobile_money UUID;
  cat_crypto UUID;
  cat_international UUID;
  cat_bank UUID;
  
  method_mpesa UUID;
  method_airtel UUID;
  method_orange UUID;
  method_binance UUID;
  method_usdt UUID;
  method_western UUID;
  method_moneygram UUID;
  method_ria UUID;
  method_ecobank UUID;
  method_equity UUID;
BEGIN
  -- Récupérer les IDs des catégories
  SELECT id INTO cat_mobile_money FROM payment_categories WHERE code = 'mobile_money_rdc';
  SELECT id INTO cat_crypto FROM payment_categories WHERE code = 'crypto';
  SELECT id INTO cat_international FROM payment_categories WHERE code = 'international_transfer';
  SELECT id INTO cat_bank FROM payment_categories WHERE code = 'bank_transfer';

  -- ========== MOBILE MONEY (RDC) ==========
  
  -- M-Pesa
  INSERT INTO payment_methods (category_id, code, name, type, icon, description, instructions, display_order, requires_proof)
  VALUES (
    cat_mobile_money,
    'mpesa_rdc',
    'M-Pesa',
    'mobile_money',
    'Smartphone',
    'Paiement via M-Pesa Vodacom',
    'Envoyez le montant au numéro M-Pesa indiqué. Après le paiement, envoyez OBLIGATOIREMENT une capture d''écran de la transaction.',
    1,
    true
  ) RETURNING id INTO method_mpesa;

  INSERT INTO payment_method_fields (payment_method_id, field_key, field_label, field_type, field_value, is_user_input, display_order, show_copy_button)
  VALUES 
    (method_mpesa, 'recipient_number', 'Numéro M-Pesa', 'text', '+243817432265', false, 1, true),
    (method_mpesa, 'recipient_name', 'Nom du bénéficiaire', 'text', 'Eunice Disubi', false, 2, false);

  INSERT INTO payment_method_fields (payment_method_id, field_key, field_label, field_type, field_placeholder, is_required, is_user_input, display_order, help_text)
  VALUES 
    (method_mpesa, 'sender_number', 'Votre numéro M-Pesa', 'tel', '+243XXXXXXXXX', true, true, 3, 'Le numéro depuis lequel vous effectuez le paiement'),
    (method_mpesa, 'transaction_id', 'Code de transaction M-Pesa', 'text', 'Ex: ABC123XYZ', true, true, 4, 'Le code de confirmation reçu après le paiement'),
    (method_mpesa, 'proof_screenshot', 'Capture d''écran de la transaction', 'file', null, true, true, 5, 'OBLIGATOIRE: Capture d''écran de la confirmation M-Pesa');

  -- Airtel Money
  INSERT INTO payment_methods (category_id, code, name, type, icon, description, instructions, display_order, requires_proof)
  VALUES (
    cat_mobile_money,
    'airtel_money_rdc',
    'Airtel Money',
    'mobile_money',
    'Smartphone',
    'Paiement via Airtel Money',
    'Envoyez le montant au numéro Airtel Money indiqué. Après le paiement, envoyez OBLIGATOIREMENT une capture d''écran de la transaction.',
    2,
    true
  ) RETURNING id INTO method_airtel;

  INSERT INTO payment_method_fields (payment_method_id, field_key, field_label, field_type, field_value, is_user_input, display_order, show_copy_button)
  VALUES 
    (method_airtel, 'recipient_number', 'Numéro Airtel Money', 'text', '+243976377467', false, 1, true),
    (method_airtel, 'recipient_name', 'Nom du bénéficiaire', 'text', 'Junior Luangha', false, 2, false);

  INSERT INTO payment_method_fields (payment_method_id, field_key, field_label, field_type, field_placeholder, is_required, is_user_input, display_order, help_text)
  VALUES 
    (method_airtel, 'sender_number', 'Votre numéro Airtel Money', 'tel', '+243XXXXXXXXX', true, true, 3, 'Le numéro depuis lequel vous effectuez le paiement'),
    (method_airtel, 'transaction_id', 'Code de transaction Airtel', 'text', 'Ex: ABC123XYZ', true, true, 4, 'Le code de confirmation reçu après le paiement'),
    (method_airtel, 'proof_screenshot', 'Capture d''écran de la transaction', 'file', null, true, true, 5, 'OBLIGATOIRE: Capture d''écran de la confirmation Airtel Money');

  -- Orange Money
  INSERT INTO payment_methods (category_id, code, name, type, icon, description, instructions, display_order, requires_proof)
  VALUES (
    cat_mobile_money,
    'orange_money_rdc',
    'Orange Money',
    'mobile_money',
    'Smartphone',
    'Paiement via Orange Money',
    'Envoyez le montant au numéro Orange Money indiqué. Après le paiement, envoyez OBLIGATOIREMENT une capture d''écran de la transaction.',
    3,
    true
  ) RETURNING id INTO method_orange;

  INSERT INTO payment_method_fields (payment_method_id, field_key, field_label, field_type, field_value, is_user_input, display_order, show_copy_button)
  VALUES 
    (method_orange, 'recipient_number', 'Numéro Orange Money', 'text', '+243846863475', false, 1, true),
    (method_orange, 'recipient_name', 'Nom du bénéficiaire', 'text', 'Junior Luangha', false, 2, false);

  INSERT INTO payment_method_fields (payment_method_id, field_key, field_label, field_type, field_placeholder, is_required, is_user_input, display_order, help_text)
  VALUES 
    (method_orange, 'sender_number', 'Votre numéro Orange Money', 'tel', '+243XXXXXXXXX', true, true, 3, 'Le numéro depuis lequel vous effectuez le paiement'),
    (method_orange, 'transaction_id', 'Code de transaction Orange', 'text', 'Ex: ABC123XYZ', true, true, 4, 'Le code de confirmation reçu après le paiement'),
    (method_orange, 'proof_screenshot', 'Capture d''écran de la transaction', 'file', null, true, true, 5, 'OBLIGATOIRE: Capture d''écran de la confirmation Orange Money');

  -- ========== CRYPTOMONNAIES ==========
  
  -- Binance ID
  INSERT INTO payment_methods (category_id, code, name, type, icon, description, instructions, display_order, requires_proof)
  VALUES (
    cat_crypto,
    'binance_id',
    'Binance ID',
    'crypto',
    'Bitcoin',
    'Transfert via Binance ID',
    'Envoyez le montant à l''ID Binance indiqué. Après le transfert, envoyez une capture d''écran de la confirmation.',
    1,
    true
  ) RETURNING id INTO method_binance;

  INSERT INTO payment_method_fields (payment_method_id, field_key, field_label, field_type, field_value, is_user_input, display_order, show_copy_button)
  VALUES 
    (method_binance, 'binance_id', 'ID Binance', 'text', '35546563', false, 1, true),
    (method_binance, 'binance_username', 'Nom d''utilisateur', 'text', 'EsaieBot', false, 2, false);

  INSERT INTO payment_method_fields (payment_method_id, field_key, field_label, field_type, field_placeholder, is_required, is_user_input, display_order, help_text)
  VALUES 
    (method_binance, 'sender_binance_id', 'Votre ID Binance', 'text', 'Votre ID Binance', true, true, 3, 'L''ID Binance depuis lequel vous effectuez le transfert'),
    (method_binance, 'transaction_hash', 'Hash de transaction', 'text', 'Hash de la transaction', true, true, 4, 'Le hash de la transaction Binance'),
    (method_binance, 'proof_screenshot', 'Capture d''écran', 'file', null, true, true, 5, 'Capture d''écran de la confirmation Binance');

  -- USDT (TRC20)
  INSERT INTO payment_methods (category_id, code, name, type, icon, description, instructions, display_order, requires_proof)
  VALUES (
    cat_crypto,
    'usdt_trc20',
    'USDT (TRC20)',
    'crypto',
    'Bitcoin',
    'Paiement en USDT sur réseau Tron',
    'Envoyez le montant exact en USDT (TRC20) à l''adresse indiquée. Les frais de réseau sont à votre charge. Après l''envoi, fournissez le TxID et une capture d''écran.',
    2,
    true
  ) RETURNING id INTO method_usdt;

  INSERT INTO payment_method_fields (payment_method_id, field_key, field_label, field_type, field_value, is_user_input, display_order, show_copy_button)
  VALUES 
    (method_usdt, 'wallet_address', 'Adresse USDT (TRC20)', 'text', 'TPXAWmMb1vtermm3FNhghS1U6zbfDQTWbb', false, 1, true);

  INSERT INTO payment_method_fields (payment_method_id, field_key, field_label, field_type, field_placeholder, is_required, is_user_input, display_order, help_text)
  VALUES 
    (method_usdt, 'transaction_hash', 'TxID (Transaction Hash)', 'text', 'Collez le TxID de la transaction', true, true, 2, 'Vous pouvez trouver le TxID dans votre wallet ou sur TronScan'),
    (method_usdt, 'proof_screenshot', 'Capture d''écran', 'file', null, true, true, 3, 'Capture d''écran de la transaction depuis votre wallet');

  -- ========== TRANSFERTS INTERNATIONAUX ==========
  
  -- Western Union
  INSERT INTO payment_methods (category_id, code, name, type, icon, description, instructions, display_order, requires_proof)
  VALUES (
    cat_international,
    'western_union',
    'Western Union',
    'international_transfer',
    'Globe',
    'Transfert d''argent via Western Union',
    'Effectuez le transfert Western Union avec les informations du bénéficiaire ci-dessous. Après l''envoi, envoyez OBLIGATOIREMENT la photo ou capture d''écran du reçu.',
    1,
    true
  ) RETURNING id INTO method_western;

  INSERT INTO payment_method_fields (payment_method_id, field_key, field_label, field_type, field_value, is_user_input, display_order, show_copy_button)
  VALUES 
    (method_western, 'first_name', 'Prénom (First Name)', 'text', 'EUNICE', false, 1, false),
    (method_western, 'last_name', 'Nom (Last Name)', 'text', 'DISUBI DISUBI', false, 2, false),
    (method_western, 'phone_number', 'Numéro de téléphone', 'text', '+243817432265', false, 3, true),
    (method_western, 'city', 'Ville', 'text', 'Kinshasa', false, 4, false),
    (method_western, 'country', 'Pays', 'text', 'R.D.Congo', false, 5, false);

  INSERT INTO payment_method_fields (payment_method_id, field_key, field_label, field_type, field_placeholder, is_required, is_user_input, display_order, help_text)
  VALUES 
    (method_western, 'mtcn', 'MTCN (Numéro de contrôle)', 'text', 'Numéro à 10 chiffres', true, true, 6, 'Le numéro MTCN (Money Transfer Control Number) fourni par Western Union'),
    (method_western, 'sender_name', 'Votre nom complet', 'text', 'Nom de l''expéditeur', true, true, 7, 'Votre nom tel qu''il apparaît sur le reçu'),
    (method_western, 'proof_photo', 'Photo du reçu', 'file', null, true, true, 8, 'OBLIGATOIRE: Photo ou capture du reçu Western Union');

  -- MoneyGram
  INSERT INTO payment_methods (category_id, code, name, type, icon, description, instructions, display_order, requires_proof)
  VALUES (
    cat_international,
    'moneygram',
    'MoneyGram',
    'international_transfer',
    'Globe',
    'Transfert d''argent via MoneyGram',
    'Effectuez le transfert MoneyGram avec les informations du bénéficiaire ci-dessous. Après l''envoi, envoyez OBLIGATOIREMENT la photo ou capture d''écran du reçu.',
    2,
    true
  ) RETURNING id INTO method_moneygram;

  INSERT INTO payment_method_fields (payment_method_id, field_key, field_label, field_type, field_value, is_user_input, display_order, show_copy_button)
  VALUES 
    (method_moneygram, 'first_name', 'Prénom (First Name)', 'text', 'EUNICE', false, 1, false),
    (method_moneygram, 'last_name', 'Nom (Last Name)', 'text', 'DISUBI DISUBI', false, 2, false),
    (method_moneygram, 'phone_number', 'Numéro de téléphone', 'text', '+243817432265', false, 3, true),
    (method_moneygram, 'city', 'Ville', 'text', 'Kinshasa', false, 4, false),
    (method_moneygram, 'country', 'Pays', 'text', 'R.D.Congo', false, 5, false);

  INSERT INTO payment_method_fields (payment_method_id, field_key, field_label, field_type, field_placeholder, is_required, is_user_input, display_order, help_text)
  VALUES 
    (method_moneygram, 'reference_number', 'Numéro de référence', 'text', 'Numéro à 8 chiffres', true, true, 6, 'Le numéro de référence fourni par MoneyGram'),
    (method_moneygram, 'sender_name', 'Votre nom complet', 'text', 'Nom de l''expéditeur', true, true, 7, 'Votre nom tel qu''il apparaît sur le reçu'),
    (method_moneygram, 'proof_photo', 'Photo du reçu', 'file', null, true, true, 8, 'OBLIGATOIRE: Photo ou capture du reçu MoneyGram');

  -- Ria
  INSERT INTO payment_methods (category_id, code, name, type, icon, description, instructions, display_order, requires_proof)
  VALUES (
    cat_international,
    'ria',
    'Ria Money Transfer',
    'international_transfer',
    'Globe',
    'Transfert d''argent via Ria',
    'Effectuez le transfert Ria avec les informations du bénéficiaire ci-dessous. Après l''envoi, envoyez OBLIGATOIREMENT la photo ou capture d''écran du reçu.',
    3,
    true
  ) RETURNING id INTO method_ria;

  INSERT INTO payment_method_fields (payment_method_id, field_key, field_label, field_type, field_value, is_user_input, display_order, show_copy_button)
  VALUES 
    (method_ria, 'first_name', 'Prénom (First Name)', 'text', 'EUNICE', false, 1, false),
    (method_ria, 'last_name', 'Nom (Last Name)', 'text', 'DISUBI DISUBI', false, 2, false),
    (method_ria, 'phone_number', 'Numéro de téléphone', 'text', '+243817432265', false, 3, true),
    (method_ria, 'city', 'Ville', 'text', 'Kinshasa', false, 4, false),
    (method_ria, 'country', 'Pays', 'text', 'R.D.Congo', false, 5, false);

  INSERT INTO payment_method_fields (payment_method_id, field_key, field_label, field_type, field_placeholder, is_required, is_user_input, display_order, help_text)
  VALUES 
    (method_ria, 'pin_number', 'Numéro PIN', 'text', 'PIN à 4 chiffres', true, true, 6, 'Le numéro PIN fourni par Ria'),
    (method_ria, 'sender_name', 'Votre nom complet', 'text', 'Nom de l''expéditeur', true, true, 7, 'Votre nom tel qu''il apparaît sur le reçu'),
    (method_ria, 'proof_photo', 'Photo du reçu', 'file', null, true, true, 8, 'OBLIGATOIRE: Photo ou capture du reçu Ria');

  -- ========== VIREMENTS BANCAIRES ==========
  
  -- Ecobank
  INSERT INTO payment_methods (category_id, code, name, type, icon, description, instructions, display_order, requires_proof)
  VALUES (
    cat_bank,
    'ecobank',
    'Ecobank',
    'bank_transfer',
    'Building2',
    'Virement bancaire Ecobank',
    'Effectuez le virement vers le compte Ecobank indiqué. Après le virement, envoyez OBLIGATOIREMENT la photo ou capture d''écran du reçu bancaire.',
    1,
    true
  ) RETURNING id INTO method_ecobank;

  INSERT INTO payment_method_fields (payment_method_id, field_key, field_label, field_type, field_value, is_user_input, display_order, show_copy_button)
  VALUES 
    (method_ecobank, 'account_number', 'Numéro de compte', 'text', '35400004671', false, 1, true),
    (method_ecobank, 'account_name', 'Intitulé du compte', 'text', 'Botendja Yesaya Esaie', false, 2, false);

  INSERT INTO payment_method_fields (payment_method_id, field_key, field_label, field_type, field_placeholder, is_required, is_user_input, display_order, help_text)
  VALUES 
    (method_ecobank, 'sender_account', 'Votre numéro de compte', 'text', 'Numéro de compte expéditeur', true, true, 3, 'Le numéro de compte depuis lequel vous effectuez le virement'),
    (method_ecobank, 'transaction_reference', 'Référence de transaction', 'text', 'Référence bancaire', true, true, 4, 'La référence de la transaction fournie par la banque'),
    (method_ecobank, 'proof_photo', 'Photo du reçu', 'file', null, true, true, 5, 'OBLIGATOIRE: Photo ou capture du reçu bancaire');

  -- Equity Bank
  INSERT INTO payment_methods (category_id, code, name, type, icon, description, instructions, display_order, requires_proof)
  VALUES (
    cat_bank,
    'equity_bank',
    'Equity Bank',
    'bank_transfer',
    'Building2',
    'Virement bancaire Equity Bank',
    'Effectuez le virement vers le compte Equity Bank indiqué. Après le virement, envoyez OBLIGATOIREMENT la photo ou capture d''écran du reçu bancaire.',
    2,
    true
  ) RETURNING id INTO method_equity;

  INSERT INTO payment_method_fields (payment_method_id, field_key, field_label, field_type, field_value, is_user_input, display_order, show_copy_button)
  VALUES 
    (method_equity, 'account_number', 'Numéro de compte', 'text', '511200177035070', false, 1, true),
    (method_equity, 'account_name', 'Intitulé du compte', 'text', 'Botes Group SARL', false, 2, false);

  INSERT INTO payment_method_fields (payment_method_id, field_key, field_label, field_type, field_placeholder, is_required, is_user_input, display_order, help_text)
  VALUES 
    (method_equity, 'sender_account', 'Votre numéro de compte', 'text', 'Numéro de compte expéditeur', true, true, 3, 'Le numéro de compte depuis lequel vous effectuez le virement'),
    (method_equity, 'transaction_reference', 'Référence de transaction', 'text', 'Référence bancaire', true, true, 4, 'La référence de la transaction fournie par la banque'),
    (method_equity, 'proof_photo', 'Photo du reçu', 'file', null, true, true, 5, 'OBLIGATOIRE: Photo ou capture du reçu bancaire');

END $$;

-- ============================================================================
-- 5. RLS POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE public.payment_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_method_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_metadata ENABLE ROW LEVEL SECURITY;

-- payment_categories
CREATE POLICY "Anyone can view active categories"
  ON payment_categories FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage categories"
  ON payment_categories FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- payment_methods
CREATE POLICY "Anyone can view active payment methods"
  ON payment_methods FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can view all payment methods"
  ON payment_methods FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage payment methods"
  ON payment_methods FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- payment_method_fields
CREATE POLICY "Anyone can view fields of active methods"
  ON payment_method_fields FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM payment_methods
      WHERE id = payment_method_id AND is_active = true
    )
  );

CREATE POLICY "Admins can manage payment method fields"
  ON payment_method_fields FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- transaction_metadata
CREATE POLICY "Users can view their transaction metadata"
  ON transaction_metadata FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM transactions
      WHERE id = transaction_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all transaction metadata"
  ON transaction_metadata FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert their transaction metadata"
  ON transaction_metadata FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM transactions
      WHERE id = transaction_id AND user_id = auth.uid()
    )
  );

-- ============================================================================
-- 6. COMMENTAIRES
-- ============================================================================

COMMENT ON TABLE payment_categories IS 'Catégories de moyens de paiement (Mobile Money, Crypto, etc.)';
COMMENT ON TABLE payment_methods IS 'Méthodes de paiement configurables dynamiquement';
COMMENT ON TABLE payment_method_fields IS 'Champs personnalisables pour chaque méthode de paiement';
COMMENT ON TABLE transaction_metadata IS 'Métadonnées dynamiques des transactions selon la méthode utilisée';
