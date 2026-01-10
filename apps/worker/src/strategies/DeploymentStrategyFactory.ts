import type { IDeploymentStrategy } from '../interfaces';
import { ComposeDeploymentStrategy } from './ComposeDeploymentStrategy';
import { DatabaseDeploymentStrategy } from './DatabaseDeploymentStrategy';
import { DockerDeploymentStrategy } from './DockerDeploymentStrategy';
import { StaticDeploymentStrategy } from './StaticDeploymentStrategy';

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
