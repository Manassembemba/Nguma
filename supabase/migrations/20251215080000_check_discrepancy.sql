
-- 1. Compare Treasury vs Net Deposits
WITH 
actual_deposits AS (
    SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'deposit' AND status = 'completed'
),
actual_withdrawals AS (
    SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'withdrawal' AND status = 'completed'
),
treasury_balance AS (
    SELECT COALESCE(SUM(balance), 0) as total FROM company_accounts WHERE type = 'asset'
)
SELECT 
    d.total as "Total Deposits (Transactions)",
    w.total as "Total Withdrawals (Transactions)",
    (d.total - w.total) as "Theoretical Treasury",
    t.total as "Actual Treasury (Company Accounts)",
    (t.total - (d.total - w.total)) as "Difference"
FROM actual_deposits d, actual_withdrawals w, treasury_balance t;

-- 2. Find Deposits lacking accounting entries
SELECT *
FROM transactions t
WHERE t.type = 'deposit' 
AND t.status = 'completed'
AND NOT EXISTS (
    SELECT 1 FROM accounting_entries ae 
    WHERE ae.related_transaction_id = t.id
);
