import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Prisma
const mockPrisma = {
  deployment: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
};

vi.mock('database', () => ({
  prisma: mockPrisma,
}));

// Mock constants
vi.mock('../config/constants', () => ({
  CLEANUP_DANGLING_IMAGES: true,
  CLEANUP_OLD_IMAGES: true,
  DISK_USAGE_THRESHOLD_PERCENT: 80,
  IMAGE_RETENTION_DAYS: 7,
}));

describe('Image Cleanup Service', () => {
  let mockDocker: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock Docker instance
    mockDocker = {
      info: vi.fn().mockResolvedValue({}),
      listImages: vi.fn().mockResolvedValue([]),
      listContainers: vi.fn().mockResolvedValue([]),
      getImage: vi.fn(),
    };
  });

  describe('getDockerDiskUsage', () => {
    it('should calculate disk usage from images', async () => {
      const { getDockerDiskUsage } = await import('./imageCleanup.js');

      mockDocker.listImages.mockResolvedValue([
        { Id: 'img1', Size: 1024 * 1024 * 100 }, // 100 MB
        { Id: 'img2', Size: 1024 * 1024 * 200 }, // 200 MB
        { Id: 'img3', Size: 1024 * 1024 * 300 }, // 300 MB
      ]);

      const result = await getDockerDiskUsage(mockDocker);

      expect(result.usedBytes).toBe(1024 * 1024 * 600); // 600 MB
      expect(mockDocker.listImages).toHaveBeenCalledWith({ all: true });
    });

    it('should handle errors gracefully', async () => {
      const { getDockerDiskUsage } = await import('./imageCleanup.js');

      mockDocker.listImages.mockRejectedValue(new Error('Docker error'));

      const result = await getDockerDiskUsage(mockDocker);

      expect(result.usedBytes).toBe(0);
      expect(result.totalBytes).toBe(0);
    });
  });

  describe('removeDanglingImages', () => {
    it('should remove dangling images', async () => {
      const { removeDanglingImages } = await import('./imageCleanup.js');

      const mockImage1 = { remove: vi.fn().mockResolvedValue(undefined) };
      const mockImage2 = { remove: vi.fn().mockResolvedValue(undefined) };

      mockDocker.listImages.mockResolvedValue([
        { Id: 'sha256:abc123', Size: 1024 * 1024 * 50 },
        { Id: 'sha256:def456', Size: 1024 * 1024 * 75 },
      ]);

      mockDocker.getImage.mockImplementation((id: string) => {
        if (id === 'sha256:abc123') return mockImage1;
        if (id === 'sha256:def456') return mockImage2;
      });

      const result = await removeDanglingImages(mockDocker);

      expect(result.count).toBe(2);
      expect(result.bytesFreed).toBe(1024 * 1024 * 125); // 125 MB
      expect(result.errors).toHaveLength(0);
      expect(mockDocker.listImages).toHaveBeenCalledWith({
        filters: JSON.stringify({ dangling: ['true'] }),
      });
      expect(mockImage1.remove).toHaveBeenCalledWith({ force: false });
      expect(mockImage2.remove).toHaveBeenCalledWith({ force: false });
    });

    it('should handle individual image removal failures', async () => {
      const { removeDanglingImages } = await import('./imageCleanup.js');

      const mockImage1 = { remove: vi.fn().mockResolvedValue(undefined) };
      const mockImage2 = { remove: vi.fn().mockRejectedValue(new Error('Image in use')) };

      mockDocker.listImages.mockResolvedValue([
        { Id: 'sha256:abc123', Size: 1024 * 1024 * 50 },
        { Id: 'sha256:def456', Size: 1024 * 1024 * 75 },
      ]);

      mockDocker.getImage.mockImplementation((id: string) => {
        if (id === 'sha256:abc123') return mockImage1;
        if (id === 'sha256:def456') return mockImage2;
      });

      const result = await removeDanglingImages(mockDocker);

      expect(result.count).toBe(1); // Only one succeeded
      expect(result.bytesFreed).toBe(1024 * 1024 * 50);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Image in use');
    });

    it('should return early if dangling cleanup is disabled', async () => {
      // Temporarily override the constant
      vi.doMock('../config/constants', () => ({
        CLEANUP_DANGLING_IMAGES: false,
        CLEANUP_OLD_IMAGES: true,
        DISK_USAGE_THRESHOLD_PERCENT: 80,
        IMAGE_RETENTION_DAYS: 7,
      }));

      // Re-import to get new constant value
      vi.resetModules();
      const { removeDanglingImages } = await import('./imageCleanup.js');

      const result = await removeDanglingImages(mockDocker);

      expect(result.count).toBe(0);
      expect(result.bytesFreed).toBe(0);
      expect(mockDocker.listImages).not.toHaveBeenCalled();
    });
  });

  describe('removeOldImages', () => {
    it('should remove old images based on retention policy', async () => {
      const { removeOldImages } = await import('./imageCleanup.js');

      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10); // 10 days ago

      mockPrisma.deployment.findMany.mockResolvedValue([
        {
          id: 'dep1',
          imageTag: 'helvetia/old-app:v1',
          serviceId: 'svc1',
          createdAt: oldDate,
        },
      ]);

      mockPrisma.deployment.findFirst.mockResolvedValue({
        imageTag: 'helvetia/old-app:v2', // Different from v1, so v1 is not latest
      });

      mockDocker.listContainers.mockResolvedValue([]);

      const mockImage = {
        inspect: vi.fn().mockResolvedValue({
          Id: 'sha256:abc123',
          Size: 1024 * 1024 * 100,
        }),
        remove: vi.fn().mockResolvedValue(undefined),
      };

      mockDocker.getImage.mockReturnValue(mockImage);

      const result = await removeOldImages(mockDocker);

      expect(result.count).toBe(1);
      expect(result.bytesFreed).toBe(1024 * 1024 * 100);
      expect(result.errors).toHaveLength(0);
      expect(mockImage.remove).toHaveBeenCalledWith({ force: false });
    });

    it('should not remove latest deployment image', async () => {
      const { removeOldImages } = await import('./imageCleanup.js');

      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);

      mockPrisma.deployment.findMany.mockResolvedValue([
        {
          id: 'dep1',
          imageTag: 'helvetia/app:latest',
          serviceId: 'svc1',
          createdAt: oldDate,
        },
      ]);

      // This is the latest deployment with same image
      mockPrisma.deployment.findFirst.mockResolvedValue({
        imageTag: 'helvetia/app:latest',
      });

      mockDocker.listContainers.mockResolvedValue([]);

      const result = await removeOldImages(mockDocker);

      expect(result.count).toBe(0);
      expect(mockDocker.getImage).not.toHaveBeenCalled();
    });

    it('should not remove images in use by running containers', async () => {
      const { removeOldImages } = await import('./imageCleanup.js');

      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);

      mockPrisma.deployment.findMany.mockResolvedValue([
        {
          id: 'dep1',
          imageTag: 'helvetia/app:v1',
          serviceId: 'svc1',
          createdAt: oldDate,
        },
      ]);

      mockPrisma.deployment.findFirst.mockResolvedValue({
        imageTag: 'helvetia/app:v2',
      });

      // Image is being used by a running container
      mockDocker.listContainers.mockResolvedValue([{ ImageID: 'sha256:abc123' }]);

      const mockImage = {
        inspect: vi.fn().mockResolvedValue({
          Id: 'sha256:abc123',
          Size: 1024 * 1024 * 100,
        }),
      };

      mockDocker.getImage.mockReturnValue(mockImage);

      const result = await removeOldImages(mockDocker);

      expect(result.count).toBe(0);
      expect(mockImage.inspect).toHaveBeenCalled();
    });

    it('should skip images with conflict error (409)', async () => {
      const { removeOldImages } = await import('./imageCleanup.js');

      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);

      mockPrisma.deployment.findMany.mockResolvedValue([
        {
          id: 'dep1',
          imageTag: 'helvetia/app:v1',
          serviceId: 'svc1',
          createdAt: oldDate,
        },
      ]);

      mockPrisma.deployment.findFirst.mockResolvedValue({
        imageTag: 'helvetia/app:v2',
      });

      mockDocker.listContainers.mockResolvedValue([]);

      const conflictError: Error & { statusCode?: number } = new Error('Conflict');
      conflictError.statusCode = 409;

      const mockImage = {
        inspect: vi.fn().mockResolvedValue({
          Id: 'sha256:abc123',
          Size: 1024 * 1024 * 100,
        }),
        remove: vi.fn().mockRejectedValue(conflictError),
      };

      mockDocker.getImage.mockReturnValue(mockImage);

      const result = await removeOldImages(mockDocker);

      expect(result.count).toBe(0);
      expect(result.errors).toHaveLength(0); // 409 errors are not counted as errors
    });

    it('should handle non-existent images gracefully', async () => {
      const { removeOldImages } = await import('./imageCleanup.js');

      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);

      mockPrisma.deployment.findMany.mockResolvedValue([
        {
          id: 'dep1',
          imageTag: 'helvetia/app:v1',
          serviceId: 'svc1',
          createdAt: oldDate,
        },
      ]);

      mockPrisma.deployment.findFirst.mockResolvedValue({
        imageTag: 'helvetia/app:v2',
      });

      mockDocker.listContainers.mockResolvedValue([]);

      const mockImage = {
        inspect: vi.fn().mockResolvedValue(null),
      };

      mockDocker.getImage.mockReturnValue(mockImage);

      const result = await removeOldImages(mockDocker);

      expect(result.count).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should return early if old image cleanup is disabled', async () => {
      // Temporarily override the constant
      vi.doMock('../config/constants', () => ({
        CLEANUP_DANGLING_IMAGES: true,
        CLEANUP_OLD_IMAGES: false,
        DISK_USAGE_THRESHOLD_PERCENT: 80,
        IMAGE_RETENTION_DAYS: 7,
      }));

      vi.resetModules();
      const { removeOldImages } = await import('./imageCleanup.js');

      const result = await removeOldImages(mockDocker);

      expect(result.count).toBe(0);
      expect(mockPrisma.deployment.findMany).not.toHaveBeenCalled();
    });
  });

  describe('cleanupDockerImages', () => {
    it('should perform complete cleanup', async () => {
      const { cleanupDockerImages } = await import('./imageCleanup.js');

      // Mock dangling images
      mockDocker.listImages.mockImplementation((opts?: { filters?: string }) => {
        if (opts?.filters) {
          // Dangling images
          return Promise.resolve([{ Id: 'sha256:dangling1', Size: 1024 * 1024 * 50 }]);
        }
        // All images for disk usage
        return Promise.resolve([
          { Id: 'img1', Size: 1024 * 1024 * 100 },
          { Id: 'img2', Size: 1024 * 1024 * 200 },
        ]);
      });

      const mockDanglingImage = {
        remove: vi.fn().mockResolvedValue(undefined),
      };

      mockDocker.getImage.mockReturnValue(mockDanglingImage);

      // Mock old deployments
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);

      mockPrisma.deployment.findMany.mockResolvedValue([]);
      mockDocker.listContainers.mockResolvedValue([]);

      const result = await cleanupDockerImages(mockDocker);

      expect(result.danglingImagesRemoved).toBe(1);
      expect(result.oldImagesRemoved).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle cleanup errors gracefully', async () => {
      const { cleanupDockerImages } = await import('./imageCleanup.js');

      mockDocker.listImages.mockRejectedValue(new Error('Docker daemon error'));
      mockDocker.listContainers.mockResolvedValue([]);
      mockPrisma.deployment.findMany.mockResolvedValue([]);

      const result = await cleanupDockerImages(mockDocker);

      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
