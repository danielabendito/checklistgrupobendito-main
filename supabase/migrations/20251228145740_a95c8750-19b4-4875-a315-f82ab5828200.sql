-- Add enabled column to inspection_standards table
ALTER TABLE public.inspection_standards 
ADD COLUMN enabled boolean NOT NULL DEFAULT true;