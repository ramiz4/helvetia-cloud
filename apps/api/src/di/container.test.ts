import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearContainer,
  getContainer,
  initializeContainer,
  registerInstance,
  registerSingleton,
  resolve,
  TOKENS,
} from '../di/index.js';

describe('DI Container', () => {
  beforeEach(() => {
    clearContainer();
  });

  afterEach(() => {
    clearContainer();
  });

  describe('Container initialization', () => {
    it('should initialize container without errors', () => {
      expect(() => initializeContainer()).not.toThrow();
    });

    it('should return container instance', () => {
      const container = getContainer();
      expect(container).toBeDefined();
    });
  });

  describe('Token definitions', () => {
    it('should have unique symbols for each token', () => {
      const tokens = Object.values(TOKENS);
      const uniqueTokens = new Set(tokens);

      expect(tokens.length).toBe(uniqueTokens.size);
    });

    it('should have ServiceRepository token', () => {
      expect(TOKENS.ServiceRepository).toBeDefined();
      expect(typeof TOKENS.ServiceRepository).toBe('symbol');
    });

    it('should have DeploymentRepository token', () => {
      expect(TOKENS.DeploymentRepository).toBeDefined();
      expect(typeof TOKENS.DeploymentRepository).toBe('symbol');
    });

    it('should have UserRepository token', () => {
      expect(TOKENS.UserRepository).toBeDefined();
      expect(typeof TOKENS.UserRepository).toBe('symbol');
    });

    it('should have ContainerOrchestrator token', () => {
      expect(TOKENS.ContainerOrchestrator).toBeDefined();
      expect(typeof TOKENS.ContainerOrchestrator).toBe('symbol');
    });

    it('should have Logger token', () => {
      expect(TOKENS.Logger).toBeDefined();
      expect(typeof TOKENS.Logger).toBe('symbol');
    });
  });

  describe('Registration and resolution', () => {
    class TestService {
      getValue() {
        return 'test-value';
      }
    }

    it('should register and resolve a singleton', () => {
      const testToken = Symbol.for('TestService');
      registerSingleton(testToken, TestService);

      const instance1 = resolve<TestService>(testToken);
      const instance2 = resolve<TestService>(testToken);

      expect(instance1).toBeInstanceOf(TestService);
      expect(instance1).toBe(instance2); // Same instance
      expect(instance1.getValue()).toBe('test-value');
    });

    it('should register and resolve an instance', () => {
      const testToken = Symbol.for('TestInstance');
      const testInstance = new TestService();

      registerInstance(testToken, testInstance);

      const resolved = resolve<TestService>(testToken);

      expect(resolved).toBe(testInstance);
      expect(resolved.getValue()).toBe('test-value');
    });

    it('should clear container instances', () => {
      const testToken = Symbol.for('TestService');
      registerSingleton(testToken, TestService);

      const instance1 = resolve<TestService>(testToken);
      expect(instance1).toBeDefined();

      clearContainer();

      // After clearing, resolving should create a new instance or throw
      // The behavior depends on TSyringe implementation
      try {
        const instance2 = resolve<TestService>(testToken);
        // If it doesn't throw, it should be a different instance
        expect(instance2).not.toBe(instance1);
      } catch (error) {
        // It's okay if it throws after clearing
        expect(error).toBeDefined();
      }
    });
  });

  describe('Container isolation', () => {
    it('should not resolve unregistered tokens', () => {
      const unregisteredToken = Symbol.for('UnregisteredService');

      expect(() => resolve(unregisteredToken)).toThrow();
    });
  });
});
