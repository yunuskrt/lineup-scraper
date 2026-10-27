import {
  changedEntries,
  duplicateSlugs,
  extendCrosswalk,
  isReserved,
  sortByKey,
  toSlug,
} from '@/resolve/slugs.js';

describe('toSlug', () => {
  it.each([
    ['Süper Lig', 'super-lig'],
    ['Fenerbahçe', 'fenerbahce'],
    ['Paris Saint-Germain', 'paris-saint-germain'],
    ['Beşiktaş', 'besiktas'],
    ['Deportivo de La Coruña', 'deportivo-de-la-coruna'],
  ])('%s → %s', (name, slug) => {
    expect(toSlug(name)).toBe(slug);
  });

  it('gives no slug to a name with no Latin letters', () => {
    expect(toSlug('Аршавин')).toBeNull();
  });

  it('knows the reserved prefixes', () => {
    expect(isReserved('club-brugge')).toBe(true);
    expect(isReserved('clubs')).toBe(false);
  });
});

describe('extendCrosswalk', () => {
  it('keeps every old entry and adds new keys', () => {
    const result = extendCrosswalk({ '36': 'fenerbahce' }, [
      { key: '36', base: 'fenerbahce-sk' },
      { key: '141', base: 'galatasaray' },
    ]);
    expect(result.crosswalk).toEqual({
      '36': 'fenerbahce',
      '141': 'galatasaray',
    });
    expect(result.added).toEqual(['141']);
  });

  it('suffixes the id when a slug is taken', () => {
    const result = extendCrosswalk({ '11': 'arsenal' }, [
      { key: '1234', base: 'arsenal' },
    ]);
    expect(result.crosswalk['1234']).toBe('arsenal-1234');
  });

  it('tries the fallbacks before the id', () => {
    const result = extendCrosswalk({ '1': 'ronaldo' }, [
      { key: '2', base: 'ronaldo', fallbacks: ['ronaldo-1985'] },
    ]);
    expect(result.crosswalk['2']).toBe('ronaldo-1985');
  });

  it('leaves a reserved, empty or still-taken slug unassigned', () => {
    const result = extendCrosswalk({ '1': 'a', '2': 'a-3' }, [
      { key: '9', base: 'club-brugge' },
      { key: '8', base: null },
      { key: '3', base: 'a' },
    ]);
    expect(result.unslugged.map((u) => [u.key, u.reason])).toEqual([
      ['9', 'slug starts with a reserved prefix'],
      ['8', 'name has no Latin letters'],
      ['3', 'slug is taken'],
    ]);
    expect(result.added).toEqual([]);
  });

  it('sorts numeric keys by number and code keys alphabetically', () => {
    expect(Object.keys(sortByKey({ '141': 'g', '36': 'f', '5': 'm' }))).toEqual(
      ['5', '36', '141'],
    );
    expect(Object.keys(sortByKey({ TR1: 's', CL: 'u', EURO: 'e' }))).toEqual([
      'CL',
      'EURO',
      'TR1',
    ]);
  });
});

describe('crosswalk guards', () => {
  it('finds a committed entry that was changed or removed', () => {
    const committed = { '36': 'fenerbahce', '141': 'galatasaray' };
    expect(changedEntries(committed, { '36': 'fenerbahce-sk' })).toEqual([
      '36',
      '141',
    ]);
    expect(
      changedEntries(committed, { ...committed, '5': 'ac-milan' }),
    ).toEqual([]);
  });

  it('finds a slug used by two keys', () => {
    expect(duplicateSlugs({ '1': 'a', '2': 'b', '3': 'a' })).toEqual(['a']);
  });
});
