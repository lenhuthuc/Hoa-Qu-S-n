-- Fix Address schema by dropping FK constraints and adding text columns for names
-- This is a pragmatic fix for the province/district/ward mismatch issue

ALTER TABLE addresses DROP CONSTRAINT IF EXISTS addresses_province_code_fkey;
ALTER TABLE addresses DROP CONSTRAINT IF EXISTS addresses_district_code_fkey;  
ALTER TABLE addresses DROP CONSTRAINT IF EXISTS addresses_ward_code_fkey;

ALTER TABLE addresses ADD COLUMN IF NOT EXISTS province_name VARCHAR(255);
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS district_name VARCHAR(255);
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS ward_name VARCHAR(255);

-- Also add GHN columns to provinces/districts/wards tables for future mapping
ALTER TABLE provinces ADD COLUMN IF NOT EXISTS ghn_province_id INTEGER;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS ghn_district_id INTEGER;
ALTER TABLE wards ADD COLUMN IF NOT EXISTS ghn_ward_code VARCHAR(20);
