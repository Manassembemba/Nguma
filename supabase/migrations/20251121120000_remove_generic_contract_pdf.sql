-- Remove the generic_contract_pdf_url setting
DELETE FROM public.settings WHERE key = 'generic_contract_pdf_url';
