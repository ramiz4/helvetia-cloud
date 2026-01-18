-- Add constraint to ensure users have at least one authentication method
-- Users must have either a GitHub ID OR email with password
ALTER TABLE "User" ADD CONSTRAINT "user_has_auth_method" 
CHECK ("githubId" IS NOT NULL OR ("email" IS NOT NULL AND "password" IS NOT NULL));
