-- Separate public website visibility from catalogue/invoicing availability.
-- Existing products remain visible by default.
ALTER TABLE products ADD COLUMN show_on_website INTEGER NOT NULL DEFAULT 1 CHECK (show_on_website IN (0, 1));
