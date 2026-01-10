/**
 * Cache options
 */
export interface CacheOptions {
  ttl?: number; // Time to live in seconds
}

/**
 * Interface for cache operations (Redis)
 */
export interface ICache {
  /**
   * Get a value from cache
   */
  get(key: string): Promise<string | null>;

  /**
   * Set a value in cache
   */
  set(key: string, value: string, options?: CacheOptions): Promise<void>;

  /**
   * Delete a value from cache
   */
  del(key: string): Promise<void>;

  /**
   * Delete multiple values matching a pattern
   */
  delPattern(pattern: string): Promise<void>;

  /**
   * Check if a key exists
   */
  exists(key: string): Promise<boolean>;

  /**
   * Set expiration time for a key
   */
  expire(key: string, seconds: number): Promise<void>;

  /**
   * Get time to live for a key
   */
  ttl(key: string): Promise<number>;

  /**
   * Publish a message to a channel
   */
  publish(channel: string, message: string): Promise<void>;

  /**
   * Subscribe to a channel
   */
  subscribe(channel: string, callback: (message: string) => void): Promise<void>;

  /**
   * Unsubscribe from a channel
   */
  unsubscribe(channel: string): Promise<void>;

  /**
   * Close the cache connection
   */
  quit(): Promise<void>;
}
