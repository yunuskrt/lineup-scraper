import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { DATA_DIRS } from '@/config/data-dirs.js';
import {
  clubNamesSchema,
  crosswalkSchema,
  stageNamesSchema,
} from '@/resolve/curation.js';
import { duplicateSlugs, isReserved } from '@/resolve/slugs.js';

function curated(name: string): unknown {
  return JSON.parse(readFileSync(path.join(DATA_DIRS.curation, name), 'utf8'));
}

describe('committed curation files', () => {
  it('club-names.json and stage-names.json pass their schemas', () => {
    expect(clubNamesSchema.safeParse(curated('club-names.json')).success).toBe(
      true,
    );
    expect(
      stageNamesSchema.safeParse(curated('stage-names.json')).success,
    ).toBe(true);
  });

  it.each(['competitions', 'clubs', 'matches'])(
    'crosswalk/%s.json has valid, unique, unreserved slugs',
    (entity) => {
      const file = path.join('crosswalk', `${entity}.json`);
      if (!existsSync(path.join(DATA_DIRS.curation, file))) return;
      const crosswalk = crosswalkSchema.parse(curated(file));
      expect(duplicateSlugs(crosswalk)).toEqual([]);
      expect(Object.values(crosswalk).filter(isReserved)).toEqual([]);
    },
  );
});

describe('curation schemas', () => {
  it('needs a 3-capital shortName and a digit id', () => {
    expect(
      clubNamesSchema.safeParse({ '141': { shortName: 'GAL' } }).success,
    ).toBe(true);
    expect(
      clubNamesSchema.safeParse({ '141': { shortName: 'GS' } }).success,
    ).toBe(false);
    expect(
      clubNamesSchema.safeParse({ '141': { shortName: 'gal' } }).success,
    ).toBe(false);
    expect(
      clubNamesSchema.safeParse({ gs: { shortName: 'GAL' } }).success,
    ).toBe(false);
    expect(clubNamesSchema.safeParse({ '141': { name: ' ' } }).success).toBe(
      false,
    );
  });

  it('refuses a crosswalk slug that is not a slug', () => {
    expect(crosswalkSchema.safeParse({ '36': 'Fenerbahçe' }).success).toBe(
      false,
    );
    expect(crosswalkSchema.safeParse({ '36': 'fener--bahce' }).success).toBe(
      false,
    );
    expect(crosswalkSchema.safeParse({ '36': 'fenerbahce' }).success).toBe(
      true,
    );
  });
});
