export const MAX_OCCUPANTS = 4;

export function maxOccupants(_rooms?: number | null) {
  return MAX_OCCUPANTS;
}

export function occupantChoices(rooms?: number | null) {
  const max = maxOccupants(rooms);
  return Array.from({ length: max }, (_, index) => index + 1);
}
