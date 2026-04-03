import { getCurrentMissionPhase, getMissionElapsedTime } from '../constants/mission';
import { getArtemisIIMissionData } from './nasa';

const mission = getArtemisIIMissionData();

function buildCrewSummary() {
  return mission.crew
    .map((member) => `${member.name} is the ${member.role} from ${member.agency}, notable for ${member.record.toLowerCase()}.`)
    .join(' ');
}

function buildObjectivesSummary() {
  return mission.objectives
    .map((objective, index) => `${index + 1}. ${objective}`)
    .join(' ');
}

function buildMissionOverview() {
  return `Artemis II is currently ${mission.status.toLowerCase()} at ${getMissionElapsedTime()} in the ${getCurrentMissionPhase()} phase. It is a ${mission.duration} crewed lunar mission using ${mission.spacecraft.rocket} to launch ${mission.spacecraft.name} from ${mission.spacecraft.launchSite}.`;
}

export function generateFallbackChatResponse(message: string) {
  const normalizedMessage = message.toLowerCase();
  const fallbackPrefix = 'Artemis AI is in fallback mode because the live Gemini model is unavailable right now. ';

  if (normalizedMessage.includes('phase') || normalizedMessage.includes('current') || normalizedMessage.includes('status')) {
    return `${fallbackPrefix}${buildMissionOverview()}`;
  }

  if (normalizedMessage.includes('crew') || normalizedMessage.includes('astronaut') || normalizedMessage.includes('wiseman') || normalizedMessage.includes('glover') || normalizedMessage.includes('koch') || normalizedMessage.includes('hansen')) {
    return `${fallbackPrefix}${buildCrewSummary()}`;
  }

  if (normalizedMessage.includes('objective') || normalizedMessage.includes('goal') || normalizedMessage.includes('purpose') || normalizedMessage.includes('mission')) {
    return `${fallbackPrefix}The main Artemis II objectives are ${buildObjectivesSummary()}`;
  }

  if (normalizedMessage.includes('orion') || normalizedMessage.includes('sls') || normalizedMessage.includes('rocket') || normalizedMessage.includes('spacecraft')) {
    return `${fallbackPrefix}${mission.spacecraft.name} rides on the ${mission.spacecraft.rocket}. The mission launches from ${mission.spacecraft.launchSite} and is planned to end with splashdown in the ${mission.spacecraft.splashdownTarget}.`;
  }

  if (normalizedMessage.includes('record') || normalizedMessage.includes('first') || normalizedMessage.includes('history')) {
    return `${fallbackPrefix}Artemis II is designed to be the first crewed lunar-vicinity mission since Apollo 17. The crew includes historic firsts such as Christina Koch becoming the first woman to travel to lunar vicinity, Victor Glover becoming the first person of color to do so, and Jeremy Hansen becoming the first non-American to go that far from Earth.`;
  }

  if (normalizedMessage.includes('apollo') || normalizedMessage.includes('different') || normalizedMessage.includes('compare')) {
    return `${fallbackPrefix}Apollo focused on short-duration Moon landings during the 1960s and 1970s, while Artemis is building a longer-term exploration program. Artemis II is the proving mission for Orion and SLS before future lunar landing missions like Artemis III.`;
  }

  return `${fallbackPrefix}${buildMissionOverview()} The crew is ${mission.crew.map((member) => member.name).join(', ')}. If you ask about the crew, spacecraft, records, or objectives, I can still answer from the project knowledge base.`;
}

export function chunkFallbackResponse(text: string) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
}
