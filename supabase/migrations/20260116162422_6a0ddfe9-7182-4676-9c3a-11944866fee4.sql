-- Delete orphaned rejected verification record (user has newer approved verification)
DELETE FROM id_verifications 
WHERE id = '9ef8e041-3006-44a1-a96c-1883958c143e' 
  AND status = 'rejected';