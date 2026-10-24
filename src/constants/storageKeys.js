export const STORAGE_KEY = 'bcube-timer-history';
export const EVENT_STORAGE_KEY = 'bcube-timer-event';
export const INSPECTION_STORAGE_KEY = 'bcube-timer-inspection';
export const THEME_STORAGE_KEY = 'bcube-timer-theme';
export const HOLD_TO_START_STORAGE_KEY = 'bcube-timer-hold-to-start';
export const MANUAL_TIME_STORAGE_KEY = 'bcube-timer-manual-time';

export function eventStorageKey(eventCode) {
  return eventCode === '333' ? STORAGE_KEY : `${STORAGE_KEY}-${eventCode}`;
}

export function scrambleStorageKey(eventCode) {
  return `bcube-timer-scramble-${eventCode}`;
}

