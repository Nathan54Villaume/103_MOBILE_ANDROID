// Mode "donn\u00e9es brutes" uniquement : jamais d'agr\u00e9gat minute c\u00f4t\u00e9 front.
export const RAW_ONLY = true;

// Cadence de polling (et de jonction live) par base de temps
export const TIMEBASE = [
  { maxMins: 15,   cadenceSec: 1,  histFactor: 1.00 },
  { maxMins: 60,   cadenceSec: 4,  histFactor: 1.00 },
  { maxMins: 240,  cadenceSec: 10, histFactor: 1.00 },
  { maxMins: 1440, cadenceSec: 15, histFactor: 1.00 },
  { maxMins: 2880, cadenceSec: 20, histFactor: 1.00 },
];

export function pickProfile(winMin) {
  return TIMEBASE.find(p => winMin <= p.maxMins) || TIMEBASE[TIMEBASE.length - 1];
}
export function pointsFor(winMin) {
  const { cadenceSec, histFactor } = pickProfile(winMin);
  const pts = Math.ceil((winMin * 60) / cadenceSec);
  return Math.ceil(pts * histFactor);
}
