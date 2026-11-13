-- Quotation PDF persistence metadata.
-- The PDF binary is stored in the environment-specific R2 bucket; D1 stores only its object key and generation timestamp.
ALTER TABLE quotations ADD COLUMN pdf_r2_key TEXT DEFAULT NULL;
ALTER TABLE quotations ADD COLUMN pdf_generated_at TEXT DEFAULT NULL;
