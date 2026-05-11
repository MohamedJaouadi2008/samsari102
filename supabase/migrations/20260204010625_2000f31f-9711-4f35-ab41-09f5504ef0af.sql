-- Delete orphaned ID verification record from November 2025 that references non-existent R2 files
DELETE FROM id_verifications 
WHERE id = 'f1d2d430-4942-4446-9633-f145708e4b79';