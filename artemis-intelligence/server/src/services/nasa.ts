import axios from 'axios';
import { cacheGet, cacheSet } from './redis';
import { ARTEMIS_II_LAUNCH_DATE, getMissionProgress, getMissionStatus } from '../constants/mission';

const NASA_BASE_URL = 'https://api.nasa.gov';
const API_KEY = process.env.NASA_API_KEY || 'DEMO_KEY';

export async function getAPOD() {
  const cacheKey = 'nasa:apod';
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const { data } = await axios.get(`${NASA_BASE_URL}/planetary/apod`, {
    params: { api_key: API_KEY },
  });

  await cacheSet(cacheKey, data, 3600);
  return data;
}

export async function getNASAImages(query: string) {
  const cacheKey = `nasa:images:${query}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const { data } = await axios.get('https://images-api.nasa.gov/search', {
    params: { q: query, media_type: 'image', page_size: 10 },
  });

  await cacheSet(cacheKey, data.collection.items, 3600);
  return data.collection.items;
}

export function getArtemisIIMissionData() {
  return {
    name: 'Artemis II',
    launchDate: ARTEMIS_II_LAUNCH_DATE.toISOString(),
    duration: '10 days',
    progress: Math.round(getMissionProgress()),
    status: getMissionStatus(),
    crew: [
      { name: 'Reid Wiseman', role: 'Commander', agency: 'NASA', record: 'Oldest person to leave low Earth orbit' },
      { name: 'Victor Glover', role: 'Pilot', agency: 'NASA', record: 'First person of color beyond low Earth orbit' },
      { name: 'Christina Koch', role: 'Mission Specialist', agency: 'NASA', record: 'First woman to travel to lunar vicinity' },
      { name: 'Jeremy Hansen', role: 'Mission Specialist', agency: 'CSA', record: 'First non-American to travel to lunar vicinity' },
    ],
    objectives: [
      'Test Orion spacecraft systems with crew aboard',
      'Validate life support systems in deep space',
      'Conduct lunar flyby on free-return trajectory',
      'Set records for furthest humans from Earth since Apollo',
      'Pave the way for Artemis III moon landing',
    ],
    phases: [
      { name: 'Pre-Launch', startHour: -24, endHour: 0 },
      { name: 'Earth Orbit & Systems Check', startHour: 0, endHour: 24 },
      { name: 'Translunar Injection', startHour: 24, endHour: 72 },
      { name: 'Lunar Flyby', startHour: 72, endHour: 96 },
      { name: 'Return Trajectory', startHour: 96, endHour: 216 },
      { name: 'Reentry & Splashdown', startHour: 216, endHour: 240 },
    ],
    spacecraft: {
      name: 'Orion (Integrity)',
      rocket: 'Space Launch System (SLS)',
      launchSite: 'Kennedy Space Center, LC-39B',
      splashdownTarget: 'Pacific Ocean',
    },
  };
}
