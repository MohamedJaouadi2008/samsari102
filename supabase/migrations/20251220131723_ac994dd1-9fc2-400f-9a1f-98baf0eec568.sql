-- Add short_code column to properties table
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS short_code VARCHAR(8) UNIQUE;

-- Create function to generate property type digit
CREATE OR REPLACE FUNCTION get_property_type_digit(p_type TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN CASE 
    WHEN p_type = 'apartment' THEN 1
    WHEN p_type = 'house' THEN 2
    WHEN p_type = 'villa' THEN 3
    WHEN p_type = 'studio' THEN 4
    WHEN p_type = 'room' THEN 5
    WHEN p_type = 'cabin' THEN 6
    WHEN p_type = 'traditional' THEN 7
    ELSE 0
  END;
END;
$$;

-- Create function to generate unique short code
CREATE OR REPLACE FUNCTION generate_property_short_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  type_digit INTEGER;
  random_part INTEGER;
  new_code VARCHAR(8);
  code_exists BOOLEAN;
BEGIN
  -- Get property type digit
  type_digit := get_property_type_digit(NEW.property_type);
  
  -- Generate unique code
  LOOP
    -- Generate random 5-digit number (10000-99999)
    random_part := floor(random() * 90000 + 10000)::INTEGER;
    
    -- Build the code: 7 + type_digit + 5 random digits = 7 digits total
    new_code := '7' || type_digit::TEXT || random_part::TEXT;
    
    -- Check if code exists
    SELECT EXISTS(SELECT 1 FROM properties WHERE short_code = new_code) INTO code_exists;
    
    -- If not exists, use it
    IF NOT code_exists THEN
      NEW.short_code := new_code;
      EXIT;
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-generate short_code on insert
DROP TRIGGER IF EXISTS generate_short_code_trigger ON properties;
CREATE TRIGGER generate_short_code_trigger
  BEFORE INSERT ON properties
  FOR EACH ROW
  WHEN (NEW.short_code IS NULL)
  EXECUTE FUNCTION generate_property_short_code();

-- Generate short codes for existing properties that don't have one
DO $$
DECLARE
  prop RECORD;
  type_digit INTEGER;
  random_part INTEGER;
  new_code VARCHAR(8);
  code_exists BOOLEAN;
BEGIN
  FOR prop IN SELECT id, property_type FROM properties WHERE short_code IS NULL
  LOOP
    type_digit := get_property_type_digit(prop.property_type);
    
    LOOP
      random_part := floor(random() * 90000 + 10000)::INTEGER;
      new_code := '7' || type_digit::TEXT || random_part::TEXT;
      
      SELECT EXISTS(SELECT 1 FROM properties WHERE short_code = new_code) INTO code_exists;
      
      IF NOT code_exists THEN
        UPDATE properties SET short_code = new_code WHERE id = prop.id;
        EXIT;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_properties_short_code ON properties(short_code);