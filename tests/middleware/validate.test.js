const {
  registerSchema,
  loginSchema,
  magicLinkSchema,
  createAccountSchema,
  updateAccountSchema,
  optimizeRouteSchema,
  savePlanSchema,
  generateBriefSchema,
  checkoutSchema,
} = require('../../src/middleware/validate');

describe('registerSchema', () => {
  test('accepts valid email and password', () => {
    const { error } = registerSchema.validate({ email: 'test@example.com', password: 'password123' });
    expect(error).toBeUndefined();
  });

  test('rejects missing email', () => {
    const { error } = registerSchema.validate({ password: 'password123' });
    expect(error).toBeDefined();
  });

  test('rejects missing password', () => {
    const { error } = registerSchema.validate({ email: 'test@example.com' });
    expect(error).toBeDefined();
  });

  test('rejects short password', () => {
    const { error } = registerSchema.validate({ email: 'test@example.com', password: '1234567' });
    expect(error).toBeDefined();
    expect(error.details[0].message).toContain('8');
  });

  test('rejects invalid email', () => {
    const { error } = registerSchema.validate({ email: 'not-an-email', password: 'password123' });
    expect(error).toBeDefined();
  });

  test('rejects password over 128 chars', () => {
    const { error } = registerSchema.validate({
      email: 'test@example.com',
      password: 'a'.repeat(129),
    });
    expect(error).toBeDefined();
  });
});

describe('loginSchema', () => {
  test('accepts valid credentials', () => {
    const { error } = loginSchema.validate({ email: 'test@example.com', password: 'any' });
    expect(error).toBeUndefined();
  });

  test('rejects empty body', () => {
    const { error } = loginSchema.validate({});
    expect(error).toBeDefined();
  });
});

describe('magicLinkSchema', () => {
  test('accepts valid email', () => {
    const { error } = magicLinkSchema.validate({ email: 'test@example.com' });
    expect(error).toBeUndefined();
  });

  test('rejects missing email', () => {
    const { error } = magicLinkSchema.validate({});
    expect(error).toBeDefined();
  });
});

describe('createAccountSchema', () => {
  test('accepts minimal account (name only)', () => {
    const { error, value } = createAccountSchema.validate({ name: 'Acme Corp' });
    expect(error).toBeUndefined();
    expect(value.priority).toBe(2);
    expect(value.visit_frequency_days).toBe(30);
  });

  test('accepts full account data', () => {
    const { error } = createAccountSchema.validate({
      name: 'Acme Corp',
      address: '123 Main St',
      contact_name: 'John Doe',
      contact_email: 'john@acme.com',
      contact_phone: '555-0100',
      notes: 'Big client',
      priority: 1,
      visit_frequency_days: 14,
    });
    expect(error).toBeUndefined();
  });

  test('rejects missing name', () => {
    const { error } = createAccountSchema.validate({ address: '123 Main St' });
    expect(error).toBeDefined();
  });

  test('rejects invalid priority', () => {
    const { error } = createAccountSchema.validate({ name: 'Test', priority: 5 });
    expect(error).toBeDefined();
  });

  test('rejects priority 0', () => {
    const { error } = createAccountSchema.validate({ name: 'Test', priority: 0 });
    expect(error).toBeDefined();
  });

  test('rejects visit_frequency_days over 365', () => {
    const { error } = createAccountSchema.validate({ name: 'Test', visit_frequency_days: 400 });
    expect(error).toBeDefined();
  });

  test('rejects name over 255 chars', () => {
    const { error } = createAccountSchema.validate({ name: 'a'.repeat(256) });
    expect(error).toBeDefined();
  });

  test('rejects notes over 2000 chars', () => {
    const { error } = createAccountSchema.validate({ name: 'Test', notes: 'a'.repeat(2001) });
    expect(error).toBeDefined();
  });

  test('strips unknown fields when stripUnknown is enabled', () => {
    const { value } = createAccountSchema.validate(
      { name: 'Test', malicious: '<script>' },
      { stripUnknown: true }
    );
    expect(value.malicious).toBeUndefined();
  });
});

describe('updateAccountSchema', () => {
  test('accepts partial update', () => {
    const { error } = updateAccountSchema.validate({ name: 'New Name' });
    expect(error).toBeUndefined();
  });

  test('rejects empty update', () => {
    const { error } = updateAccountSchema.validate({});
    expect(error).toBeDefined();
  });
});

describe('optimizeRouteSchema', () => {
  test('accepts valid data', () => {
    const { error } = optimizeRouteSchema.validate({
      accountIds: ['550e8400-e29b-41d4-a716-446655440000'],
      startLat: 40.71,
      startLng: -74.0,
    });
    expect(error).toBeUndefined();
  });

  test('rejects empty accountIds', () => {
    const { error } = optimizeRouteSchema.validate({ accountIds: [] });
    expect(error).toBeDefined();
  });

  test('rejects non-UUID accountIds', () => {
    const { error } = optimizeRouteSchema.validate({ accountIds: ['not-a-uuid'] });
    expect(error).toBeDefined();
  });

  test('rejects lat out of range', () => {
    const { error } = optimizeRouteSchema.validate({
      accountIds: ['550e8400-e29b-41d4-a716-446655440000'],
      startLat: 91,
    });
    expect(error).toBeDefined();
  });

  test('defaults startLat/startLng to 0', () => {
    const { value } = optimizeRouteSchema.validate({
      accountIds: ['550e8400-e29b-41d4-a716-446655440000'],
    });
    expect(value.startLat).toBe(0);
    expect(value.startLng).toBe(0);
  });
});

describe('savePlanSchema', () => {
  test('accepts valid plan', () => {
    const { error } = savePlanSchema.validate({
      plan_date: '2026-03-04',
      account_ids: ['550e8400-e29b-41d4-a716-446655440000'],
    });
    expect(error).toBeUndefined();
  });

  test('rejects invalid date format', () => {
    const { error } = savePlanSchema.validate({
      plan_date: '03/04/2026',
      account_ids: ['550e8400-e29b-41d4-a716-446655440000'],
    });
    expect(error).toBeDefined();
  });

  test('rejects missing fields', () => {
    const { error } = savePlanSchema.validate({});
    expect(error).toBeDefined();
  });
});

describe('generateBriefSchema', () => {
  test('accepts valid UUID', () => {
    const { error } = generateBriefSchema.validate({
      accountId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(error).toBeUndefined();
  });

  test('rejects non-UUID', () => {
    const { error } = generateBriefSchema.validate({ accountId: 'bad-id' });
    expect(error).toBeDefined();
  });
});

describe('checkoutSchema', () => {
  test('accepts valid plans', () => {
    for (const plan of ['solo', 'team', 'agency']) {
      const { error } = checkoutSchema.validate({ plan });
      expect(error).toBeUndefined();
    }
  });

  test('rejects invalid plan', () => {
    const { error } = checkoutSchema.validate({ plan: 'enterprise' });
    expect(error).toBeDefined();
  });

  test('rejects missing plan', () => {
    const { error } = checkoutSchema.validate({});
    expect(error).toBeDefined();
  });
});
