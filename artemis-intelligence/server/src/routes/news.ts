import { Router, Request, Response } from 'express';
import axios from 'axios';
import { cacheGet, cacheSet } from '../services/redis';

export const newsRouter = Router();

newsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const cacheKey = 'news:artemis';
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const { data } = await axios.get('https://api.spaceflightnewsapi.net/v4/articles', {
      params: { limit: 10, search: 'Artemis' },
    });

    await cacheSet(cacheKey, data.results, 1800);
    res.json(data.results);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch news' });
  }
});
