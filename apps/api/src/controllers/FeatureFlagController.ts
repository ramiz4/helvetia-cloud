import type { FastifyReply, FastifyRequest } from 'fastify';
import { inject, injectable } from 'tsyringe';
import { ZodError } from 'zod';
import { TOKENS } from '../di/tokens';
import {
  CheckFlagSchema,
  CreateFlagSchema,
  UpdateFlagSchema,
} from '../schemas/feature-flag.schema';
import type { FeatureFlagService } from '../services';

/**
 * FeatureFlagController
 * Handles all feature flag related HTTP endpoints
 */
@injectable()
export class FeatureFlagController {
  constructor(
    @inject(TOKENS.FeatureFlagService)
    private featureFlagService: FeatureFlagService,
  ) {}

  /**
   * Get all feature flags
   */
  async getAllFlags(request: FastifyRequest, reply: FastifyReply) {
    try {
      const flags = await this.featureFlagService.getAllFlags();
      return reply.send({ success: true, data: flags });
    } catch (error) {
      request.log.error(error, 'Failed to get feature flags');
      return reply.code(500).send({ success: false, error: 'Failed to get feature flags' });
    }
  }

  /**
   * Get a feature flag by ID
   */
  async getFlagById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const flag = await this.featureFlagService.getFlagById(id);

      if (!flag) {
        return reply.code(404).send({ success: false, error: 'Feature flag not found' });
      }

      return reply.send({ success: true, data: flag });
    } catch (error) {
      request.log.error(error, 'Failed to get feature flag');
      return reply.code(500).send({ success: false, error: 'Failed to get feature flag' });
    }
  }

  /**
   * Create a new feature flag
   */
  async createFlag(request: FastifyRequest, reply: FastifyReply) {
    try {
      const validatedData = CreateFlagSchema.parse(request.body);
      const flag = await this.featureFlagService.createFlag(validatedData);

      return reply.code(201).send({ success: true, data: flag });
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({
          success: false,
          error: 'Validation failed',
          details: error.issues.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }

      console.error('Error creating feature flag:', error);
      request.log.error(error, 'Failed to create feature flag');
      if (error instanceof Error && error.message.includes('already exists')) {
        return reply.code(409).send({ success: false, error: error.message });
      }
      return reply.code(500).send({ success: false, error: 'Failed to create feature flag' });
    }
  }

  /**
   * Update an existing feature flag
   */
  async updateFlag(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const validatedData = UpdateFlagSchema.parse(request.body);
      const flag = await this.featureFlagService.updateFlag(id, validatedData);

      return reply.send({ success: true, data: flag });
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({
          success: false,
          error: 'Validation failed',
          details: error.issues.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }

      request.log.error(error, 'Failed to update feature flag');
      if (error instanceof Error && error.message.includes('not found')) {
        return reply.code(404).send({ success: false, error: error.message });
      }
      return reply.code(500).send({ success: false, error: 'Failed to update feature flag' });
    }
  }

  /**
   * Toggle a feature flag on/off
   */
  async toggleFlag(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const flag = await this.featureFlagService.toggleFlag(id);

      return reply.send({ success: true, data: flag });
    } catch (error) {
      request.log.error(error, 'Failed to toggle feature flag');
      if (error instanceof Error && error.message.includes('not found')) {
        return reply.code(404).send({ success: false, error: error.message });
      }
      return reply.code(500).send({ success: false, error: 'Failed to toggle feature flag' });
    }
  }

  /**
   * Delete a feature flag
   */
  async deleteFlag(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      await this.featureFlagService.deleteFlag(id);

      return reply.send({ success: true, message: 'Feature flag deleted successfully' });
    } catch (error) {
      request.log.error(error, 'Failed to delete feature flag');
      if (error instanceof Error && error.message.includes('not found')) {
        return reply.code(404).send({ success: false, error: error.message });
      }
      return reply.code(500).send({ success: false, error: 'Failed to delete feature flag' });
    }
  }

  /**
   * Check if a feature flag is enabled
   */
  async checkFlag(request: FastifyRequest, reply: FastifyReply) {
    try {
      const validatedData = CheckFlagSchema.parse(request.body);
      const enabled = await this.featureFlagService.isEnabled(
        validatedData.key,
        validatedData.userId,
      );

      return reply.send({ success: true, enabled });
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({
          success: false,
          error: 'Validation failed',
          details: error.issues.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }

      request.log.error(error, 'Failed to check feature flag');
      return reply.code(500).send({ success: false, error: 'Failed to check feature flag' });
    }
  }
}
