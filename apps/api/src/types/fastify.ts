/**
 * Fastify Type Augmentation
 * Extends Fastify types to include custom properties added to request/reply/server instances
 */

import type { Redis } from 'ioredis';

import type { Role } from 'database';

/**
 * JWT Payload structure
 * Contains the authenticated user's information
 */
export interface JwtPayload {
  id: string;
  username: string;
  role: Role;
}

/**
 * Metrics timer function
 * Returns the elapsed time in milliseconds
 */
export type MetricsTimerFunction = () => number;

/**
 * Augment FastifyRequest to include custom properties
 */
declare module 'fastify' {
  interface FastifyRequest {
    /**
     * Authenticated user information from JWT
     * Available after jwtVerify() is called
     */
    user: JwtPayload;

    /**
     * Metrics end timer function
     * Used to track request duration for Prometheus metrics
     */
    metricsEndTimer?: MetricsTimerFunction;

    /**
     * Raw request body for webhook verification
     * Stored before JSON parsing for signature validation
     */
    rawBody?: Buffer;
  }

  interface FastifyInstance {
    /**
     * Redis connection instance
     * Used for caching, rate limiting, and queue management
     */
    redis: Redis;
  }
}
