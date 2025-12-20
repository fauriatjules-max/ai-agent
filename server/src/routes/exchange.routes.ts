import express from 'express';
import { body, param, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.middleware';
import { sendNotification } from '../services/notification.service';

const router = express.Router();
const prisma = new PrismaClient();

// Create exchange
router.post('/', [
  body('title').trim().notEmpty(),
  body('description').optional().trim(),
  body('skillId').notEmpty(),
  body('neederId').notEmpty(),
  body('duration').isInt({ min: 1, max: 24 }),
  body('scheduledAt').optional().isISO8601(),
  body('location').optional().trim()
], authenticate, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = (req as any).userId;
    const { title, description, skillId, neederId, duration, scheduledAt, location } = req.body;

    // Verify skill belongs to helper
    const skill = await prisma.skill.findFirst({
      where: { id: skillId, userId }
    });

    if (!skill) {
      return res.status(403).json({ error: 'Skill not found or not authorized' });
    }

    // Verify needer exists
    const needer = await prisma.user.findUnique({
      where: { id: neederId }
    });

    if (!needer) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify both users have enough credits
    const helperCredits = await prisma.credit.findUnique({
      where: { userId }
    });

    const neederCredits = await prisma.credit.findUnique({
      where: { userId: neederId }
    });

    if (neederCredits!.balance < duration) {
      return res.status(400).json({ error: 'Not enough credits' });
    }

    // Create exchange
    const exchange = await prisma.exchange.create({
      data: {
        title,
        description,
        skillId,
        helperId: userId,
        neederId,
        duration,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        location,
        chat: {
          create: {}
        }
      },
      include: {
        helper: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true
          }
        },
        needer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true
          }
        },
        skill: true,
        chat: true
      }
    });

    // Send notification to needer
    await sendNotification(
      neederId,
      'exchange_request',
      'Nouvelle demande d\'échange',
      `${exchange.helper.firstName} vous propose ${duration}h de ${skill.name}`
    );

    res.status(201).json(exchange);
  } catch (error) {
    console.error('Create exchange error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Accept exchange
router.post('/:id/accept', [
  param('id').notEmpty()
], authenticate, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;

    const exchange = await prisma.exchange.findUnique({
      where: { id },
      include: {
        helper: true,
        needer: true
      }
    });

    if (!exchange) {
      return res.status(404).json({ error: 'Exchange not found' });
    }

    if (exchange.neederId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (exchange.status !== 'PENDING') {
      return res.status(400).json({ error: 'Exchange already processed' });
    }

    // Reserve credits
    await prisma.$transaction(async (tx) => {
      // Lock needer credits
      const neederCredit = await tx.credit.findUnique({
        where: { userId: exchange.neederId },
        select: { balance: true }
      });

      if (neederCredit!.balance < exchange.duration) {
        throw new Error('Not enough credits');
      }

      // Update exchange
      await tx.exchange.update({
        where: { id },
        data: {
          status: 'ACCEPTED',
          updatedAt: new Date()
        }
      });

      // Create transaction
      await tx.transaction.create({
        data: {
          creditId: exchange.neederId,
          amount: exchange.duration,
          type: 'CREDIT_RESERVED',
          description: `Réservation pour: ${exchange.title}`,
          exchangeId: exchange.id
        }
      });
    });

    // Send notification to helper
    await sendNotification(
      exchange.helperId,
      'exchange_accepted',
      'Échange accepté !',
      `${exchange.needer.firstName} a accepté votre proposition`
    );

    res.json({ message: 'Exchange accepted successfully' });
  } catch (error) {
    console.error('Accept exchange error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Complete exchange
router.post('/:id/complete', [
  param('id').notEmpty()
], authenticate, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;
    const { rating, comment } = req.body;

    const exchange = await prisma.exchange.findUnique({
      where: { id },
      include: {
        helper: true,
        needer: true
      }
    });

    if (!exchange) {
      return res.status(404).json({ error: 'Exchange not found' });
    }

    if (![exchange.helperId, exchange.neederId].includes(userId)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (exchange.status !== 'IN_PROGRESS') {
      return res.status(400).json({ error: 'Exchange not in progress' });
    }

    await prisma.$transaction(async (tx) => {
      // Update exchange
      await tx.exchange.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          updatedAt: new Date()
        }
      });

      // Transfer credits
      await tx.transaction.createMany({
        data: [
          {
            creditId: exchange.helperId,
            amount: exchange.duration,
            type: 'CREDIT_EARNED',
            description: `Échange: ${exchange.title}`,
            exchangeId: exchange.id
          },
          {
            creditId: exchange.neederId,
            amount: -exchange.duration,
            type: 'CREDIT_SPENT',
            description: `Échange: ${exchange.title}`,
            exchangeId: exchange.id
          }
        ]
      });

      // Update credit balances
      await tx.credit.update({
        where: { userId: exchange.helperId },
        data: {
          balance: { increment: exchange.duration }
        }
      });

      await tx.credit.update({
        where: { userId: exchange.neederId },
        data: {
          balance: { decrement: exchange.duration }
        }
      });

      // Create rating if provided
      if (rating) {
        const raterId = userId;
        const ratedId = userId === exchange.helperId ? exchange.neederId : exchange.helperId;

        await tx.rating.create({
          data: {
            exchangeId: exchange.id,
            raterId,
            ratedId,
            score: rating,
            comment
          }
        });
      }
    });

    // Send notifications
    const otherUserId = userId === exchange.helperId ? exchange.neederId : exchange.helperId;
    await sendNotification(
      otherUserId,
      'exchange_completed',
      'Échange terminé',
      `L'échange "${exchange.title}" est maintenant terminé`
    );

    res.json({ message: 'Exchange completed successfully' });
  } catch (error) {
    console.error('Complete exchange error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user exchanges
router.get('/my-exchanges', authenticate, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { status, role, page = 1, limit = 20 } = req.query;

    const where: any = {
      OR: [
        { helperId: userId },
        { neederId: userId }
      ]
    };

    if (status) where.status = status;
    if (role === 'helper') where.helperId = userId;
    if (role === 'needer') where.neederId = userId;

    const exchanges = await prisma.exchange.findMany({
      where,
      include: {
        helper: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            city: true
          }
        },
        needer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            city: true
          }
        },
        skill: true,
        ratings: true,
        _count: {
          select: { ratings: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit)
    });

    const total = await prisma.exchange.count({ where });

    res.json({
      exchanges,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Get exchanges error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get exchange by ID
router.get('/:id', [
  param('id').notEmpty()
], authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const exchange = await prisma.exchange.findUnique({
      where: { id },
      include: {
        helper: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            bio: true,
            city: true,
            _count: {
              select: {
                exchangesAsHelper: true,
                ratingsReceived: true
              }
            },
            ratingsReceived: {
              take: 5,
              orderBy: { createdAt: 'desc' },
              include: {
                rater: {
                  select: {
                    firstName: true,
                    lastName: true,
                    avatarUrl: true
                  }
                }
              }
            }
          }
        },
        needer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            bio: true,
            city: true,
            _count: {
              select: {
                exchangesAsNeeder: true,
                ratingsReceived: true
              }
            },
            ratingsReceived: {
              take: 5,
              orderBy: { createdAt: 'desc' },
              include: {
                rater: {
                  select: {
                    firstName: true,
                    lastName: true,
                    avatarUrl: true
                  }
                }
              }
            }
          }
        },
        skill: true,
        chat: {
          include: {
            messages: {
              take: 50,
              orderBy: { createdAt: 'desc' },
              include: {
                sender: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    avatarUrl: true
                  }
                }
              }
            }
          }
        },
        ratings: {
          include: {
            rater: {
              select: {
                firstName: true,
                lastName: true,
                avatarUrl: true
              }
            }
          }
        }
      }
    });

    if (!exchange) {
      return res.status(404).json({ error: 'Exchange not found' });
    }

    res.json(exchange);
  } catch (error) {
    console.error('Get exchange error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
