-- Migration: Fix Profit Calculations in Dashboard RPCs
-- Date: 2026-04-10
-- Description: Remplace le taux fixe de 15% par le taux réel du contrat (monthly_rate) pour les prévisions et le ROI.

-- 1. Correction de calculate_contract_roi
CREATE OR REPLACE FUNCTION public.calculate_contract_roi(p_contract_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_contract_amount NUMERIC(20,8);
    v_profits_paid NUMERIC(20,8);
    v_months_paid INT;
    v_duration INT;
    v_monthly_rate NUMERIC(10,8);
    v_roi NUMERIC(10,2);
    v_projected_total NUMERIC(20,8);
    v_result JSON;
BEGIN
    -- Récupération des détails du contrat
    SELECT amount, total_profit_paid, months_paid, duration_months, monthly_rate
    INTO v_contract_amount, v_profits_paid, v_months_paid, v_duration, v_monthly_rate
    FROM public.contracts
    WHERE id = p_contract_id;

    IF v_contract_amount IS NULL THEN
        RETURN json_build_object('error', 'Contract not found');
    END IF;

    -- Calcul du ROI actuel
    v_roi := (v_profits_paid / v_contract_amount) * 100;

    -- Calcul du total projeté à maturité en utilisant le taux mensuel RÉEL du contrat
    -- Si le taux est nul, on utilise 0.15 (15%) par défaut pour éviter les erreurs
    v_projected_total := v_contract_amount + (v_contract_amount * COALESCE(v_monthly_rate, 0.15) * v_duration);

    -- Construction du résultat
    v_result := json_build_object(
        'contract_amount', v_contract_amount,
        'profits_paid', v_profits_paid,
        'months_paid', v_months_paid,
        'duration_months', v_duration,
        'current_roi', ROUND(v_roi, 2),
        'projected_total', v_projected_total,
        'projected_roi', ROUND(((v_projected_total - v_contract_amount) / v_contract_amount) * 100, 2),
        'progress_percentage', ROUND((v_months_paid::NUMERIC / v_duration::NUMERIC) * 100, 2)
    );

    RETURN v_result;
END;
$$;

-- 2. Correction de get_upcoming_payments
CREATE OR REPLACE FUNCTION public.get_upcoming_payments(p_user_id UUID, p_limit INT DEFAULT 5)
RETURNS TABLE (
    contract_id UUID,
    contract_number TEXT,
    next_payment_date DATE,
    estimated_amount NUMERIC(20,8),
    months_remaining INT,
    status TEXT
)
LANGUAGE sql
STABLE
AS $$
    WITH calculated_dates AS (
      SELECT
          c.id,
          c.user_id,
          c.amount,
          c.monthly_rate,
          c.start_date,
          c.duration_months,
          c.months_paid,
          c.status,
          -- Calcule la date anniversaire de paiement pour le mois en cours
          (c.start_date + (
              (EXTRACT(YEAR FROM age(now(), c.start_date)) * 12 + EXTRACT(MONTH FROM age(now(), c.start_date)))
              || ' months'
          )::INTERVAL)::DATE as anniversary_date
      FROM
          public.contracts c
      WHERE
          c.user_id = p_user_id
          AND c.status = 'active'
          AND c.months_paid < c.duration_months
    )
    SELECT
        cd.id as contract_id,
        SUBSTRING(cd.id::TEXT, 1, 8) as contract_number,
        -- Si la date anniversaire est passée, on prend celle du mois prochain, sinon on garde la date anniversaire
        CASE
            WHEN cd.anniversary_date <= now()::DATE THEN
                (cd.anniversary_date + '1 month'::INTERVAL)::DATE
            ELSE
                cd.anniversary_date
        END as next_payment_date,
        -- Utilisation du taux réel (monthly_rate) au lieu de 0.15 fixe
        cd.amount * COALESCE(cd.monthly_rate, 0.15) as estimated_amount,
        cd.duration_months - cd.months_paid as months_remaining,
        cd.status
    FROM calculated_dates cd
    ORDER BY next_payment_date ASC
    LIMIT p_limit;
$$;
