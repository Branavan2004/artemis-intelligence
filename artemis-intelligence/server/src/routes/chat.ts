import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getArtemisIIMissionData } from '../services/nasa';

const prisma = new PrismaClient();
export const chatRouter = Router();

const SYSTEM_PROMPT = `You are Artemis AI, an intelligent assistant specialized in NASA's Artemis II mission.
You have deep knowledge about:
- The Artemis II mission details, crew, objectives, and timeline
- Space exploration history (Apollo program vs Artemis program)
- The Space Launch System (SLS) rocket and Orion spacecraft
- The four crew members: Reid Wiseman, Victor Glover, Christina Koch, Jeremy Hansen
- Future plans: Artemis III moon landing, Gateway space station, Mars exploration

Current mission data:
${JSON.stringify(getArtemisIIMissionData(), null, 2)}

Be engaging, informative, and enthusiastic about space exploration.`;

// Streaming chat endpoint
chatRouter.post('/stream', authenticate, async (req: AuthRequest, res: Response) => {
  const { message, history = [] } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    // Dynamically import Anthropic only when API key is real
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const messages = [
      ...history.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: message },
    ];

    let fullResponse = '';

    const stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages,
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        const text = chunk.delta.text;
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }

    if (req.userId) {
      await prisma.chatMessage.createMany({
        data: [
          { userId: req.userId, role: 'user', content: message },
          { userId: req.userId, role: 'assistant', content: fullResponse },
        ],
      });
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: 'AI service unavailable' })}\n\n`);
    res.end();
  }
});

// Get chat history
chatRouter.get('/history', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const history = await prisma.chatMessage.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
    res.json(history);
  } catch {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});
