import type { FastifyReply, FastifyRequest } from 'fastify';
import { inject, injectable } from 'tsyringe';
import { ZodError } from 'zod';
import { TOKENS } from '../di/tokens.js';
import { AcceptTermsSchema, GetTermsSchema } from '../schemas/terms.schema.js';
import type { TermsService } from '../services/index.js';
import { formatZodError } from '../utils/errorFormatting.js';

/**
 * TermsController
 * Handles all Terms of Service related HTTP endpoints
 */
@injectable()
export class TermsController {
  constructor(
    @inject(TOKENS.TermsService)
    private termsService: TermsService,
  ) {}

  /**
   * Get the latest version of terms for a specific language
   */
  async getLatestTerms(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { language = 'en' } = request.query as { language?: string };

      const terms = await this.termsService.getLatestTerms(language);

      if (!terms) {
        return reply.code(404).send({
          success: false,
          error: `No terms of service found for language: ${language}`,
        });
      }

      return reply.send({
        success: true,
        data: {
          id: terms.id,
          version: terms.version,
          content: terms.content,
          language: terms.language,
          effectiveAt: terms.effectiveAt,
          createdAt: terms.createdAt,
          updatedAt: terms.updatedAt,
        },
      });
    } catch (error) {
      request.log.error(error, 'Failed to get latest terms');
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve terms of service',
      });
    }
  }

  /**
   * Get terms by specific version and language
   */
  async getTermsByVersion(request: FastifyRequest, reply: FastifyReply) {
    try {
      const validatedQuery = GetTermsSchema.parse(request.query);
      const { version, language = 'en' } = validatedQuery;

      const terms = await this.termsService.getTermsByVersion(version, language);

      if (!terms) {
        return reply.code(404).send({
          success: false,
          error: `Terms of service version ${version} not found for language: ${language}`,
        });
      }

      return reply.send({
        success: true,
        data: {
          id: terms.id,
          version: terms.version,
          content: terms.content,
          language: terms.language,
          effectiveAt: terms.effectiveAt,
          createdAt: terms.createdAt,
          updatedAt: terms.updatedAt,
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

      request.log.error(error, 'Failed to get terms by version');
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve terms of service',
      });
    }
  }

  /**
   * Get all versions of terms for a specific language
   */
  async getAllVersions(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { language = 'en' } = request.query as { language?: string };

      const versions = await this.termsService.getAllVersions(language);

      return reply.send({
        success: true,
        data: versions.map((terms) => ({
          id: terms.id,
          version: terms.version,
          language: terms.language,
          effectiveAt: terms.effectiveAt,
          createdAt: terms.createdAt,
        })),
      });
    } catch (error) {
      request.log.error(error, 'Failed to get all terms versions');
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve terms versions',
      });
    }
  }

  /**
   * Accept terms of service (authenticated endpoint)
   */
  async acceptTerms(request: FastifyRequest, reply: FastifyReply) {
    try {
      const validatedBody = AcceptTermsSchema.parse(request.body);
      const { termsVersionId } = validatedBody;

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
      const acceptance = await this.termsService.acceptTerms({
        userId: user.id,
        termsVersionId,
        ipAddress,
        userAgent,
      });

      return reply.code(201).send({
        success: true,
        data: {
          id: acceptance.id,
          userId: acceptance.userId,
          termsVersionId: acceptance.termsVersionId,
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

      request.log.error(error, 'Failed to accept terms');
      return reply.code(500).send({
        success: false,
        error: 'Failed to record terms acceptance',
      });
    }
  }

  /**
   * Check if user has accepted latest terms (authenticated endpoint)
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

      const requiresAcceptance = await this.termsService.requiresAcceptance(user.id, language);
      const latestTerms = await this.termsService.getLatestTerms(language);

      return reply.send({
        success: true,
        data: {
          requiresAcceptance,
          latestVersion: latestTerms
            ? {
                id: latestTerms.id,
                version: latestTerms.version,
                content: latestTerms.content,
                effectiveAt: latestTerms.effectiveAt,
              }
            : null,
        },
      });
    } catch (error) {
      request.log.error(error, 'Failed to check terms acceptance');
      return reply.code(500).send({
        success: false,
        error: 'Failed to check terms acceptance status',
      });
    }
  }
}
