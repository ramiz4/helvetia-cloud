/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from 'crypto';
import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebhookController } from './WebhookController';

describe('WebhookController', () => {
  let controller: WebhookController;
  let mockServiceRepository: any;
  let mockDeploymentRepository: any;
  let mockUserRepository: any;
  let mockDeploymentQueue: any;
  let mockRequest: any;
  let mockReply: any;

  beforeEach(() => {
    // Create mock repositories
    mockServiceRepository = {
      findById: vi.fn(),
      delete: vi.fn(),
    };

    mockDeploymentRepository = {
      create: vi.fn(),
      findByServiceId: vi.fn(),
      deleteByServiceId: vi.fn(),
    };

    mockUserRepository = {
      findById: vi.fn(),
    };

    mockDeploymentQueue = {
      add: vi.fn().mockResolvedValue({}),
    };

    // Create controller instance
    controller = new WebhookController(
      mockServiceRepository,
      mockDeploymentRepository,
      mockUserRepository,
      mockDeploymentQueue,
    );

    // Create mock request and reply
    mockRequest = {
      headers: {},
      body: {},
      ip: '1.2.3.4',
    };

    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    // Set environment variable
    process.env.GITHUB_WEBHOOK_SECRET = 'test-secret';
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.GITHUB_WEBHOOK_SECRET;
  });

  describe('handleGitHubWebhook', () => {
    function generateSignature(payload: string, secret: string): string {
      const hmac = crypto.createHmac('sha256', secret);
      return 'sha256=' + hmac.update(payload).digest('hex');
    }

    describe('Signature Verification', () => {
      it('should reject webhook without signature', async () => {
        await controller.handleGitHubWebhook(mockRequest, mockReply);

        expect(mockReply.status).toHaveBeenCalledWith(401);
        expect(mockReply.send).toHaveBeenCalledWith({ error: 'Missing signature' });
      });

      it('should reject webhook without webhook secret configured', async () => {
        delete process.env.GITHUB_WEBHOOK_SECRET;
        mockRequest.headers['x-hub-signature-256'] = 'sha256=test';

        await controller.handleGitHubWebhook(mockRequest, mockReply);

        expect(mockReply.status).toHaveBeenCalledWith(500);
        expect(mockReply.send).toHaveBeenCalledWith({ error: 'Webhook secret not configured' });
      });

      it('should reject webhook without raw body', async () => {
        mockRequest.headers['x-hub-signature-256'] = 'sha256=test';

        await controller.handleGitHubWebhook(mockRequest, mockReply);

        expect(mockReply.status).toHaveBeenCalledWith(400);
        expect(mockReply.send).toHaveBeenCalledWith({ error: 'Missing raw body' });
      });

      it('should reject webhook with invalid signature', async () => {
        const payload = JSON.stringify({ test: 'data' });
        mockRequest.headers['x-hub-signature-256'] = 'sha256=invalidsignature';
        mockRequest.rawBody = Buffer.from(payload);
        mockRequest.body = JSON.parse(payload);

        await controller.handleGitHubWebhook(mockRequest, mockReply);

        expect(mockReply.status).toHaveBeenCalledWith(401);
        expect(mockReply.send).toHaveBeenCalledWith({ error: 'Invalid signature' });
      });

      it('should accept webhook with valid signature', async () => {
        const payload = JSON.stringify({
          repository: { html_url: 'https://github.com/test/repo' },
          ref: 'refs/heads/main',
          after: 'abc123',
        });
        const signature = generateSignature(payload, 'test-secret');
        mockRequest.headers['x-hub-signature-256'] = signature;
        mockRequest.rawBody = Buffer.from(payload);
        mockRequest.body = JSON.parse(payload);

        // Mock prisma
        vi.doMock('database', () => ({
          prisma: {
            service: {
              findMany: vi.fn().mockResolvedValue([]),
            },
          },
        }));

        await controller.handleGitHubWebhook(mockRequest, mockReply);

        // Should not return 401
        expect(mockReply.status).not.toHaveBeenCalledWith(401);
      });

      it('should handle malformed JSON payload', async () => {
        const payload = JSON.stringify({ test: 'data' });
        const signature = generateSignature(payload, 'test-secret');
        mockRequest.headers['x-hub-signature-256'] = signature;
        mockRequest.rawBody = Buffer.from(payload);
        mockRequest.body = { _isMalformed: true, _error: 'Invalid JSON' };

        await controller.handleGitHubWebhook(mockRequest, mockReply);

        expect(mockReply.status).toHaveBeenCalledWith(400);
        expect(mockReply.send).toHaveBeenCalledWith({
          error: 'Invalid JSON payload',
          message: 'Invalid JSON',
        });
      });
    });

    describe('Push Event Handling', () => {
      it('should skip non-push/PR events', async () => {
        const payload = JSON.stringify({ test: 'data' });
        const signature = generateSignature(payload, 'test-secret');
        mockRequest.headers['x-hub-signature-256'] = signature;
        mockRequest.rawBody = Buffer.from(payload);
        mockRequest.body = JSON.parse(payload);

        await controller.handleGitHubWebhook(mockRequest, mockReply);

        expect(mockReply.status).toHaveBeenCalledWith(200);
        expect(mockReply.send).toHaveBeenCalledWith({ skipped: 'Not a push or PR event' });
      });

      it('should skip push event with no matching service', async () => {
        const payload = JSON.stringify({
          repository: { html_url: 'https://github.com/test/repo' },
          ref: 'refs/heads/main',
          after: 'abc123',
        });
        const signature = generateSignature(payload, 'test-secret');
        mockRequest.headers['x-hub-signature-256'] = signature;
        mockRequest.rawBody = Buffer.from(payload);
        mockRequest.body = JSON.parse(payload);

        // Mock prisma
        vi.doMock('database', () => ({
          prisma: {
            service: {
              findMany: vi.fn().mockResolvedValue([]),
            },
          },
        }));

        await controller.handleGitHubWebhook(mockRequest, mockReply);

        expect(mockReply.status).toHaveBeenCalledWith(200);
        expect(mockReply.send).toHaveBeenCalledWith({ skipped: 'No matching service found' });
      });
    });

    describe('Pull Request Event Handling', () => {
      it('should skip PR event with no base service', async () => {
        const payload = JSON.stringify({
          action: 'opened',
          number: 123,
          pull_request: {
            head: { ref: 'feature', sha: 'abc123' },
            base: { repo: { html_url: 'https://github.com/test/repo' } },
          },
        });
        const signature = generateSignature(payload, 'test-secret');
        mockRequest.headers['x-hub-signature-256'] = signature;
        mockRequest.rawBody = Buffer.from(payload);
        mockRequest.body = JSON.parse(payload);

        // Mock prisma
        vi.doMock('database', () => ({
          prisma: {
            service: {
              findFirst: vi.fn().mockResolvedValue(null),
            },
          },
        }));

        await controller.handleGitHubWebhook(mockRequest, mockReply);

        expect(mockReply.status).toHaveBeenCalledWith(200);
        expect(mockReply.send).toHaveBeenCalledWith({ skipped: 'No base service found' });
      });

      it('should skip unhandled PR actions', async () => {
        const payload = JSON.stringify({
          action: 'labeled',
          number: 123,
          pull_request: {
            head: { ref: 'feature', sha: 'abc123' },
            base: { repo: { html_url: 'https://github.com/test/repo' } },
          },
        });
        const signature = generateSignature(payload, 'test-secret');
        mockRequest.headers['x-hub-signature-256'] = signature;
        mockRequest.rawBody = Buffer.from(payload);
        mockRequest.body = JSON.parse(payload);

        await controller.handleGitHubWebhook(mockRequest, mockReply);

        expect(mockReply.status).toHaveBeenCalledWith(200);
        expect(mockReply.send).toHaveBeenCalledWith({ skipped: 'Action labeled not handled' });
      });

      it('should skip PR closed event with no preview service', async () => {
        const payload = JSON.stringify({
          action: 'closed',
          number: 123,
          pull_request: {
            head: { ref: 'feature', sha: 'abc123' },
            base: { repo: { html_url: 'https://github.com/test/repo' } },
          },
        });
        const signature = generateSignature(payload, 'test-secret');
        mockRequest.headers['x-hub-signature-256'] = signature;
        mockRequest.rawBody = Buffer.from(payload);
        mockRequest.body = JSON.parse(payload);

        // Mock prisma
        vi.doMock('database', () => ({
          prisma: {
            service: {
              findFirst: vi.fn().mockResolvedValue(null),
            },
          },
        }));

        await controller.handleGitHubWebhook(mockRequest, mockReply);

        expect(mockReply.status).toHaveBeenCalledWith(200);
        expect(mockReply.send).toHaveBeenCalledWith({
          skipped: 'No preview service found to delete',
        });
      });
    });
  });
});
