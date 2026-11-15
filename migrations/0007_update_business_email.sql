-- Update the official BABA ENTERPRISES contact email used by invoices and business settings.
-- Safe conditional update: preserve any administrator-customized address that is not the old default.
UPDATE business_settings
SET email = 'babarubberplasticproducts@gmail.com',
    updated_at = datetime('now')
WHERE id = 1
  AND lower(trim(coalesce(email, ''))) = 'babaenterprises09@gmail.com';
