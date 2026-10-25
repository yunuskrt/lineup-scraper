import { z } from 'zod';

export const isoDateSchema = z.iso.date();

export const sideSchema = z.enum(['home', 'away']);
export type Side = z.infer<typeof sideSchema>;

export const competitionKindSchema = z.enum([
  'league',
  'ucl',
  'uel',
  'world_cup',
  'euro',
]);
export type CompetitionKind = z.infer<typeof competitionKindSchema>;

export const positionGroupSchema = z.enum(['GK', 'DF', 'MF', 'FW']);
export type PositionGroup = z.infer<typeof positionGroupSchema>;

// From the Prisma enums ClubKind and MatchEventKind
export const clubKindSchema = z.enum(['club', 'national_team']);
export type ClubKind = z.infer<typeof clubKindSchema>;

export const matchEventKindSchema = z.enum([
  'goal',
  'own_goal',
  'penalty_goal',
  'red_card',
]);
export type MatchEventKind = z.infer<typeof matchEventKindSchema>;
