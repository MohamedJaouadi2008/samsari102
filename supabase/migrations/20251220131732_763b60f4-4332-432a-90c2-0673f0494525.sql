-- Fix search_path for the functions to address security warnings
ALTER FUNCTION get_property_type_digit(TEXT) SET search_path = public;
ALTER FUNCTION generate_property_short_code() SET search_path = public;