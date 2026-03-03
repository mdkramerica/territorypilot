const { asyncHandler, errorHandler, notFoundHandler } = require('../../src/middleware/errorHandler');

describe('asyncHandler', () => {
  test('calls the wrapped function', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const wrapped = asyncHandler(fn);
    const req = {};
    const res = {};
    const next = jest.fn();

    await wrapped(req, res, next);

    expect(fn).toHaveBeenCalledWith(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });

  test('passes errors to next', async () => {
    const error = new Error('test error');
    const fn = jest.fn().mockRejectedValue(error);
    const wrapped = asyncHandler(fn);
    const next = jest.fn();

    await wrapped({}, {}, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

describe('errorHandler', () => {
  test('returns 500 with generic message', () => {
    const res = {
      statusCode: null,
      body: null,
      status(code) { res.statusCode = code; return res; },
      json(data) { res.body = data; return res; },
    };

    // Suppress console.error in test
    const spy = jest.spyOn(console, 'error').mockImplementation();
    errorHandler(new Error('secret details'), { method: 'GET', path: '/test' }, res, () => {});
    spy.mockRestore();

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('An unexpected error occurred');
    expect(res.body.error).not.toContain('secret');
  });

  test('returns 413 for entity too large', () => {
    const res = {
      statusCode: null,
      body: null,
      status(code) { res.statusCode = code; return res; },
      json(data) { res.body = data; return res; },
    };

    const spy = jest.spyOn(console, 'error').mockImplementation();
    errorHandler({ type: 'entity.too.large', message: 'too big' }, { method: 'POST', path: '/upload' }, res, () => {});
    spy.mockRestore();

    expect(res.statusCode).toBe(413);
  });
});

describe('notFoundHandler', () => {
  test('returns 404', () => {
    const res = {
      statusCode: null,
      body: null,
      status(code) { res.statusCode = code; return res; },
      json(data) { res.body = data; return res; },
    };

    notFoundHandler({}, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('Not found');
  });
});
