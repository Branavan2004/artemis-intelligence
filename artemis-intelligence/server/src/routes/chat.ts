import { Router, Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getArtemisIIMissionData } from '../services/nasa';
import { chunkFallbackResponse, generateFallbackChatResponse } from '../services/chatFallback';

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

async function saveChatMessages(userId: string | undefined, message: string, response: string) {
  if (!userId) return;

  await prisma.chatMessage.createMany({
    data: [
      { userId, role: 'user', content: message },
      { userId, role: 'assistant', content: response },
    ],
  });
}

// Streaming chat endpoint
chatRouter.post('/stream', authenticate, async (req: AuthRequest, res: Response) => {
  const { message, history = [] } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('Missing Gemini API key');
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const contents = [
      ...history
        .filter((m: { role?: string; content?: string }) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .map((m: { role: string; content: string }) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
      { role: 'user' as const, parts: [{ text: message }] },
    ];

    let fullResponse = '';

    const stream = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash',
      contents,
      config: {
        systemInstruction: SYSTEM_PROMPT,
      },
    });

    for await (const chunk of stream) {
      const text = chunk.text;

      if (text) {
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }

    await saveChatMessages(req.userId, message, fullResponse);

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    console.error('Chat model unavailable, using fallback response:', err);

    const fallbackResponse = generateFallbackChatResponse(message);

    for (const chunk of chunkFallbackResponse(fallbackResponse)) {
      res.write(`data: ${JSON.stringify({ text: `${chunk} `, fallback: true })}\n\n`);
    }

    await saveChatMessages(req.userId, message, fallbackResponse);
    res.write(`data: ${JSON.stringify({ done: true, fallback: true })}\n\n`);
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
