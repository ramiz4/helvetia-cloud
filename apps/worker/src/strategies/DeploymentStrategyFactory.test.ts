import { beforeEach, describe, expect, it } from 'vitest';
import {
  ComposeDeploymentStrategy,
  DatabaseDeploymentStrategy,
  DeploymentStrategyFactory,
  DockerDeploymentStrategy,
  StaticDeploymentStrategy,
} from './index';

describe('DeploymentStrategyFactory', () => {
  let factory: DeploymentStrategyFactory;

  beforeEach(() => {
    factory = new DeploymentStrategyFactory();
  });

  describe('getStrategy', () => {
    it('should return DatabaseDeploymentStrategy for POSTGRES type', () => {
      const strategy = factory.getStrategy('POSTGRES');
      expect(strategy).toBeInstanceOf(DatabaseDeploymentStrategy);
      expect(strategy.canHandle('POSTGRES')).toBe(true);
    });

    it('should return DatabaseDeploymentStrategy for REDIS type', () => {
      const strategy = factory.getStrategy('REDIS');
      expect(strategy).toBeInstanceOf(DatabaseDeploymentStrategy);
      expect(strategy.canHandle('REDIS')).toBe(true);
    });

    it('should return DatabaseDeploymentStrategy for MYSQL type', () => {
      const strategy = factory.getStrategy('MYSQL');
      expect(strategy).toBeInstanceOf(DatabaseDeploymentStrategy);
      expect(strategy.canHandle('MYSQL')).toBe(true);
    });

    it('should return ComposeDeploymentStrategy for COMPOSE type', () => {
      const strategy = factory.getStrategy('COMPOSE');
      expect(strategy).toBeInstanceOf(ComposeDeploymentStrategy);
      expect(strategy.canHandle('COMPOSE')).toBe(true);
    });

    it('should return StaticDeploymentStrategy for STATIC type', () => {
      const strategy = factory.getStrategy('STATIC');
      expect(strategy).toBeInstanceOf(StaticDeploymentStrategy);
      expect(strategy.canHandle('STATIC')).toBe(true);
    });

    it('should return DockerDeploymentStrategy for DOCKER type', () => {
      const strategy = factory.getStrategy('DOCKER');
      expect(strategy).toBeInstanceOf(DockerDeploymentStrategy);
      expect(strategy.canHandle('DOCKER')).toBe(true);
    });

    it('should throw error for unknown type', () => {
      expect(() => factory.getStrategy('UNKNOWN')).toThrow(
        'No deployment strategy found for type: UNKNOWN',
      );
    });

    it('should throw error for empty type', () => {
      expect(() => factory.getStrategy('')).toThrow('No deployment strategy found for type:');
    });
  });

  describe('Strategy Priority', () => {
    it('should select database strategy over docker for database types', () => {
      const strategy = factory.getStrategy('POSTGRES');
      expect(strategy).toBeInstanceOf(DatabaseDeploymentStrategy);
      expect(strategy).not.toBeInstanceOf(DockerDeploymentStrategy);
    });

    it('should select compose strategy over docker for compose type', () => {
      const strategy = factory.getStrategy('COMPOSE');
      expect(strategy).toBeInstanceOf(ComposeDeploymentStrategy);
      expect(strategy).not.toBeInstanceOf(DockerDeploymentStrategy);
    });

    it('should select static strategy over docker for static type', () => {
      const strategy = factory.getStrategy('STATIC');
      expect(strategy).toBeInstanceOf(StaticDeploymentStrategy);
      expect(strategy).not.toBeInstanceOf(DockerDeploymentStrategy);
    });
  });

  describe('Strategy Selection Logic', () => {
    it('should consistently return the same strategy type for the same input', () => {
      const strategy1 = factory.getStrategy('DOCKER');
      const strategy2 = factory.getStrategy('DOCKER');

      expect(strategy1.constructor).toBe(strategy2.constructor);
    });

    it('should handle multiple strategy requests', () => {
      const strategies = [
        factory.getStrategy('DOCKER'),
        factory.getStrategy('STATIC'),
        factory.getStrategy('POSTGRES'),
        factory.getStrategy('COMPOSE'),
      ];

      expect(strategies[0]).toBeInstanceOf(DockerDeploymentStrategy);
      expect(strategies[1]).toBeInstanceOf(StaticDeploymentStrategy);
      expect(strategies[2]).toBeInstanceOf(DatabaseDeploymentStrategy);
      expect(strategies[3]).toBeInstanceOf(ComposeDeploymentStrategy);
    });
  });
});
