-- Fonction pour débiter un utilisateur pour des services internes avec priorité sur les profits, puis sur le capital des contrats
CREATE OR REPLACE FUNCTION public.admin_deduct_service_fee(
    p_user_id UUID,
    p_amount NUMERIC,
    p_reason TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_remaining_amount NUMERIC := p_amount;
    v_profit_balance NUMERIC;
    v_prelev_profit NUMERIC;
    v_contract RECORD;
    v_contract_net_capital NUMERIC;
    v_prelev_contract NUMERIC;
    v_total_available NUMERIC;
BEGIN
    -- 1. Récupérer le profit disponible du wallet
    SELECT COALESCE(profit_balance, 0) INTO v_profit_balance FROM wallets WHERE user_id = p_user_id;

    -- 2. Calculer le total disponible pour valider la faisabilité
    SELECT COALESCE(v_profit_balance, 0) + COALESCE(SUM(amount), 0) INTO v_total_available
    FROM contracts 
    WHERE user_id = p_user_id AND status IN ('active', 'paused');

    IF v_total_available < p_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Fonds insuffisants');
    END IF;

    -- 3. Débit priorisé sur les profits (Wallet)
    IF v_profit_balance > 0 THEN
        v_prelev_profit := LEAST(v_remaining_amount, v_profit_balance);
        UPDATE wallets SET profit_balance = profit_balance - v_prelev_profit WHERE user_id = p_user_id;
        
        -- Enregistrement transaction profit
        INSERT INTO transactions (user_id, type, amount, status, description)
        VALUES (p_user_id, 'service_fee', v_prelev_profit, 'completed', 'Défalcation de profit: ' || p_reason);
        
        v_remaining_amount := v_remaining_amount - v_prelev_profit;
    END IF;

    -- 4. Débit sur les contrats (si besoin)
    IF v_remaining_amount > 0 THEN
        FOR v_contract IN 
            SELECT * FROM contracts 
            WHERE user_id = p_user_id AND status IN ('active', 'paused')
            ORDER BY created_at ASC
        LOOP
            v_contract_net_capital := v_contract.amount;

            IF v_remaining_amount >= v_contract_net_capital THEN
                -- Épuisement total du contrat -> Clôture
                v_prelev_contract := v_contract_net_capital;
                UPDATE contracts SET status = 'closed', amount = 0 WHERE id = v_contract.id;
            ELSE
                -- Épuisement partiel
                v_prelev_contract := v_remaining_amount;
                UPDATE contracts SET amount = amount - v_prelev_contract WHERE id = v_contract.id;
            END IF;

            -- Enregistrement transaction contrat
            INSERT INTO transactions (user_id, type, amount, status, description, reference_id)
            VALUES (p_user_id, 'service_fee', v_prelev_contract, 'completed', 'Défalcation de capital: ' || p_reason, v_contract.id);

            v_remaining_amount := v_remaining_amount - v_prelev_contract;
            
            EXIT WHEN v_remaining_amount <= 0;
        END LOOP;
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$;
