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
        updateMany: vi.fn(),
        upsert: vi.fn(),
        findFirst: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
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
    vi.mocked(prisma.service.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.service.upsert).mockResolvedValue({ id: 's1' } as never);

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
    const upsertCall = vi.mocked(prisma.service.upsert).mock.calls[0][0];
    expect(upsertCall.create.type).toBe('COMPOSE');
  });

  it('should normalize lowercase service type to uppercase on update', async () => {
    const { prisma } = await import('database');
    vi.mocked(prisma.service.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.service.findUnique).mockResolvedValue({ id: 's1' } as never);

    const response = await fastify.inject({
      method: 'PATCH',
      url: '/services/s1',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        type: 'static', // lowercase
      },
    });

    expect(response.statusCode).toBe(200);
    const updateCall = vi.mocked(prisma.service.updateMany).mock.calls[0][0];
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
    expect(response.json().error).toBe('Invalid service type');
  });
});
