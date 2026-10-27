import type { MatchEventKind, Side } from '@/dataset/enums.js';
import type { TransfermarktMatch } from '@/raw/transfermarkt-match.js';

type RawEvent = TransfermarktMatch['events'][number];

// One clock sprite cell; ten minutes to a row
const SPRITE_CELL = 36;
const SPRITE = /background-position:\s*-?([0-9]+)px\s+-?([0-9]+)px/;
const ADDED = /^\+?\s*([0-9]+)$/;
const HALF_ENDS = new Set([45, 90, 105, 120]);
const PENALTY = /,\s*Penalty\b/i;
const OWN_GOAL = /\bown[- ]goal\b/i;
const RED_CARD = /\bred card\b/i;
const SECOND_YELLOW = /\bsecond yellow\b|\byellow[- ]red\b/i;
const YELLOW_CARD = /\byellow card\b/i;

export interface Clock {
  addedTime: number | null;
  minute: number | null;
}

const UNKNOWN: Clock = { addedTime: null, minute: null };

// `-324px -144px` → 50; off the grid → unknown
export function readClock(
  clock: string | null,
  addedTime: string | null,
): Clock {
  const match = clock === null ? null : SPRITE.exec(clock);
  if (!match) return UNKNOWN;
  const [x, y] = [Number(match[1]), Number(match[2])];
  if (x % SPRITE_CELL !== 0 || y % SPRITE_CELL !== 0) return UNKNOWN;
  const minute = 1 + x / SPRITE_CELL + 10 * (y / SPRITE_CELL);
  if (minute < 1 || minute > 120) return UNKNOWN;
  if (addedTime === null) return { addedTime: null, minute };
  const added = Number(ADDED.exec(addedTime.trim())?.[1] ?? Number.NaN);
  const isValid = HALF_ENDS.has(minute) && added >= 1 && added <= 30;
  return isValid ? { addedTime: added, minute } : UNKNOWN;
}

// Keys in alphabetical order: the file's key order
export interface LineupEvent {
  addedTime: number | null;
  kind: MatchEventKind;
  minute: number | null;
  player: string | null;
  side: Side;
}

export type CardRead = 'red_card' | 'yellow' | 'unread';

// A second yellow is a sending-off too (D2)
export function readCard(text: string): CardRead {
  if (RED_CARD.test(text) || SECOND_YELLOW.test(text)) return 'red_card';
  return YELLOW_CARD.test(text) ? 'yellow' : 'unread';
}

function squad(report: TransfermarktMatch, side: Side): Set<string> {
  const { starters, bench } = report[side];
  return new Set([...starters, ...bench].map((p) => p.sourceId));
}

function other(side: Side): Side {
  return side === 'home' ? 'away' : 'home';
}

// The scorer is on the other side's sheet, or the text says so
export function goalKind(
  event: RawEvent,
  countsFor: Side,
  report: TransfermarktMatch,
): MatchEventKind {
  const scorer = event.players[0]?.sourceId;
  const isOwnGoal =
    OWN_GOAL.test(event.text) ||
    (scorer !== undefined && squad(report, other(countsFor)).has(scorer));
  if (isOwnGoal) return 'own_goal';
  return PENALTY.test(event.text) ? 'penalty_goal' : 'goal';
}

export interface EventsRead {
  events: LineupEvent[];
  unreadCards: number;
}

function toEvent(
  event: RawEvent,
  kind: MatchEventKind,
  side: Side,
): LineupEvent {
  const { addedTime, minute } = readClock(event.clock, event.addedTime);
  const player = event.players[0]?.sourceId ?? null;
  return { addedTime, kind, minute, player, side };
}

// Unknown minutes last; otherwise page order
function byClock(a: LineupEvent, b: LineupEvent): number {
  const [am, bm] = [a.minute ?? 999, b.minute ?? 999];
  return am - bm || (a.addedTime ?? 0) - (b.addedTime ?? 0);
}

// Goal sides come from the running score (score.ts)
export function readEvents(
  report: TransfermarktMatch,
  goalSides: Side[],
): EventsRead {
  const goals = report.events.filter((e) => e.box === 'goal');
  const events = goals.map((event, index) => {
    const side = goalSides[index]!;
    return toEvent(event, goalKind(event, side, report), side);
  });
  let unreadCards = 0;
  for (const event of report.events.filter((e) => e.box === 'card')) {
    const card = readCard(event.text);
    if (card === 'unread') unreadCards += 1;
    if (card === 'red_card') events.push(toEvent(event, card, event.side));
  }
  return { events: events.toSorted(byClock), unreadCards };
}
