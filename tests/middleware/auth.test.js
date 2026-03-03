/**
 * Auth middleware tests
 * Tests the middleware logic without needing a real Supabase instance
 */

// Mock supabase before requiring auth
jest.mock('../../src/services/supabase', () => null);

const auth = require('../../src/middleware/auth');

function mockReq(authHeader) {
  return { headers: { authorization: authHeader } };
}

function mockRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(data) {
      res.body = data;
      return res;
    },
  };
  return res;
}

describe('auth middleware', () => {
  test('rejects request with no authorization header', async () => {
    const req = mockReq(undefined);
    const res = mockRes();
    const next = jest.fn();

    await auth(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toContain('Missing');
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects request without Bearer prefix', async () => {
    const req = mockReq('Basic abc123');
    const res = mockRes();
    const next = jest.fn();

    await auth(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects request with empty Bearer token', async () => {
    const req = mockReq('Bearer ');
    const res = mockRes();
    const next = jest.fn();

    await auth(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 500 when supabase is unavailable', async () => {
    const req = mockReq('Bearer validtoken123');
    const res = mockRes();
    const next = jest.fn();

    await auth(req, res, next);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toContain('unavailable');
    expect(next).not.toHaveBeenCalled();
  });
});
