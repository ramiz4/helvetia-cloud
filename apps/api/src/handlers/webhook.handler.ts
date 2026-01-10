import crypto from 'crypto';

/**
 * GitHub webhook signature verification
 * Verifies that a webhook request came from GitHub
 */
export function verifyGitHubSignature(
  payload: string | Buffer,
  signature: string,
  secret: string,
): boolean {
  if (!signature || !secret) {
    return false;
  }

  try {
    const hmac = crypto.createHmac('sha256', secret);
    const digest = 'sha256=' + hmac.update(payload).digest('hex');

    const signatureBuffer = Buffer.from(signature);
    const digestBuffer = Buffer.from(digest);
    if (signatureBuffer.length !== digestBuffer.length) {
      return false;
    }
    // Use timingSafeEqual to prevent timing attacks
    return crypto.timingSafeEqual(signatureBuffer, digestBuffer);
  } catch (error) {
    console.error('Error verifying GitHub signature:', error);
    return false;
  }
}
