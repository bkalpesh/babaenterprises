-- BABA ENTERPRISES — staging business profile and invoice seller snapshots
-- Adds the website/operating-hours master fields and freezes supplementary seller
-- details on invoices. Existing invoices are backfilled from the business profile
-- currently used to render them, preserving their displayed seller contact details.

ALTER TABLE business_settings
  ADD COLUMN website_url TEXT NOT NULL DEFAULT 'https://www.babaenterprises.in';

ALTER TABLE business_settings
  ADD COLUMN operating_hours TEXT NOT NULL DEFAULT 'Mon - Sat: 9:00 AM - 7:00 PM IST';

ALTER TABLE invoices ADD COLUMN seller_pan TEXT;
ALTER TABLE invoices ADD COLUMN seller_state_name TEXT;
ALTER TABLE invoices ADD COLUMN seller_address_line1 TEXT;
ALTER TABLE invoices ADD COLUMN seller_address_line2 TEXT;
ALTER TABLE invoices ADD COLUMN seller_city TEXT;
ALTER TABLE invoices ADD COLUMN seller_pincode TEXT;
ALTER TABLE invoices ADD COLUMN seller_phone_primary TEXT;
ALTER TABLE invoices ADD COLUMN seller_phone_secondary TEXT;
ALTER TABLE invoices ADD COLUMN seller_email TEXT;
ALTER TABLE invoices ADD COLUMN seller_website_url TEXT;

-- Preserve the seller contact information that existing invoice HTML currently
-- displays before switching issued/cancelled invoices to immutable snapshots.
UPDATE invoices SET
  seller_pan = (SELECT pan FROM business_settings WHERE id = 1),
  seller_state_name = (SELECT state_name FROM business_settings WHERE id = 1),
  seller_address_line1 = (SELECT address_line1 FROM business_settings WHERE id = 1),
  seller_address_line2 = (SELECT address_line2 FROM business_settings WHERE id = 1),
  seller_city = (SELECT city FROM business_settings WHERE id = 1),
  seller_pincode = (SELECT pincode FROM business_settings WHERE id = 1),
  seller_phone_primary = (SELECT phone_primary FROM business_settings WHERE id = 1),
  seller_phone_secondary = (SELECT phone_secondary FROM business_settings WHERE id = 1),
  seller_email = (SELECT email FROM business_settings WHERE id = 1),
  seller_website_url = (SELECT website_url FROM business_settings WHERE id = 1);

-- Supplement the existing invoice immutability trigger for the newly-added
-- seller snapshot columns. This protects both Issued and Cancelled legal records.
CREATE TRIGGER trg_invoice_seller_contact_snapshot_immutable
BEFORE UPDATE OF
  seller_pan, seller_state_name, seller_address_line1, seller_address_line2,
  seller_city, seller_pincode, seller_phone_primary, seller_phone_secondary,
  seller_email, seller_website_url
ON invoices
WHEN OLD.status IN ('Issued', 'Cancelled')
 AND (
   NEW.seller_pan IS NOT OLD.seller_pan
   OR NEW.seller_state_name IS NOT OLD.seller_state_name
   OR NEW.seller_address_line1 IS NOT OLD.seller_address_line1
   OR NEW.seller_address_line2 IS NOT OLD.seller_address_line2
   OR NEW.seller_city IS NOT OLD.seller_city
   OR NEW.seller_pincode IS NOT OLD.seller_pincode
   OR NEW.seller_phone_primary IS NOT OLD.seller_phone_primary
   OR NEW.seller_phone_secondary IS NOT OLD.seller_phone_secondary
   OR NEW.seller_email IS NOT OLD.seller_email
   OR NEW.seller_website_url IS NOT OLD.seller_website_url
 )
BEGIN
  SELECT RAISE(ABORT, 'ERR_ISSUED_INVOICE_SELLER_SNAPSHOT_IMMUTABLE: Seller details on issued or cancelled invoices cannot be changed.');
END;
