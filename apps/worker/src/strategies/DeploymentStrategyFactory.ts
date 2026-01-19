import type { IDeploymentStrategy } from '../interfaces/index.js';
import { ComposeDeploymentStrategy } from './ComposeDeploymentStrategy.js';
import { DatabaseDeploymentStrategy } from './DatabaseDeploymentStrategy.js';
import { DockerDeploymentStrategy } from './DockerDeploymentStrategy.js';
import { StaticDeploymentStrategy } from './StaticDeploymentStrategy.js';

/**
 * Factory for creating deployment strategies
 * Implements Factory Pattern for strategy selection
 */
export class DeploymentStrategyFactory {
  private strategies: IDeploymentStrategy[];

  constructor() {
    this.strategies = [
      new DatabaseDeploymentStrategy(),
      new ComposeDeploymentStrategy(),
      new StaticDeploymentStrategy(),
      new DockerDeploymentStrategy(),
    ];
  }

  /**
   * Get the appropriate strategy for the given service type
   * @param type - Service type string
   * @returns Deployment strategy instance
   * @throws Error if no strategy can handle the type
   */
  getStrategy(type: string): IDeploymentStrategy {
    const strategy = this.strategies.find((s) => s.canHandle(type));
    if (!strategy) {
      throw new Error(`No deployment strategy found for type: ${type}`);
    }
    return strategy;
  }
}
