-- Migration: Implémentation de la suppression sèche de contrat
-- Date: 2026-05-13
-- Description: Assure que la suppression d'un contrat déduit le montant du invested_balance 
--              sans rembourser l'utilisateur (perte sèche du capital).

-- 1. Fonction de trigger pour ajuster le solde lors d'une suppression
CREATE OR REPLACE FUNCTION public.handle_contract_deletion()
RETURNS TRIGGER AS $$
BEGIN
    -- Déduire le montant du contrat du capital investi
    -- Note: total_balance n'est pas touché, donc l'argent n'est pas rendu.
    UPDATE public.wallets 
    SET invested_balance = GREATEST(0, invested_balance - OLD.amount),
        updated_at = now()
    WHERE user_id = OLD.user_id;

    -- Logger l'action dans les audits si la table existe
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
        INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, old_values, metadata)
        VALUES (
            auth.uid(), 
            'contract.hard_delete', 
            'contract', 
            OLD.id, 
            row_to_json(OLD)::jsonb,
            jsonb_build_object('reason', 'Suppression manuelle par admin')
        );
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Création du trigger
DROP TRIGGER IF EXISTS trigger_on_contract_delete ON public.contracts;
CREATE TRIGGER trigger_on_contract_delete
BEFORE DELETE ON public.contracts
FOR EACH ROW
EXECUTE FUNCTION public.handle_contract_deletion();

-- 3. Fonction RPC pour l'administration (appelée par le frontend)
CREATE OR REPLACE FUNCTION public.admin_delete_contract(p_contract_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_contract_exists BOOLEAN;
BEGIN
    -- Vérification des droits admin
    IF NOT public.is_admin(auth.uid()) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Accès refusé. Droits administrateur requis.');
    END IF;

    -- Vérifier si le contrat existe
    SELECT EXISTS(SELECT 1 FROM public.contracts WHERE id = p_contract_id) INTO v_contract_exists;
    IF NOT v_contract_exists THEN
        RETURN jsonb_build_object('success', false, 'error', 'Contrat non trouvé.');
    END IF;

    -- Suppression (déclenchera le trigger handle_contract_deletion)
    DELETE FROM public.contracts WHERE id = p_contract_id;

    RETURN jsonb_build_object('success', true, 'message', 'Le contrat a été supprimé définitivement et le capital investi a été déduit du portefeuille.');
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Attribution des permissions
GRANT EXECUTE ON FUNCTION public.admin_delete_contract(UUID) TO authenticated;
