import type { FastifyReply, FastifyRequest } from 'fastify';
import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FeatureFlagService } from '../services/index.js';
import { FeatureFlagController } from './FeatureFlagController.js';

describe('FeatureFlagController', () => {
  let controller: FeatureFlagController;
  let mockFeatureFlagService: any;
  let mockRequest: any;
  let mockReply: any;

  const mockFlag = {
    id: 'flag-1',
    key: 'test-flag',
    name: 'Test Flag',
    description: 'A test flag',
    enabled: true,
    segments: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockFeatureFlagService = {
      getAllFlags: vi.fn(),
      getFlagById: vi.fn(),
      createFlag: vi.fn(),
      updateFlag: vi.fn(),
      toggleFlag: vi.fn(),
      deleteFlag: vi.fn(),
      isEnabled: vi.fn(),
      checkMultiple: vi.fn(),
    };

    controller = new FeatureFlagController(mockFeatureFlagService as FeatureFlagService);

    mockRequest = {
      params: {},
      body: {},
      log: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      },
    };

    mockReply = {
      status: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  });

  describe('getAllFlags', () => {
    it('should return all flags', async () => {
      vi.mocked(mockFeatureFlagService.getAllFlags).mockResolvedValue([mockFlag] as any);

      await controller.getAllFlags(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: [mockFlag],
      });
    });

    it('should return 500 on service error', async () => {
      vi.mocked(mockFeatureFlagService.getAllFlags).mockRejectedValue(new Error('Service error'));

      await controller.getAllFlags(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.code).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to get feature flags',
      });
    });
  });

  describe('getFlagById', () => {
    it('should return a flag by ID', async () => {
      mockRequest.params = { id: 'flag-1' };
      vi.mocked(mockFeatureFlagService.getFlagById).mockResolvedValue(mockFlag as any);

      await controller.getFlagById(mockRequest as any, mockReply as FastifyReply);

      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: mockFlag,
      });
    });

    it('should return 404 if flag not found', async () => {
      mockRequest.params = { id: 'non-existent' };
      vi.mocked(mockFeatureFlagService.getFlagById).mockResolvedValue(null);

      await controller.getFlagById(mockRequest as any, mockReply as FastifyReply);

      expect(mockReply.code).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Feature flag not found',
      });
    });
  });

  describe('createFlag', () => {
    it('should create a flag', async () => {
      const createData = { key: 'new-flag', name: 'New Flag' };
      mockRequest.body = createData;
      vi.mocked(mockFeatureFlagService.createFlag).mockResolvedValue({
        ...mockFlag,
        ...createData,
      } as any);

      await controller.createFlag(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.code).toHaveBeenCalledWith(201);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: { ...mockFlag, ...createData },
      });
    });

    it('should return 400 on validation error', async () => {
      mockRequest.body = { key: '', name: 'Invalid' };

      await controller.createFlag(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.code).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Validation failed',
        }),
      );
    });

    it('should return 409 if flag already exists', async () => {
      mockRequest.body = { key: 'existing', name: 'Existing' };
      vi.mocked(mockFeatureFlagService.createFlag).mockRejectedValue(
        new Error('Feature flag with key "existing" already exists'),
      );

      await controller.createFlag(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.code).toHaveBeenCalledWith(409);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Feature flag with key "existing" already exists',
      });
    });
  });

  describe('updateFlag', () => {
    it('should update a flag', async () => {
      mockRequest.params = { id: 'flag-1' };
      const updateData = { name: 'Updated Name' };
      mockRequest.body = updateData;
      vi.mocked(mockFeatureFlagService.updateFlag).mockResolvedValue({
        ...mockFlag,
        ...updateData,
      } as any);

      await controller.updateFlag(mockRequest as any, mockReply as FastifyReply);

      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: { ...mockFlag, ...updateData },
      });
    });

    it('should return 404 if updating non-existent flag', async () => {
      mockRequest.params = { id: 'non-existent' };
      mockRequest.body = { name: 'Updated Name' };
      vi.mocked(mockFeatureFlagService.updateFlag).mockRejectedValue(
        new Error('Feature flag not found'),
      );

      await controller.updateFlag(mockRequest as any, mockReply as FastifyReply);

      expect(mockReply.code).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Feature flag not found',
      });
    });
  });

  describe('toggleFlag', () => {
    it('should toggle a flag', async () => {
      mockRequest.params = { id: 'flag-1' };
      vi.mocked(mockFeatureFlagService.toggleFlag).mockResolvedValue({
        ...mockFlag,
        enabled: false,
      } as any);

      await controller.toggleFlag(mockRequest as any, mockReply as FastifyReply);

      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: { ...mockFlag, enabled: false },
      });
    });
  });

  describe('deleteFlag', () => {
    it('should delete a flag', async () => {
      mockRequest.params = { id: 'flag-1' };
      vi.mocked(mockFeatureFlagService.deleteFlag).mockResolvedValue(undefined);

      await controller.deleteFlag(mockRequest as any, mockReply as FastifyReply);

      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        message: 'Feature flag deleted successfully',
      });
    });
  });

  describe('checkFlag', () => {
    it('should check if a flag is enabled', async () => {
      mockRequest.body = { key: 'test-flag', userId: 'user-1' };
      vi.mocked(mockFeatureFlagService.isEnabled).mockResolvedValue(true);

      await controller.checkFlag(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        enabled: true,
      });
    });

    it('should return 400 on invalid check request', async () => {
      mockRequest.body = { key: '' };

      await controller.checkFlag(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.code).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Validation failed',
        }),
      );
    });
  });

  describe('checkBulkFlags', () => {
    it('should check multiple flags at once', async () => {
      mockRequest.body = { keys: ['flag1', 'flag2', 'flag3'], userId: 'user-1' };
      vi.mocked(mockFeatureFlagService.checkMultiple).mockResolvedValue({
        flag1: true,
        flag2: false,
        flag3: true,
      });

      await controller.checkBulkFlags(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: {
          flag1: true,
          flag2: false,
          flag3: true,
        },
      });
      expect(mockFeatureFlagService.checkMultiple).toHaveBeenCalledWith(
        ['flag1', 'flag2', 'flag3'],
        'user-1',
      );
    });

    it('should return 400 on invalid bulk check request', async () => {
      mockRequest.body = { keys: [] }; // Empty array is invalid

      await controller.checkBulkFlags(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.code).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Validation failed',
        }),
      );
    });

    it('should handle bulk check without userId', async () => {
      mockRequest.body = { keys: ['flag1', 'flag2'] };
      vi.mocked(mockFeatureFlagService.checkMultiple).mockResolvedValue({
        flag1: true,
        flag2: false,
      });

      await controller.checkBulkFlags(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: {
          flag1: true,
          flag2: false,
        },
      });
      expect(mockFeatureFlagService.checkMultiple).toHaveBeenCalledWith(
        ['flag1', 'flag2'],
        undefined,
      );
    });

    it('should return 400 when exceeding 50 flag limit', async () => {
      // Create array with 51 flags
      const tooManyFlags = Array.from({ length: 51 }, (_, i) => `flag${i}`);
      mockRequest.body = { keys: tooManyFlags };

      await controller.checkBulkFlags(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.code).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Validation failed',
        }),
      );
    });

    it('should return 500 on service error', async () => {
      mockRequest.body = { keys: ['flag1', 'flag2'] };
      vi.mocked(mockFeatureFlagService.checkMultiple).mockRejectedValue(
        new Error('Database connection failed'),
      );

      await controller.checkBulkFlags(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.code).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to check feature flags',
      });
    });
  });
});
