import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

// In-memory mock database representation
interface MockShareLink {
  id: string;
  token: string;
  content: string;
  createdAt: Date;
  expiresAt: Date | null;
  usedAt: Date | null;
}

let mockDatabase: MockShareLink[] = [];

// Mock Prisma client to keep tests independent of any live database
vi.mock('../src/db', () => ({
  prisma: {
    shareLink: {
      create: vi.fn(async ({ data }) => {
        const record: MockShareLink = {
          id: `id-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          token: data.token,
          content: data.content,
          createdAt: new Date(),
          expiresAt: data.expiresAt ?? null,
          usedAt: null,
        };
        mockDatabase.push(record);
        return {
          id: record.id,
          token: record.token,
          createdAt: record.createdAt,
          expiresAt: record.expiresAt,
          usedAt: record.usedAt,
        };
      }),
      findMany: vi.fn(async () => {
        return mockDatabase.map((r) => ({
          id: r.id,
          token: r.token,
          createdAt: r.createdAt,
          expiresAt: r.expiresAt,
          usedAt: r.usedAt,
        }));
      }),
      findUnique: vi.fn(async ({ where }) => {
        const item = mockDatabase.find((r) =>
          (where.id && r.id === where.id) || (where.token && r.token === where.token)
        );
        if (!item) return null;
        return { ...item };
      }),
      updateMany: vi.fn(async ({ where, data }) => {
        const now = new Date();
        const item = mockDatabase.find((r) => r.token === where.token);

        if (!item) return { count: 0 };
        if (item.usedAt !== null) return { count: 0 };
        if (item.expiresAt !== null && item.expiresAt <= now) return { count: 0 };

        // Atomic update condition met
        item.usedAt = data.usedAt;
        return { count: 1 };
      }),
      delete: vi.fn(async ({ where }) => {
        const idx = mockDatabase.findIndex((r) => r.id === where.id);
        if (idx === -1) {
          const error: any = new Error('Record not found');
          error.code = 'P2025';
          throw error;
        }
        const removed = mockDatabase.splice(idx, 1)[0];
        return removed;
      }),
    },
    $queryRaw: vi.fn(async () => [{ 1: 1 }]),
  },
  checkDatabaseConnection: vi.fn(async () => true),
}));

// Mock OpenTelemetry tracer to avoid tracing exporter overhead in unit tests
vi.mock('../src/tracing', () => ({
  tracer: {
    startActiveSpan: vi.fn(async (_name: string, fn: (span: any) => Promise<any>) => {
      const mockSpan = {
        setAttribute: vi.fn(),
        end: vi.fn(),
      };
      return await fn(mockSpan);
    }),
  },
  initTracing: vi.fn(),
}));

import app from '../src/app';

describe('One-Time Link Generator API Tests', () => {
  beforeEach(() => {
    mockDatabase = [];
  });

  // Test 1: Health check endpoint
  it('GET /api/health returns healthy status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.database).toBe('connected');
  });

  // Test 2: Successful link creation
  it('POST /api/links creates a link and does not expose note in metadata', async () => {
    const res = await request(app)
      .post('/api/links')
      .send({
        content: 'This is my super confidential password: Secret123!',
        expiresInMinutes: 60,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.token).toHaveLength(32);
    expect(res.body.data.status).toBe('Active');
    expect(res.body.data.content).toBeUndefined(); // Metadata must NEVER expose content
  });

  // Test 3: Validation error when content is empty
  it('POST /api/links fails with 400 when content is empty', async () => {
    const res = await request(app)
      .post('/api/links')
      .send({ content: '' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  // Test 4: Successful first access (consuming the link)
  it('POST /api/links/:token/consume allows successful first access', async () => {
    // 1. Create a link
    const createRes = await request(app)
      .post('/api/links')
      .send({ content: 'Confidential API Key: abc-xyz-789' });

    const token = createRes.body.data.token;

    // 2. Consume it for the first time
    const consumeRes = await request(app)
      .post(`/api/links/${token}/consume`);

    expect(consumeRes.status).toBe(200);
    expect(consumeRes.body.success).toBe(true);
    expect(consumeRes.body.data.content).toBe('Confidential API Key: abc-xyz-789');
  });

  // Test 5: Rejection of a second access
  it('POST /api/links/:token/consume rejects a second access attempt with 410', async () => {
    // 1. Create link
    const createRes = await request(app)
      .post('/api/links')
      .send({ content: 'One-time recovery code: 999-111' });

    const token = createRes.body.data.token;

    // 2. First access - should succeed
    const firstAttempt = await request(app).post(`/api/links/${token}/consume`);
    expect(firstAttempt.status).toBe(200);

    // 3. Second access - must be rejected
    const secondAttempt = await request(app).post(`/api/links/${token}/consume`);
    expect(secondAttempt.status).toBe(410);
    expect(secondAttempt.body.error).toBe('ALREADY_USED');
    expect(secondAttempt.body.message).toBe('This link has already been used.');
  });

  // Test 6: Expired link rejection
  it('POST /api/links/:token/consume rejects an expired link with 410', async () => {
    // Seed an expired link in mockDatabase
    const expiredToken = 'expired-token-1234567890abcdef123';
    mockDatabase.push({
      id: 'expired-id',
      token: expiredToken,
      content: 'Expired Secret Information',
      createdAt: new Date(Date.now() - 3600000),
      expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      usedAt: null,
    });

    const res = await request(app).post(`/api/links/${expiredToken}/consume`);
    expect(res.status).toBe(410);
    expect(res.body.error).toBe('EXPIRED');
    expect(res.body.message).toBe('This link has expired.');
  });

  // Test 7: Invalid token handling
  it('POST /api/links/:token/consume returns 404 for non-existent token', async () => {
    const res = await request(app).post('/api/links/totally-unknown-token-12345/consume');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
    expect(res.body.message).toBe('Link not found.');
  });

  // Test 8: Dashboard listing excludes content
  it('GET /api/links lists generated links without exposing note content', async () => {
    await request(app).post('/api/links').send({ content: 'Secret 1' });
    await request(app).post('/api/links').send({ content: 'Secret 2' });

    const listRes = await request(app).get('/api/links');
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(2);
    expect(listRes.body.data[0].content).toBeUndefined();
    expect(listRes.body.data[1].content).toBeUndefined();
    expect(listRes.body.data[0].status).toBe('Active');
  });

  // Test 9: Link deletion
  it('DELETE /api/links/:id removes link from storage', async () => {
    const createRes = await request(app).post('/api/links').send({ content: 'Delete me' });
    const linkId = createRes.body.data.id;

    const delRes = await request(app).delete(`/api/links/${linkId}`);
    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);

    const getRes = await request(app).get(`/api/links/${linkId}`);
    expect(getRes.status).toBe(404);
  });
});
