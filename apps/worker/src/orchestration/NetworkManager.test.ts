import Docker from 'dockerode';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NetworkManager } from './NetworkManager';

describe('NetworkManager', () => {
  let networkManager: NetworkManager;
  let mockDocker: any;

  beforeEach(() => {
    mockDocker = {
      getNetwork: vi.fn(),
      listNetworks: vi.fn(),
      createNetwork: vi.fn(),
    };

    networkManager = new NetworkManager(mockDocker as Docker);
  });

  describe('getNetwork', () => {
    it('should get a network by ID', () => {
      const mockNetwork = { id: 'network-123' };
      mockDocker.getNetwork.mockReturnValue(mockNetwork);

      const result = networkManager.getNetwork('network-123');

      expect(result).toBe(mockNetwork);
      expect(mockDocker.getNetwork).toHaveBeenCalledWith('network-123');
    });
  });

  describe('listNetworks', () => {
    it('should list all networks', async () => {
      const mockNetworks = [
        { Id: 'net1', Name: 'bridge', Driver: 'bridge' },
        { Id: 'net2', Name: 'custom', Driver: 'bridge' },
      ];
      mockDocker.listNetworks.mockResolvedValue(mockNetworks);

      const result = await networkManager.listNetworks();

      expect(result).toEqual(mockNetworks);
      expect(mockDocker.listNetworks).toHaveBeenCalledWith({ filters: undefined });
    });

    it('should list networks with filters', async () => {
      const mockNetworks = [{ Id: 'net1', Name: 'custom', Driver: 'bridge' }];
      mockDocker.listNetworks.mockResolvedValue(mockNetworks);

      const result = await networkManager.listNetworks({ label: ['app=test'] });

      expect(result).toEqual(mockNetworks);
      expect(mockDocker.listNetworks).toHaveBeenCalledWith({
        filters: { label: ['app=test'] },
      });
    });
  });

  describe('createNetwork', () => {
    it('should create a network with default driver', async () => {
      const mockNetwork = { id: 'new-network' };
      mockDocker.createNetwork.mockResolvedValue(mockNetwork);

      const result = await networkManager.createNetwork('test-network');

      expect(result).toBe(mockNetwork);
      expect(mockDocker.createNetwork).toHaveBeenCalledWith({
        Name: 'test-network',
        Driver: 'bridge',
        Labels: undefined,
        Internal: undefined,
      });
    });

    it('should create a network with custom options', async () => {
      const mockNetwork = { id: 'new-network' };
      mockDocker.createNetwork.mockResolvedValue(mockNetwork);

      await networkManager.createNetwork('test-network', {
        Driver: 'overlay',
        Labels: { app: 'test' },
        Internal: true,
      });

      expect(mockDocker.createNetwork).toHaveBeenCalledWith({
        Name: 'test-network',
        Driver: 'overlay',
        Labels: { app: 'test' },
        Internal: true,
      });
    });
  });

  describe('removeNetwork', () => {
    it('should remove a network by ID', async () => {
      const mockNetwork = {
        remove: vi.fn().mockResolvedValue(undefined),
      };
      mockDocker.getNetwork.mockReturnValue(mockNetwork);

      await networkManager.removeNetwork('network-123');

      expect(mockDocker.getNetwork).toHaveBeenCalledWith('network-123');
      expect(mockNetwork.remove).toHaveBeenCalled();
    });
  });

  describe('removeNetworksByLabel', () => {
    it('should remove networks matching label', async () => {
      const mockNetworks = [
        { Id: 'net1', Name: 'network1', Labels: { app: 'test' } },
        { Id: 'net2', Name: 'network2', Labels: { app: 'test' } },
      ];
      const mockNetwork1 = { remove: vi.fn().mockResolvedValue(undefined) };
      const mockNetwork2 = { remove: vi.fn().mockResolvedValue(undefined) };

      mockDocker.listNetworks.mockResolvedValue(mockNetworks);
      mockDocker.getNetwork.mockReturnValueOnce(mockNetwork1).mockReturnValueOnce(mockNetwork2);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await networkManager.removeNetworksByLabel('app', 'test');

      expect(mockDocker.listNetworks).toHaveBeenCalledWith({
        filters: { label: ['app=test'] },
      });
      expect(mockNetwork1.remove).toHaveBeenCalled();
      expect(mockNetwork2.remove).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Removed network network1');
      expect(consoleSpy).toHaveBeenCalledWith('Removed network network2');

      consoleSpy.mockRestore();
    });

    it('should handle removal errors gracefully', async () => {
      const mockNetworks = [{ Id: 'net1', Name: 'network1', Labels: { app: 'test' } }];
      const mockNetwork = {
        remove: vi.fn().mockRejectedValue(new Error('Network in use')),
      };

      mockDocker.listNetworks.mockResolvedValue(mockNetworks);
      mockDocker.getNetwork.mockReturnValue(mockNetwork);

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await networkManager.removeNetworksByLabel('app', 'test');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to remove network network1:',
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('networkExists', () => {
    it('should return true if network exists', async () => {
      const mockNetwork = {
        inspect: vi.fn().mockResolvedValue({ Id: 'network-123' }),
      };
      mockDocker.getNetwork.mockReturnValue(mockNetwork);

      const result = await networkManager.networkExists('network-123');

      expect(result).toBe(true);
    });

    it('should return false if network does not exist', async () => {
      const mockNetwork = {
        inspect: vi.fn().mockRejectedValue(new Error('Not found')),
      };
      mockDocker.getNetwork.mockReturnValue(mockNetwork);

      const result = await networkManager.networkExists('network-123');

      expect(result).toBe(false);
    });
  });
});
