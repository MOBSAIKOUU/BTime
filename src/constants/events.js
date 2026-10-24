export const EVENTS = [
  { code: '333', label: '3x3' },
  { code: '222', label: '2x2' },
  { code: '444', label: '4x4' },
  { code: '555', label: '5x5' },
  { code: '666', label: '6x6' },
  { code: '777', label: '7x7' },
  { code: 'clock', label: 'Clock' },
  { code: 'minx', label: 'Megaminx' },
  { code: 'pyram', label: 'Pyraminx' },
  { code: 'skewb', label: 'Skewb' },
  { code: 'sq1', label: 'Square-1' },
];

export const CUBE_EVENTS = new Set(['222', '333', '444', '555', '666', '777']);
export const VALID_MOVE_REGEX = /^(?:[URFDLB]w?|[2-6][URFDLB]w?|[urfdlb])(?:2|')?$/;

export function getEventLabel(eventCode) {
  return EVENTS.find((event) => event.code === eventCode)?.label || eventCode;
}

