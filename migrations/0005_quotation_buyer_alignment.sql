-- Align quotation buyer identity and address fields with the invoice data model.
-- Existing quotation buyer_name held the contact person and buyer_company held the company name.
-- Preserve the old contact person, promote the company name to legal name, and leave trade name blank
-- rather than incorrectly treating the old company field as a trade name.
ALTER TABLE quotations ADD COLUMN buyer_city TEXT DEFAULT NULL;
ALTER TABLE quotations ADD COLUMN buyer_contact_person TEXT DEFAULT NULL;

UPDATE quotations
SET buyer_contact_person = NULLIF(TRIM(buyer_name), ''),
    buyer_name = COALESCE(NULLIF(TRIM(buyer_company), ''), buyer_name),
    buyer_company = NULL;

-- Force previously cached quotation PDFs to be regenerated with the aligned buyer fields.
UPDATE quotations SET pdf_r2_key = NULL, pdf_generated_at = NULL;
