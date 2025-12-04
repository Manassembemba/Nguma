-- Migration: Ajout des champs de réception pour les retraits
-- Date: 2025-12-04
-- Description: Ajoute des champs pour que les utilisateurs puissent indiquer où recevoir leur argent lors des retraits

DO $$
DECLARE
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
  -- ============================================================================
  -- Récupérer les IDs des méthodes existantes
  -- ============================================================================
  
  SELECT id INTO method_mpesa FROM payment_methods WHERE code = 'mpesa_rdc';
  SELECT id INTO method_airtel FROM payment_methods WHERE code = 'airtel_money_rdc';
  SELECT id INTO method_orange FROM payment_methods WHERE code = 'orange_money_rdc';
  SELECT id INTO method_binance FROM payment_methods WHERE code = 'binance_id';
  SELECT id INTO method_usdt FROM payment_methods WHERE code = 'usdt_trc20';
  SELECT id INTO method_western FROM payment_methods WHERE code = 'western_union';
  SELECT id INTO method_moneygram FROM payment_methods WHERE code = 'moneygram';
  SELECT id INTO method_ria FROM payment_methods WHERE code = 'ria';
  SELECT id INTO method_ecobank FROM payment_methods WHERE code = 'ecobank';
  SELECT id INTO method_equity FROM payment_methods WHERE code = 'equity_bank';

  -- ============================================================================
  -- MOBILE MONEY - Champs pour recevoir de l'argent
  -- ============================================================================
  
  -- M-Pesa
  IF method_mpesa IS NOT NULL THEN
    INSERT INTO payment_method_fields (payment_method_id, field_key, field_label, field_type, field_placeholder, is_required, is_user_input, display_order, help_text)
    VALUES 
      (method_mpesa, 'recipient_number', 'Votre numéro M-Pesa (réception)', 'tel', '+243XXXXXXXXX', true, true, 10, 'Le numéro M-Pesa où vous souhaitez recevoir le retrait');
  END IF;

  -- Airtel Money
  IF method_airtel IS NOT NULL THEN
    INSERT INTO payment_method_fields (payment_method_id, field_key, field_label, field_type, field_placeholder, is_required, is_user_input, display_order, help_text)
    VALUES 
      (method_airtel, 'recipient_number', 'Votre numéro Airtel Money (réception)', 'tel', '+243XXXXXXXXX', true, true, 10, 'Le numéro Airtel Money où vous souhaitez recevoir le retrait');
  END IF;

  -- Orange Money
  IF method_orange IS NOT NULL THEN
    INSERT INTO payment_method_fields (payment_method_id, field_key, field_label, field_type, field_placeholder, is_required, is_user_input, display_order, help_text)
    VALUES 
      (method_orange, 'recipient_number', 'Votre numéro Orange Money (réception)', 'tel', '+243XXXXXXXXX', true, true, 10, 'Le numéro Orange Money où vous souhaitez recevoir le retrait');
  END IF;

  -- ============================================================================
  -- CRYPTOMONNAIES - Champs pour recevoir de l'argent
  -- ============================================================================
  
  -- Binance ID
  IF method_binance IS NOT NULL THEN
    INSERT INTO payment_method_fields (payment_method_id, field_key, field_label, field_type, field_placeholder, is_required, is_user_input, display_order, help_text)
    VALUES 
      (method_binance, 'recipient_binance_id', 'Votre Binance ID (réception)', 'text', 'Ex: 123456789', true, true, 10, 'Votre identifiant Binance Pay où vous souhaitez recevoir le retrait'),
      (method_binance, 'recipient_email', 'Votre email Binance', 'email', 'exemple@email.com', false, true, 11, 'L''email associé à votre compte Binance (optionnel)');
  END IF;

  -- USDT TRC20
  IF method_usdt IS NOT NULL THEN
    INSERT INTO payment_method_fields (payment_method_id, field_key, field_label, field_type, field_placeholder, is_required, is_user_input, display_order, help_text)
    VALUES 
      (method_usdt, 'recipient_wallet', 'Votre adresse USDT TRC20 (réception)', 'text', 'TXXXxxxXXXxxxXXXxxxXXXxxxXXXxxx', true, true, 10, 'Votre adresse de wallet USDT (TRC20) où vous souhaitez recevoir le retrait. Doit commencer par ''T''');
  END IF;

  -- ============================================================================
  -- TRANSFERTS INTERNATIONAUX - Champs pour recevoir de l'argent
  -- ============================================================================
  
  -- Western Union
  IF method_western IS NOT NULL THEN
    INSERT INTO payment_method_fields (payment_method_id, field_key, field_label, field_type, field_placeholder, is_required, is_user_input, display_order, help_text)
    VALUES 
      (method_western, 'recipient_full_name', 'Votre nom complet (réception)', 'text', 'Prénom NOM', true, true, 10, 'Votre nom complet EXACTEMENT comme sur votre pièce d''identité'),
      (method_western, 'recipient_country', 'Pays de réception', 'text', 'Ex: RD Congo', true, true, 11, 'Le pays où vous souhaitez récupérer le retrait'),
      (method_western, 'recipient_city', 'Ville de réception', 'text', 'Ex: Kinshasa', true, true, 12, 'La ville où vous souhaitez récupérer le retrait');
  END IF;

  -- MoneyGram
  IF method_moneygram IS NOT NULL THEN
    INSERT INTO payment_method_fields (payment_method_id, field_key, field_label, field_type, field_placeholder, is_required, is_user_input, display_order, help_text)
    VALUES 
      (method_moneygram, 'recipient_full_name', 'Votre nom complet (réception)', 'text', 'Prénom NOM', true, true, 10, 'Votre nom complet EXACTEMENT comme sur votre pièce d''identité'),
      (method_moneygram, 'recipient_country', 'Pays de réception', 'text', 'Ex: RD Congo', true, true, 11, 'Le pays où vous souhaitez récupérer le retrait'),
      (method_moneygram, 'recipient_city', 'Ville de réception', 'text', 'Ex: Kinshasa', true, true, 12, 'La ville où vous souhaitez récupérer le retrait');
  END IF;

  -- Ria Money Transfer
  IF method_ria IS NOT NULL THEN
    INSERT INTO payment_method_fields (payment_method_id, field_key, field_label, field_type, field_placeholder, is_required, is_user_input, display_order, help_text)
    VALUES 
      (method_ria, 'recipient_full_name', 'Votre nom complet (réception)', 'text', 'Prénom NOM', true, true, 10, 'Votre nom complet EXACTEMENT comme sur votre pièce d''identité'),
      (method_ria, 'recipient_country', 'Pays de réception', 'text', 'Ex: RD Congo', true, true, 11, 'Le pays où vous souhaitez récupérer le retrait'),
      (method_ria, 'recipient_city', 'Ville de réception', 'text', 'Ex: Kinshasa', true, true, 12, 'La ville où vous souhaitez récupérer le retrait');
  END IF;

  -- ============================================================================
  -- VIREMENTS BANCAIRES - Champs pour recevoir de l'argent
  -- ============================================================================
  
  -- Ecobank
  IF method_ecobank IS NOT NULL THEN
    INSERT INTO payment_method_fields (payment_method_id, field_key, field_label, field_type, field_placeholder, is_required, is_user_input, display_order, help_text)
    VALUES 
      (method_ecobank, 'recipient_account', 'Votre numéro de compte Ecobank (réception)', 'text', 'Ex: 35400001234', true, true, 10, 'Le numéro de compte Ecobank où vous souhaitez recevoir le retrait'),
      (method_ecobank, 'recipient_account_name', 'Intitulé de votre compte', 'text', 'Nom du titulaire', true, true, 11, 'Le nom du titulaire du compte (exactement comme enregistré à la banque)');
  END IF;

  -- Equity Bank
  IF method_equity IS NOT NULL THEN
    INSERT INTO payment_method_fields (payment_method_id, field_key, field_label, field_type, field_placeholder, is_required, is_user_input, display_order, help_text)
    VALUES 
      (method_equity, 'recipient_account', 'Votre numéro de compte Equity Bank (réception)', 'text', 'Ex: 511200177035070', true, true, 10, 'Le numéro de compte Equity Bank où vous souhaitez recevoir le retrait'),
      (method_equity, 'recipient_account_name', 'Intitulé de votre compte', 'text', 'Nom du titulaire', true, true, 11, 'Le nom du titulaire du compte (exactement comme enregistré à la banque)');
  END IF;

END $$;

-- ============================================================================
-- Commentaires pour documentation
-- ============================================================================

COMMENT ON TABLE payment_method_fields IS 
'Champs dynamiques pour les méthodes de paiement. 
Les champs avec is_user_input=false sont affichés aux utilisateurs (infos de la plateforme).
Les champs avec is_user_input=true et contenant "sender/transaction/proof" sont pour les DÉPÔTS.
Les champs avec is_user_input=true et contenant "recipient" sont pour les RETRAITS.';
