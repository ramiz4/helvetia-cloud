/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// We must mock BEFORE importing the server
vi.mock('ioredis', () => {
  const mockRedis = {
    on: vi.fn(),
    subscribe: vi.fn(),
    removeListener: vi.fn(),
    quit: vi.fn(),
    defineCommand: vi.fn(), // Required by @fastify/rate-limit
    pttl: vi.fn().mockResolvedValue(60000),
    eval: vi.fn().mockResolvedValue([0, 60000]),
  };
  return {
    default: vi.fn(function () {
      return mockRedis;
    }),
  };
});

vi.mock('redlock', () => {
  const mockLock = {
    value: 'test-lock-value',
    attempts: [],
    expiration: Date.now() + 10000,
    release: vi.fn().mockResolvedValue(undefined),
    extend: vi.fn().mockResolvedValue(undefined),
  };
  return {
    default: vi.fn(function () {
      return {
        acquire: vi.fn().mockResolvedValue(mockLock),
        on: vi.fn(),
      };
    }),
  };
});

vi.mock('bullmq', () => {
  return {
    Queue: vi.fn(function () {
      return {
        add: vi.fn(),
      };
    }),
  };
});

vi.mock('database', () => {
  return {
    prisma: {
      service: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        updateMany: vi.fn(),
        update: vi.fn(),
        upsert: vi.fn(),
        create: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
      },
      deployment: {
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      refreshToken: {
        create: vi.fn(),
        findUnique: vi.fn(),
        updateMany: vi.fn(),
        findMany: vi.fn(),
        deleteMany: vi.fn(),
      },
    },
  };
});

import { fastify } from './server';

describe('API Service Normalization', () => {
  let token: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    await fastify.ready();
    const mockUser = { id: 'user-1', username: 'testuser' };
    token = fastify.jwt.sign(mockUser);
  });

  it('should normalize lowercase service type to uppercase on creation', async () => {
    const { prisma } = await import('database');
    vi.mocked(prisma.service.findFirst).mockResolvedValue(null); // Check name taken - not found
    vi.mocked(prisma.service.findFirst).mockResolvedValueOnce(null); // findByNameAndUserId - not found
    vi.mocked(prisma.service.create).mockResolvedValue({ id: 's1' } as never);

    const response = await fastify.inject({
      method: 'POST',
      url: '/services',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        name: 'test-service',
        type: 'compose', // lowercase
      },
    });

    expect(response.statusCode).toBe(200);
    const createCall = vi.mocked(prisma.service.create).mock.calls[0][0];
    expect(createCall.data.type).toBe('COMPOSE');
  });

  it('should normalize lowercase service type to uppercase on update', async () => {
    const { prisma } = await import('database');
    const mockService = {
      id: 's1',
      userId: 'user-1',
      name: 'test-service',
      type: 'DOCKER',
      port: 3000,
      deletedAt: null,
      deleteProtected: false,
      status: 'IDLE',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(prisma.service.findUnique).mockResolvedValue(mockService as never);
    vi.mocked(prisma.service.update).mockResolvedValue({ ...mockService, type: 'STATIC' } as never);
    vi.mocked(prisma.deployment.findMany).mockResolvedValue([] as never);

    const response = await fastify.inject({
      method: 'PATCH',
      url: '/services/s1',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        type: 'static', // lowercase
      },
    });

    expect(response.statusCode).toBe(200);
    const updateCall = vi.mocked(prisma.service.update).mock.calls[0][0];
    expect(updateCall.data.type).toBe('STATIC');
  });

  it('should reject invalid service types even if they are lowercase', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/services',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        name: 'test-service',
        type: 'invalid_type',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe('Validation failed');
    // Check that the validation error mentions the type field
    expect(response.json().details.some((d: any) => d.field === 'type')).toBe(true);
  });
});
