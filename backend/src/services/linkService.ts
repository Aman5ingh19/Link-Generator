import crypto from 'crypto';
import { prisma } from '../db';
import { tracer } from '../tracing';

export type LinkStatus = 'Active' | 'Used' | 'Expired';

export interface LinkMetadata {
  id: string;
  token: string;
  createdAt: Date;
  expiresAt: Date | null;
  usedAt: Date | null;
  status: LinkStatus;
}

export interface CreateLinkInput {
  content: string;
  expiresInMinutes?: number; // e.g. 5, 60, 1440 (1 day), etc.
}

interface MemoryRecord {
  id: string;
  token: string;
  content: string;
  createdAt: Date;
  expiresAt: Date | null;
  usedAt: Date | null;
}

// Resilient in-memory store for instant local testing before Aiven MySQL credentials are configured
const memoryStore: MemoryRecord[] = [];
let hasLoggedFallbackWarning = false;

function notifyFallback() {
  if (!hasLoggedFallbackWarning) {
    console.warn('\n⚠️ [Database Notice]: Could not reach Aiven MySQL (or credentials not configured yet).');
    console.warn('👉 Operating in In-Memory Demo Mode so you can test all features right now.');
    console.warn('👉 To connect to Aiven MySQL, update DATABASE_URL in backend/.env with your Aiven URI.\n');
    hasLoggedFallbackWarning = true;
  }
}

export class LinkService {
  /**
   * Helper to determine link status based on timestamps
   */
  public static computeStatus(link: { usedAt: Date | null; expiresAt: Date | null }): LinkStatus {
    if (link.usedAt !== null) {
      return 'Used';
    }
    if (link.expiresAt !== null && new Date() > new Date(link.expiresAt)) {
      return 'Expired';
    }
    return 'Active';
  }

  /**
   * Generates a cryptographically random, unpredictable 32-character hex token
   */
  public static generateSecureToken(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Creates a new one-time link
   */
  public static async createLink(input: CreateLinkInput): Promise<LinkMetadata> {
    return tracer.startActiveSpan('linkService.createLink', async (span) => {
      try {
        const token = this.generateSecureToken();
        const now = new Date();
        let expiresAt: Date | null = null;

        if (input.expiresInMinutes && input.expiresInMinutes > 0) {
          expiresAt = new Date(now.getTime() + input.expiresInMinutes * 60 * 1000);
        }

        try {
          // Attempt persistence via Prisma (Aiven MySQL)
          const link = await prisma.shareLink.create({
            data: {
              token,
              content: input.content,
              expiresAt,
            },
            select: {
              id: true,
              token: true,
              createdAt: true,
              expiresAt: true,
              usedAt: true,
            },
          });

          span.setAttribute('link.id', link.id);
          span.setAttribute('link.token', link.token);
          span.setAttribute('link.has_expiration', Boolean(expiresAt));

          return {
            ...link,
            status: 'Active' as LinkStatus,
          };
        } catch (dbErr: any) {
          notifyFallback();
          const memoryRecord: MemoryRecord = {
            id: `mem-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            token,
            content: input.content,
            createdAt: now,
            expiresAt,
            usedAt: null,
          };
          memoryStore.push(memoryRecord);

          return {
            id: memoryRecord.id,
            token: memoryRecord.token,
            createdAt: memoryRecord.createdAt,
            expiresAt: memoryRecord.expiresAt,
            usedAt: memoryRecord.usedAt,
            status: 'Active' as LinkStatus,
          };
        }
      } finally {
        span.end();
      }
    });
  }

  /**
   * List all links with metadata only (content is strictly excluded)
   */
  public static async listLinks(): Promise<LinkMetadata[]> {
    return tracer.startActiveSpan('linkService.listLinks', async (span) => {
      try {
        try {
          const links = await prisma.shareLink.findMany({
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              token: true,
              createdAt: true,
              expiresAt: true,
              usedAt: true,
            },
          });

          span.setAttribute('links.count', links.length);

          return links.map((link) => ({
            ...link,
            status: this.computeStatus(link),
          }));
        } catch (dbErr: any) {
          notifyFallback();
          return memoryStore.map((link) => ({
            id: link.id,
            token: link.token,
            createdAt: link.createdAt,
            expiresAt: link.expiresAt,
            usedAt: link.usedAt,
            status: this.computeStatus(link),
          }));
        }
      } finally {
        span.end();
      }
    });
  }

  /**
   * Get metadata for a specific link by ID (content is strictly excluded)
   */
  public static async getLinkById(id: string): Promise<LinkMetadata | null> {
    return tracer.startActiveSpan('linkService.getLinkById', async (span) => {
      try {
        span.setAttribute('link.id', id);

        try {
          const link = await prisma.shareLink.findUnique({
            where: { id },
            select: {
              id: true,
              token: true,
              createdAt: true,
              expiresAt: true,
              usedAt: true,
            },
          });

          if (!link) return null;

          return {
            ...link,
            status: this.computeStatus(link),
          };
        } catch (dbErr: any) {
          notifyFallback();
          const mem = memoryStore.find((m) => m.id === id);
          if (!mem) return null;

          return {
            id: mem.id,
            token: mem.token,
            createdAt: mem.createdAt,
            expiresAt: mem.expiresAt,
            usedAt: mem.usedAt,
            status: this.computeStatus(mem),
          };
        }
      } finally {
        span.end();
      }
    });
  }

  /**
   * Consumes a link exactly once using an atomic database update to prevent race conditions.
   * Two simultaneous requests cannot both consume the link.
   */
  public static async consumeLink(token: string): Promise<{
    success: boolean;
    content?: string;
    errorType?: 'NOT_FOUND' | 'ALREADY_USED' | 'EXPIRED';
    message?: string;
  }> {
    return tracer.startActiveSpan('linkService.consumeLink', async (span) => {
      try {
        span.setAttribute('link.token', token);
        const now = new Date();

        try {
          // Step 1: Execute atomic conditional update in MySQL
          const updateResult = await prisma.shareLink.updateMany({
            where: {
              token,
              usedAt: null,
              OR: [
                { expiresAt: null },
                { expiresAt: { gt: now } },
              ],
            },
            data: {
              usedAt: now,
            },
          });

          // If count === 1, this request exclusively claimed and consumed the link.
          if (updateResult.count === 1) {
            const consumedLink = await prisma.shareLink.findUnique({
              where: { token },
              select: { content: true },
            });

            span.setAttribute('consume.outcome', 'success');
            return {
              success: true,
              content: consumedLink?.content ?? '',
            };
          }

          // If count === 0, inspect reason
          const existingLink = await prisma.shareLink.findUnique({
            where: { token },
            select: { usedAt: true, expiresAt: true },
          });

          if (!existingLink) {
            span.setAttribute('consume.outcome', 'not_found');
            return {
              success: false,
              errorType: 'NOT_FOUND' as const,
              message: 'Link not found.',
            };
          }

          if (existingLink.usedAt !== null) {
            span.setAttribute('consume.outcome', 'already_used');
            return {
              success: false,
              errorType: 'ALREADY_USED' as const,
              message: 'This link has already been used.',
            };
          }

          if (existingLink.expiresAt !== null && existingLink.expiresAt <= now) {
            span.setAttribute('consume.outcome', 'expired');
            return {
              success: false,
              errorType: 'EXPIRED' as const,
              message: 'This link has expired.',
            };
          }

          return {
            success: false,
            errorType: 'NOT_FOUND' as const,
            message: 'Unable to access this link.',
          };
        } catch (dbErr: any) {
          notifyFallback();
          // In-memory atomic consumption fallback
          const mem = memoryStore.find((m) => m.token === token);
          if (!mem) {
            return {
              success: false,
              errorType: 'NOT_FOUND' as const,
              message: 'Link not found.',
            };
          }

          if (mem.usedAt !== null) {
            return {
              success: false,
              errorType: 'ALREADY_USED' as const,
              message: 'This link has already been used.',
            };
          }

          if (mem.expiresAt !== null && mem.expiresAt <= now) {
            return {
              success: false,
              errorType: 'EXPIRED' as const,
              message: 'This link has expired.',
            };
          }

          // Atomically burn in memory
          mem.usedAt = now;
          return {
            success: true,
            content: mem.content,
          };
        }
      } finally {
        span.end();
      }
    });
  }

  /**
   * Delete a link by ID
   */
  public static async deleteLink(id: string): Promise<boolean> {
    return tracer.startActiveSpan('linkService.deleteLink', async (span) => {
      try {
        span.setAttribute('link.id', id);

        try {
          await prisma.shareLink.delete({
            where: { id },
          });
          return true;
        } catch (err: any) {
          if (err.code === 'P2025') {
            return false;
          }
          // If connection error, check memory store
          notifyFallback();
          const idx = memoryStore.findIndex((m) => m.id === id);
          if (idx !== -1) {
            memoryStore.splice(idx, 1);
            return true;
          }
          return false;
        }
      } finally {
        span.end();
      }
    });
  }
}
