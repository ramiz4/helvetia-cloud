import Docker from 'dockerode';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VolumeManager } from './VolumeManager';

describe('VolumeManager', () => {
  let volumeManager: VolumeManager;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockDocker: any;

  beforeEach(() => {
    mockDocker = {
      getVolume: vi.fn(),
      listVolumes: vi.fn(),
    };

    volumeManager = new VolumeManager(mockDocker as Docker);
  });

  describe('getVolume', () => {
    it('should get a volume by name', () => {
      const mockVolume = { name: 'test-volume' };
      mockDocker.getVolume.mockReturnValue(mockVolume);

      const result = volumeManager.getVolume('test-volume');

      expect(result).toBe(mockVolume);
      expect(mockDocker.getVolume).toHaveBeenCalledWith('test-volume');
    });
  });

  describe('listVolumes', () => {
    it('should list all volumes', async () => {
      const mockVolumes = [
        { Name: 'vol1', Driver: 'local' },
        { Name: 'vol2', Driver: 'local' },
      ];
      mockDocker.listVolumes.mockResolvedValue({ Volumes: mockVolumes });

      const result = await volumeManager.listVolumes();

      expect(result).toEqual(mockVolumes);
      expect(mockDocker.listVolumes).toHaveBeenCalledWith({ filters: undefined });
    });

    it('should list volumes with filters', async () => {
      const mockVolumes = [{ Name: 'filtered-vol', Driver: 'local' }];
      mockDocker.listVolumes.mockResolvedValue({ Volumes: mockVolumes });

      const result = await volumeManager.listVolumes({ label: ['app=test'] });

      expect(result).toEqual(mockVolumes);
      expect(mockDocker.listVolumes).toHaveBeenCalledWith({
        filters: { label: ['app=test'] },
      });
    });

    it('should handle empty volumes list', async () => {
      mockDocker.listVolumes.mockResolvedValue({ Volumes: null });

      const result = await volumeManager.listVolumes();

      expect(result).toEqual([]);
    });
  });

  describe('removeVolume', () => {
    it('should remove a volume by name', async () => {
      const mockVolume = {
        remove: vi.fn().mockResolvedValue(undefined),
      };
      mockDocker.getVolume.mockReturnValue(mockVolume);

      await volumeManager.removeVolume('test-volume');

      expect(mockDocker.getVolume).toHaveBeenCalledWith('test-volume');
      expect(mockVolume.remove).toHaveBeenCalled();
    });
  });

  describe('removeVolumesByLabel', () => {
    it('should remove volumes matching label', async () => {
      const mockVolumes = [
        { Name: 'vol1', Labels: { app: 'test' } },
        { Name: 'vol2', Labels: { app: 'test' } },
      ];
      const mockVolume1 = { remove: vi.fn().mockResolvedValue(undefined) };
      const mockVolume2 = { remove: vi.fn().mockResolvedValue(undefined) };

      mockDocker.listVolumes.mockResolvedValue({ Volumes: mockVolumes });
      mockDocker.getVolume.mockReturnValueOnce(mockVolume1).mockReturnValueOnce(mockVolume2);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await volumeManager.removeVolumesByLabel('app', 'test');

      expect(mockDocker.listVolumes).toHaveBeenCalledWith({
        filters: { label: ['app=test'] },
      });
      expect(mockVolume1.remove).toHaveBeenCalled();
      expect(mockVolume2.remove).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Removed volume vol1');
      expect(consoleSpy).toHaveBeenCalledWith('Removed volume vol2');

      consoleSpy.mockRestore();
    });

    it('should handle removal errors gracefully', async () => {
      const mockVolumes = [{ Name: 'vol1', Labels: { app: 'test' } }];
      const mockVolume = {
        remove: vi.fn().mockRejectedValue(new Error('Volume in use')),
      };

      mockDocker.listVolumes.mockResolvedValue({ Volumes: mockVolumes });
      mockDocker.getVolume.mockReturnValue(mockVolume);

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await volumeManager.removeVolumesByLabel('app', 'test');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to remove volume vol1:',
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('volumeExists', () => {
    it('should return true if volume exists', async () => {
      const mockVolume = {
        inspect: vi.fn().mockResolvedValue({ Name: 'test-volume' }),
      };
      mockDocker.getVolume.mockReturnValue(mockVolume);

      const result = await volumeManager.volumeExists('test-volume');

      expect(result).toBe(true);
    });

    it('should return false if volume does not exist', async () => {
      const mockVolume = {
        inspect: vi.fn().mockRejectedValue(new Error('Not found')),
      };
      mockDocker.getVolume.mockReturnValue(mockVolume);

      const result = await volumeManager.volumeExists('test-volume');

      expect(result).toBe(false);
    });
  });
});
