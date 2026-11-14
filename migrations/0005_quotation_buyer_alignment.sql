-- Add the invoice-aligned buyer fields to quotations.
-- Existing quotation records remain version 1 so historical documents retain their original meaning.
-- New and edited quotations use buyer_fields_version = 2.
ALTER TABLE quotations ADD COLUMN buyer_city TEXT DEFAULT NULL;
ALTER TABLE quotations ADD COLUMN buyer_contact_person TEXT DEFAULT NULL;
ALTER TABLE quotations ADD COLUMN buyer_fields_version INTEGER NOT NULL DEFAULT 1
  CHECK (buyer_fields_version IN (1, 2));
