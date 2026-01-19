import type { FastifyReply, FastifyRequest } from 'fastify';
import { inject, injectable } from 'tsyringe';
import { ZodError } from 'zod';
import { TOKENS } from '../di/tokens.js';
import {
  AcceptPrivacyPolicySchema,
  GetPrivacyPolicySchema,
} from '../schemas/privacy-policy.schema.js';
import type { PrivacyPolicyService } from '../services/index.js';
import { formatZodError } from '../utils/errorFormatting.js';

/**
 * PrivacyPolicyController
 * Handles all Privacy Policy related HTTP endpoints
 */
@injectable()
export class PrivacyPolicyController {
  constructor(
    @inject(TOKENS.PrivacyPolicyService)
    private privacyPolicyService: PrivacyPolicyService,
  ) {}

  /**
   * Get the latest version of privacy policy for a specific language
   */
  async getLatestPrivacyPolicy(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { language = 'en' } = request.query as { language?: string };

      const policy = await this.privacyPolicyService.getLatestPrivacyPolicy(language);

      if (!policy) {
        return reply.code(404).send({
          success: false,
          error: `No privacy policy found for language: ${language}`,
        });
      }

      return reply.send({
        success: true,
        data: {
          id: policy.id,
          version: policy.version,
          content: policy.content,
          language: policy.language,
          effectiveAt: policy.effectiveAt,
          createdAt: policy.createdAt,
          updatedAt: policy.updatedAt,
        },
      });
    } catch (error) {
      request.log.error(error, 'Failed to get latest privacy policy');
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve privacy policy',
      });
    }
  }

  /**
   * Get privacy policy by specific version and language
   */
  async getPrivacyPolicyByVersion(request: FastifyRequest, reply: FastifyReply) {
    try {
      const validatedQuery = GetPrivacyPolicySchema.parse(request.query);
      const { version, language = 'en' } = validatedQuery;

      const policy = await this.privacyPolicyService.getPrivacyPolicyByVersion(version, language);

      if (!policy) {
        return reply.code(404).send({
          success: false,
          error: `Privacy policy version ${version} not found for language: ${language}`,
        });
      }

      return reply.send({
        success: true,
        data: {
          id: policy.id,
          version: policy.version,
          content: policy.content,
          language: policy.language,
          effectiveAt: policy.effectiveAt,
          createdAt: policy.createdAt,
          updatedAt: policy.updatedAt,
        },
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({
          success: false,
          error: 'Validation failed',
          details: formatZodError(error),
        });
      }

      request.log.error(error, 'Failed to get privacy policy by version');
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve privacy policy',
      });
    }
  }

  /**
   * Get all versions of privacy policy for a specific language
   */
  async getAllVersions(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { language = 'en' } = request.query as { language?: string };

      const versions = await this.privacyPolicyService.getAllVersions(language);

      return reply.send({
        success: true,
        data: versions.map((policy) => ({
          id: policy.id,
          version: policy.version,
          language: policy.language,
          effectiveAt: policy.effectiveAt,
          createdAt: policy.createdAt,
        })),
      });
    } catch (error) {
      request.log.error(error, 'Failed to get all privacy policy versions');
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve privacy policy versions',
      });
    }
  }

  /**
   * Accept privacy policy (authenticated endpoint)
   */
  async acceptPrivacyPolicy(request: FastifyRequest, reply: FastifyReply) {
    try {
      const validatedBody = AcceptPrivacyPolicySchema.parse(request.body);
      const { privacyPolicyVersionId } = validatedBody;

      // Get user from authenticated request
      const user = request.user;
      if (!user || !user.id) {
        return reply.code(401).send({
          success: false,
          error: 'Authentication required',
        });
      }

      // Get client IP and user agent
      const ipAddress = request.ip;
      const userAgent = request.headers['user-agent'];

      // Record acceptance
      const acceptance = await this.privacyPolicyService.acceptPrivacyPolicy({
        userId: user.id,
        privacyPolicyVersionId,
        ipAddress,
        userAgent,
      });

      return reply.code(201).send({
        success: true,
        data: {
          id: acceptance.id,
          userId: acceptance.userId,
          privacyPolicyVersionId: acceptance.privacyPolicyVersionId,
          acceptedAt: acceptance.acceptedAt,
        },
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({
          success: false,
          error: 'Validation failed',
          details: formatZodError(error),
        });
      }

      request.log.error(error, 'Failed to accept privacy policy');
      return reply.code(500).send({
        success: false,
        error: 'Failed to record privacy policy acceptance',
      });
    }
  }

  /**
   * Check if user has accepted latest privacy policy (authenticated endpoint)
   */
  async checkAcceptance(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = request.user;
      if (!user || !user.id) {
        return reply.code(401).send({
          success: false,
          error: 'Authentication required',
        });
      }

      const { language = 'en' } = request.query as { language?: string };

      const requiresAcceptance = await this.privacyPolicyService.requiresAcceptance(
        user.id,
        language,
      );
      const latestPolicy = await this.privacyPolicyService.getLatestPrivacyPolicy(language);

      return reply.send({
        success: true,
        data: {
          requiresAcceptance,
          latestVersion: latestPolicy
            ? {
                id: latestPolicy.id,
                version: latestPolicy.version,
                effectiveAt: latestPolicy.effectiveAt,
              }
            : null,
        },
      });
    } catch (error) {
      request.log.error(error, 'Failed to check privacy policy acceptance');
      return reply.code(500).send({
        success: false,
        error: 'Failed to check privacy policy acceptance status',
      });
    }
  }
}
