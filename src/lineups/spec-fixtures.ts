import type { TransfermarktMatch } from '@/raw/transfermarkt-match.js';

type Starters = [string, string][];
type RawSide = TransfermarktMatch['home'];
type RawEvent = TransfermarktMatch['events'][number];

// Ids and `style` of the six saved sides' starters
export const SAVED_SIDES: Record<
  string,
  { formation: string; starters: Starters }
> = {
  '1153409-home': {
    formation: 'Starting Line-up: 3-4-1-2',
    starters: [
      ['3516', 'top: 80%; left: 40%;'],
      ['5749', 'top: 62%; left: 40%;'],
      ['5750', 'top: 61%; left: 15%;'],
      ['5751', 'top: 34%; left: 15%;'],
      ['5753', 'top: 61%; left: 65%;'],
      ['5758', 'top: 43%; left: 52%;'],
      ['5759', 'top: 43%; left: 30%;'],
      ['5972', 'top: 34%; left: 65%;'],
      ['3111', 'top: 22%; left: 40%;'],
      ['7479', 'top: 2%; left: 30%;'],
      ['4146', 'top: 2%; left: 50%;'],
    ],
  },
  '1153409-away': {
    formation: 'Starting Line-up: 3-1-4-2',
    starters: [
      ['6443', 'top: 80%; left: 40%;'],
      ['22106', 'top: 62%; left: 40%;'],
      ['22120', 'top: 61%; left: 15%;'],
      ['6164', 'top: 61%; left: 65%;'],
      ['3511', 'top: 18%; left: 15%;'],
      ['22101', 'top: 43%; left: 40%;'],
      ['3456', 'top: 23%; left: 50%;'],
      ['22105', 'top: 18%; left: 65%;'],
      ['5922', 'top: 23%; left: 30%;'],
      ['3457', 'top: 2%; left: 50%;'],
      ['5962', 'top: 2%; left: 30%;'],
    ],
  },
  '4126774-home': {
    formation: 'Starting Line-up: 4-2-3-1',
    starters: [
      ['361032', 'top: 80%; left: 40%;'],
      ['889613', 'top: 63%; left: 28%;'],
      ['263546', 'top: 63%; left: 52.5%;'],
      ['11530', 'top: 61%; left: 7.5%;'],
      ['257785', 'top: 3%; left: 40%;'],
      ['699005', 'top: 61%; left: 73%;'],
      ['988710', 'top: 43%; left: 28%;'],
      ['269393', 'top: 23%; left: 40%;'],
      ['243725', 'top: 43%; left: 52%;'],
      ['348425', 'top: 18%; left: 65%;'],
      ['163053', 'top: 18%; left: 15%;'],
    ],
  },
  '4126774-away': {
    formation: 'Starting Line-up: 4-2-3-1',
    starters: [
      ['58088', 'top: 80%; left: 40%;'],
      ['199316', 'top: 63%; left: 28%;'],
      ['422951', 'top: 63%; left: 52.5%;'],
      ['475413', 'top: 61%; left: 73%;'],
      ['236400', 'top: 61%; left: 7.5%;'],
      ['112465', 'top: 43%; left: 28%;'],
      ['469787', 'top: 43%; left: 52%;'],
      ['541537', 'top: 18%; left: 65%;'],
      ['382528', 'top: 18%; left: 15%;'],
      ['56416', 'top: 23%; left: 40%;'],
      ['127048', 'top: 3%; left: 40%;'],
    ],
  },
  '990248-home': {
    formation: 'Starting Line-up: 5-4-1',
    starters: [
      ['206', 'top: 80%; left: 40%;'],
      ['191', 'top: 63%; left: 40%;'],
      ['208', 'top: 61%; left: 56.5%;'],
      ['209', 'top: 61%; left: 23.5%;'],
      ['210', 'top: 59%; left: 7%;'],
      ['213', 'top: 59%; left: 73%;'],
      ['201', 'top: 43%; left: 52%;'],
      ['214', 'top: 23%; left: 12%;'],
      ['217', 'top: 23%; left: 68%;'],
      ['197', 'top: 43%; left: 28%;'],
      ['198', 'top: 3%; left: 40%;'],
    ],
  },
  '990248-away': {
    formation: 'Starting Line-up: 4-4-2 Diamond',
    starters: [
      ['7562', 'top: 80%; left: 40%;'],
      ['7565', 'top: 63%; left: 52.5%;'],
      ['7573', 'top: 63%; left: 28%;'],
      ['7566', 'top: 61%; left: 7.5%;'],
      ['51776', 'top: 61%; left: 73%;'],
      ['4191', 'top: 43%; left: 40%;'],
      ['7603', 'top: 35%; left: 60%;'],
      ['7438', 'top: 35%; left: 20%;'],
      ['3411', 'top: 23%; left: 40%;'],
      ['7585', 'top: 2%; left: 50%;'],
      ['3570', 'top: 2%; left: 30%;'],
    ],
  },
};

export function starters(key: string): { sourceId: string; style: string }[] {
  return SAVED_SIDES[key]!.starters.map(([sourceId, style]) => ({
    sourceId,
    style,
  }));
}

function side(key: string, clubId: string, bench: string[]): RawSide {
  const saved = SAVED_SIDES[key]!;
  return {
    sourceId: clubId,
    name: `Club ${clubId}`,
    tablePosition: null,
    formation: saved.formation,
    starters: saved.starters.map(([sourceId, style]) => ({
      sourceId,
      name: `Player ${sourceId}`,
      profilePath: `/p/profil/spieler/${sourceId}`,
      shirtNumber: null,
      style,
      isCaptain: false,
    })),
    bench: bench.map((sourceId) => ({
      sourceId,
      name: `Player ${sourceId}`,
      shirtNumber: null,
      position: null,
    })),
  };
}

export function event(
  box: RawEvent['box'],
  eventSide: RawEvent['side'],
  clock: string | null,
  text: string,
  players: string[],
  addedTime: string | null = null,
): RawEvent {
  return {
    box,
    side: eventSide,
    clock: clock === null ? null : `background-position: ${clock};`,
    addedTime,
    players: players.map((sourceId) => ({
      sourceId,
      name: `Player ${sourceId}`,
    })),
    text,
  };
}

// The 2001 final's 14 kicks, home first: 5 and 4 scored
const KICKS_2001 =
  'h-Missed a-Scored h-Scored a-Scored h-Scored a-Saved h-Saved ' +
  'a-Saved h-Scored a-Scored h-Scored a-Scored h-Scored a-Saved';

// `h-Scored a-Missed` → kicks
export function kicks(list: string): TransfermarktMatch['shootout'] {
  return list.split(' ').map((kick) => {
    const [side, outcome] = kick.split('-');
    return { side: side === 'h' ? 'home' : 'away', outcome: outcome! };
  });
}

// The 2001 final as saved: 1:1, 5:4 on pens
export function final2001(
  overrides: Partial<TransfermarktMatch> = {},
): TransfermarktMatch {
  return {
    source: 'transfermarkt',
    sourceId: '990248',
    sourceUrl:
      'https://www.transfermarkt.com/spielbericht/index/spielbericht/990248',
    fetchedAt: '2026-10-27T00:00:00Z',
    round: 'Final',
    date: '2001-05-23',
    result: '5:4',
    resultNote: 'on pens',
    home: side('990248-home', '27', ['196', '222']),
    away: side('990248-away', '1049', ['7563', '7569']),
    events: [
      event(
        'goal',
        'away',
        '-72px -0px',
        '0:1 Penalty taker , Penalty, 2. Tournament Goal',
        ['7603', '191'],
      ),
      event(
        'goal',
        'home',
        '-324px -144px',
        '1:1 Penalty taker , Penalty, 1. Tournament Goal',
        ['197', '7566'],
      ),
      event('card', 'away', '-0px -433px', 'Keeper 1. Yellow card', ['7562']),
      event('card', 'away', '-216px -360px', 'Midfielder 3. Yellow card', [
        '7438',
      ]),
      event('substitution', 'home', '-180px -72px', 'Substitution', [
        '196',
        '214',
      ]),
    ],
    shootout: kicks(KICKS_2001),
    ...overrides,
  };
}
