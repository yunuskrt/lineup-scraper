import { readFileSync } from 'node:fs';
import {
  poolConfigSchema,
  readPoolConfig,
  startYear,
  type PoolConfig,
} from '@/pool/config.js';
import { POOL_SCHEMA_FILE } from '@/pool/schema-file.js';
import { renderSchema } from '@/raw/schema-files.js';

function validConfig(): PoolConfig {
  return {
    competitions: [
      {
        code: 'TR1',
        kind: 'league',
        name: 'Süper Lig',
        urlSlug: 'super-lig',
        linkStyle: 'league',
        seasons: { first: 2000, last: 2025, step: 1 },
        groups: ['derbies', 'clashes'],
        isVerified: true,
      },
      {
        code: 'EURO',
        kind: 'euro',
        name: 'European Championship',
        urlSlug: 'europameisterschaft',
        linkStyle: 'cup',
        seasons: { first: 1999, last: 2023, step: 4 },
        groups: ['euro-knockouts'],
        isVerified: true,
      },
    ],
    clubs: [
      { key: 'galatasaray', name: 'Galatasaray', league: 'TR1', id: '141' },
      { key: 'fenerbahce', name: 'Fenerbahçe', league: 'TR1', id: '36' },
      { key: 'besiktas', name: 'Beşiktaş', league: 'TR1', id: null },
    ],
    derbies: [
      { name: 'Kıtalar Arası Derbi', clubs: ['fenerbahce', 'galatasaray'] },
    ],
    knockoutStages: { 'euro-knockouts': ['QF', 'SF', 'FI'] },
  };
}

function messages(config: unknown): string[] {
  const result = poolConfigSchema.safeParse(config);
  return result.success ? [] : result.error.issues.map((i) => i.message);
}

describe('pool config', () => {
  it('accepts the committed data/curation/pool.json', () => {
    const config = readPoolConfig();
    expect(config.derbies).toHaveLength(7);
    expect(config.clubs).toHaveLength(22);
  });

  it('accepts a valid config, a null club id and Euro 2000 as saison_id 1999', () => {
    expect(messages(validConfig())).toEqual([]);
  });

  it('refuses a derby with a club that is not in clubs', () => {
    const config = validConfig();
    config.derbies[0]!.clubs = ['fenerbahce', 'trabzonspor'];
    expect(messages(config)).toEqual(['Derby club is not in clubs']);
  });

  it('refuses a derby across two leagues', () => {
    const config = validConfig();
    config.competitions.push({ ...config.competitions[0]!, code: 'IT1' });
    config.clubs[1]!.league = 'IT1';
    expect(messages(config)).toEqual(['Derby clubs play in different leagues']);
  });

  it('refuses a non-digit club id', () => {
    const config = validConfig();
    config.clubs[0]!.id = 'gs';
    expect(messages(config)).toEqual([
      'Invalid string: must match pattern /^[0-9]+$/',
    ]);
  });

  it('refuses an unknown league and duplicate clubs', () => {
    const config = validConfig();
    config.clubs[2]!.league = 'XX1';
    config.clubs.push({ ...config.clubs[1]! });
    expect(messages(config)).toEqual([
      'Unknown league code',
      'Duplicate club key',
      'Duplicate club id',
    ]);
  });

  it.each([
    [{ first: 1999, last: 2025, step: 1 }, 'league'],
    [{ first: 2000, last: 2026, step: 1 }, 'league'],
    [{ first: 2001, last: 2025, step: 4 }, 'euro'],
    [{ first: 2010, last: 2005, step: 1 }, 'league'],
  ] as const)('refuses seasons %o for a %s', (seasons, kind) => {
    const config = validConfig();
    const index = kind === 'league' ? 0 : 1;
    config.competitions[index]!.seasons = { ...seasons };
    expect(messages(config)).toEqual(['Seasons are outside the covered range']);
  });

  it('reads a World Cup or Euro saison_id as the year before', () => {
    expect(startYear('world_cup', 2005)).toBe(2006);
    expect(startYear('euro', 1999)).toBe(2000);
    expect(startYear('league', 2002)).toBe(2002);
  });

  it('reads Euro 2020, saison_id 2020, as 2020', () => {
    expect(startYear('euro', 2020)).toBe(2020);
    expect(startYear('euro', 2023)).toBe(2024);
  });

  it('schemas/curation/pool.schema.json is current (run `npm run schemas`)', () => {
    expect(readFileSync(POOL_SCHEMA_FILE, 'utf8')).toBe(
      renderSchema(poolConfigSchema),
    );
  });
});
