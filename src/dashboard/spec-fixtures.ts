import type { Context, Entry } from '@/dashboard/blocks.js';
import type { LinkRow, LinkType } from '@/dashboard/links.js';
import type { PoolMatch } from '@/pool/build.js';

// Hand-made rows for the dashboard specs
export const HEADER = '#,Type,Link,Save as,Folder,Status';

const TM = 'https://www.transfermarkt.com';
const IMG = 'https://img.a.transfermarkt.technology';

export const LINKS: Record<LinkType, (id: string) => string> = {
  Fixture: (id) =>
    `${TM}/super-lig/gesamtspielplan/wettbewerb/TR1?saison_id=${id}`,
  'Match Report': (id) => `${TM}/spielbericht/index/spielbericht/${id}`,
  Player: (id) => `${TM}/someone/profil/spieler/${id}`,
  Crest: (id) => `${IMG}/wappen/normquad/${id}_1400571853.png?lm=1`,
  PlayerPhoto: (id) => `${IMG}/portrait/header/${id}-1464084738.jpg?lm=1`,
};

export function linkRow(
  index: number,
  type: LinkType,
  key: string,
  status = 'to save',
): LinkRow {
  const id = type === 'Fixture' ? (key.split('-')[1] ?? '') : key;
  return {
    index,
    type,
    link: LINKS[type](id),
    saveAs: `${key}.html`,
    status,
    key,
  };
}

export function poolMatch(
  sourceId: string,
  extra: Partial<PoolMatch> = {},
): PoolMatch {
  return {
    sourceId,
    competitionCode: 'TR1',
    seasonId: '2002',
    date: '2002-11-06',
    groups: ['derbies'],
    home: '36',
    away: '141',
    result: '1:1',
    round: null,
    stage: null,
    ...extra,
  };
}

export const CONTEXT: Context = {
  groups: ['derbies'],
  competition: 'TR1',
  season: '2002-03',
  era: 0,
  clubs: ['36', '141'],
  match: '1118844',
};

export function entry(
  type: LinkType,
  status: string,
  context: Partial<Context> = {},
  key = '1',
): Entry {
  return {
    ...linkRow(1, type, key, status),
    context: { ...CONTEXT, ...context },
  };
}
