import { Router, Request, Response } from 'express';
import { LinkService } from '../services/linkService';

const router = Router();

/**
 * POST /api/links
 * Create a new one-time link
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { content, expiresInMinutes } = req.body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Content cannot be empty.',
      });
    }

    let parsedExpiry: number | undefined = undefined;
    if (expiresInMinutes !== undefined && expiresInMinutes !== null) {
      parsedExpiry = Number(expiresInMinutes);
      if (isNaN(parsedExpiry) || parsedExpiry <= 0) {
        return res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'Expiration time must be a positive number of minutes.',
        });
      }
    }

    const createdLink = await LinkService.createLink({
      content: content.trim(),
      expiresInMinutes: parsedExpiry,
    });

    return res.status(201).json({
      success: true,
      data: createdLink,
    });
  } catch (error: any) {
    console.error('[API] Error creating link:', error);
    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Failed to create one-time link. Please verify database connectivity.',
    });
  }
});

/**
 * GET /api/links
 * List all generated links (metadata only, no content)
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const links = await LinkService.listLinks();
    return res.json({
      success: true,
      data: links,
    });
  } catch (error: any) {
    console.error('[API] Error listing links:', error);
    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Failed to retrieve links.',
    });
  }
});

/**
 * GET /api/links/:id
 * Retrieve metadata for a single link (metadata only, no content)
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const link = await LinkService.getLinkById(id);

    if (!link) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Link not found.',
      });
    }

    return res.json({
      success: true,
      data: link,
    });
  } catch (error: any) {
    console.error('[API] Error fetching link:', error);
    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Failed to retrieve link metadata.',
    });
  }
});

/**
 * POST /api/links/:token/consume
 * Access and consume a link exactly once
 */
router.post('/:token/consume', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'INVALID_TOKEN',
        message: 'Invalid link token.',
      });
    }

    const result = await LinkService.consumeLink(token);

    if (result.success) {
      return res.json({
        success: true,
        data: {
          content: result.content,
        },
      });
    }

    // Specific error mapping for one-time access rules
    if (result.errorType === 'ALREADY_USED') {
      return res.status(410).json({
        success: false,
        error: 'ALREADY_USED',
        message: result.message,
      });
    }

    if (result.errorType === 'EXPIRED') {
      return res.status(410).json({
        success: false,
        error: 'EXPIRED',
        message: result.message,
      });
    }

    return res.status(404).json({
      success: false,
      error: 'NOT_FOUND',
      message: result.message || 'Link not found.',
    });
  } catch (error: any) {
    console.error('[API] Error consuming link:', error);
    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Failed to access one-time link.',
    });
  }
});

/**
 * DELETE /api/links/:id
 * Delete a link by ID
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await LinkService.deleteLink(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Link not found.',
      });
    }

    return res.json({
      success: true,
      message: 'Link deleted successfully.',
    });
  } catch (error: any) {
    console.error('[API] Error deleting link:', error);
    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Failed to delete link.',
    });
  }
});

export default router;
