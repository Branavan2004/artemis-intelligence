import { Router, Request, Response } from 'express';
import { getArtemisIIMissionData, getAPOD, getNASAImages } from '../services/nasa';
import { getMissionStatus } from '../constants/mission';
import { MISSION_COMPLETE_FALLBACK } from '../constants/fallback';

export const missionRouter = Router();

missionRouter.get('/', async (_req: Request, res: Response) => {
  try {
    // 1. Check if mission is complete — return static fallback immediately
    if (getMissionStatus() === 'Completed') {
      return res.json(MISSION_COMPLETE_FALLBACK.mission);
    }

    const data = getArtemisIIMissionData();
    res.json(data);
  } catch (error) {
    console.error('Mission route failed, using fallback:', error);
    res.json(MISSION_COMPLETE_FALLBACK.mission);
  }
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
