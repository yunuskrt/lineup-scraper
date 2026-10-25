import { FIRST_SEASON_START, LAST_SEASON_START } from '@/dataset/constants.js';
import type { CompetitionKind } from '@/dataset/enums.js';

// Single-year seasons; not the pool's TOURNAMENT_KINDS
const SINGLE_YEAR_KINDS: ReadonlySet<CompetitionKind> = new Set([
  'world_cup',
  'euro',
]);

type SeasonException = {
  kinds: readonly CompetitionKind[];
  label: string;
  from: string;
  to: string;
};

// Real seasons the seed's date windows reject
export const SEASON_EXCEPTIONS: readonly SeasonException[] = [
  // Covid: the UCL final was on 23 August 2020
  {
    kinds: ['league', 'ucl', 'uel'],
    label: '2019-20',
    from: '2019-07-01',
    to: '2020-08-31',
  },
  // Covid: Euro 2020 was played in 2021
  { kinds: ['euro'], label: '2020', from: '2021-06-01', to: '2021-07-31' },
];

// Same rules as the seasons CHECKs and the mock
export function seasonIssue(
  label: string,
  date: string,
  isTournament: boolean,
): string | null {
  const start = Number(label.slice(0, 4));
  const end = label.length > 4 ? Number(label.slice(5)) : null;
  if (start < FIRST_SEASON_START || start > LAST_SEASON_START) {
    return 'Season is outside the covered range';
  }
  if (isTournament) {
    if (end !== null) return 'Tournament seasons are a single year';
    return date.startsWith(`${start}-`) ? null : 'Date is outside the season';
  }
  if (end === null) return 'Club seasons span two years';
  if (end !== (start + 1) % 100) return 'Season years must be consecutive';
  const isInSeason = date >= `${start}-07-01` && date <= `${start + 1}-06-30`;
  return isInSeason ? null : 'Date is outside the season';
}

export function matchSeasonIssue(
  kind: CompetitionKind,
  label: string,
  date: string,
): string | null {
  const isExcepted = SEASON_EXCEPTIONS.some(
    (exception) =>
      exception.kinds.includes(kind) &&
      exception.label === label &&
      date >= exception.from &&
      date <= exception.to,
  );
  return isExcepted
    ? null
    : seasonIssue(label, date, SINGLE_YEAR_KINDS.has(kind));
}
