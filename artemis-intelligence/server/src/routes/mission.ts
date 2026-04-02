import { Router, Request, Response } from 'express';
import { getArtemisIIMissionData, getAPOD, getNASAImages } from '../services/nasa';

export const missionRouter = Router();

missionRouter.get('/', (_req: Request, res: Response) => {
  const data = getArtemisIIMissionData();
  res.json(data);
});

missionRouter.get('/apod', async (_req: Request, res: Response) => {
  try {
    const apod = await getAPOD();
    res.json(apod);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch APOD' });
  }
});

missionRouter.get('/images', async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string) || 'Artemis II moon mission';
    const images = await getNASAImages(query);
    res.json(images);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch NASA images' });
  }
});
