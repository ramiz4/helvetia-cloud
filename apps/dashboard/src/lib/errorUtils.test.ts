import { describe, expect, it } from 'vitest';
import { getErrorMessage } from './errorUtils';

describe('getErrorMessage', () => {
  it('should return message from data.message', async () => {
    const response = {
      json: async () => ({ message: 'Error from message' }),
      status: 400,
    } as Response;
    const result = await getErrorMessage(response);
    expect(result).toBe('Error from message');
  });

  it('should return message from data.details[0].message', async () => {
    const response = {
      json: async () => ({ details: [{ message: 'Error from details' }] }),
      status: 400,
    } as Response;
    const result = await getErrorMessage(response);
    expect(result).toBe('Error from details');
  });

  it('should return error from data.error (string)', async () => {
    const response = {
      json: async () => ({ error: 'Error from error string' }),
      status: 400,
    } as Response;
    const result = await getErrorMessage(response);
    expect(result).toBe('Error from error string');
  });

  it('should return error from data.error.message', async () => {
    const response = {
      json: async () => ({ error: { message: 'Error from error message' } }),
      status: 400,
    } as Response;
    const result = await getErrorMessage(response);
    expect(result).toBe('Error from error message');
  });

  it('should return default message with status when no recognized format is found', async () => {
    const response = {
      json: async () => ({ unexpected: 'format' }),
      status: 500,
    } as Response;
    const result = await getErrorMessage(response, 'Custom Default');
    expect(result).toBe('Custom Default (Status 500)');
  });

  it('should return default message with status when json() throws', async () => {
    const response = {
      json: async () => {
        throw new Error('JSON parse error');
      },
      status: 502,
    } as unknown as Response;
    const result = await getErrorMessage(response, 'Fallback');
    expect(result).toBe('Fallback (Status 502)');
  });
});
