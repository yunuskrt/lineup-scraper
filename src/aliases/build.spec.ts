import { buildAliases, type PlayerNames } from '@/aliases/build.js';
import { aliasCurationSchema } from '@/aliases/curation.js';
import { playerAliasesSchema } from '@/dataset/schema.js';

function player(
  id: string,
  name: string,
  extra: Partial<PlayerNames> = {},
): PlayerNames {
  return {
    slug: `p-${id}`,
    transfermarktId: id,
    name,
    aliasCandidates: [],
    fullName: null,
    nameInHomeCountry: null,
    ...extra,
  };
}

const PIRLO = player('5817', 'Andrea Pirlo', { aliasCandidates: ['Pirlo'] });
const ORTEGA = player('4147', 'Ariel Ortega', {
  nameInHomeCountry: 'Arnaldo Ariel Ortega',
});

function aliasesOf(sets: ReturnType<typeof buildAliases>, id: string) {
  return sets.players.find((p) => p.transfermarktId === id)?.aliases;
}

describe('buildAliases', () => {
  it('orders name, surname, report names, full name, curation', () => {
    const elber = player('198', 'Giovane Élber', {
      aliasCandidates: ['Élber', 'Giovane'],
      fullName: 'Élber Giovane de Souza',
    });
    const sets = buildAliases([elber], {
      198: { add: ['Elber Giovane'], remove: [] },
    });
    expect(aliasesOf(sets, '198')).toEqual([
      'Giovane Élber',
      'Élber',
      'Giovane',
      'Élber Giovane de Souza',
      'Elber Giovane',
    ]);
    expect(sets.kept).toEqual({
      name: 1,
      surname: 1,
      report: 1,
      fullName: 1,
      curation: 1,
    });
  });

  it('keeps the first spelling of names that normalise alike', () => {
    const hasan = player('214', 'Hasan Salihamidzic', {
      aliasCandidates: ['Salihamidžić'],
      nameInHomeCountry: 'Hasan Salihamidžić',
    });
    expect(aliasesOf(buildAliases([hasan], {}), '214')).toEqual([
      'Hasan Salihamidzic',
      'Salihamidzic',
    ]);
  });

  it('takes fullName before the home-country name, never both', () => {
    const both = player('1', 'Joe Bloggs', {
      fullName: 'Joseph Bloggs',
      nameInHomeCountry: 'Joseph Arthur Bloggs',
    });
    expect(aliasesOf(buildAliases([both], {}), '1')).toEqual([
      'Joe Bloggs',
      'Bloggs',
      'Joseph Bloggs',
    ]);
    expect(aliasesOf(buildAliases([ORTEGA], {}), '4147')).toContain(
      'Arnaldo Ariel Ortega',
    );
  });

  it('gives a mononym only its name', () => {
    const batista = player('6877', 'Batista', {
      fullName: 'Joao Casemiro Marques Batista',
    });
    const sets = buildAliases([batista], {});
    expect(aliasesOf(sets, '6877')).toEqual([
      'Batista',
      'Joao Casemiro Marques Batista',
    ]);
    expect(sets.kept.surname).toBe(0);
  });

  it('drops names with a dot and names that normalise to nothing', () => {
    const kily = player('7438', 'Kily González', {
      aliasCandidates: ['Kily Gonzá.', 'N. González'],
    });
    const stevic = player('135', 'Miroslav Stevic', {
      nameInHomeCountry: 'Мирослав Стевић',
    });
    const sets = buildAliases([kily, stevic], {});
    expect(aliasesOf(sets, '7438')).toEqual(['Kily González', 'González']);
    expect(aliasesOf(sets, '135')).toEqual(['Miroslav Stevic', 'Stevic']);
    expect(sets.dropped).toEqual([
      { slug: 'p-7438', source: 'report', reason: 'dot' },
      { slug: 'p-7438', source: 'report', reason: 'dot' },
      { slug: 'p-135', source: 'fullName', reason: 'not latin' },
    ]);
  });

  it('keeps a dot in the display name and in curation', () => {
    const neymar = player('68290', 'Neymar Jr.');
    const sets = buildAliases([neymar], {
      68290: { add: ['N. Jr.'], remove: [] },
    });
    // The derived surname `Jr.` has a dot: dropped
    expect(aliasesOf(sets, '68290')).toEqual(['Neymar Jr.', 'N. Jr.']);
    expect(sets.dropped).toEqual([
      { slug: 'p-68290', source: 'surname', reason: 'dot' },
    ]);
  });

  it('removes curated names, and every spelling of them', () => {
    const sets = buildAliases([PIRLO], {
      5817: { add: [], remove: ['PIRLO'] },
    });
    expect(aliasesOf(sets, '5817')).toEqual(['Andrea Pirlo']);
    expect(sets.dropped).toEqual([
      { slug: 'p-5817', source: 'surname', reason: 'removed' },
    ]);
    expect(sets.warnings).toEqual([]);
  });

  it('warns on an unknown id, a known alias and a removal that misses', () => {
    const sets = buildAliases([PIRLO], {
      99: { add: ['Somebody'], remove: [] },
      5817: { add: ['Kily', 'pirlo'], remove: ['Xavi'] },
    });
    expect(aliasesOf(sets, '5817')).toEqual(['Andrea Pirlo', 'Pirlo', 'Kily']);
    expect(sets.warnings).toEqual([
      { at: 'aliases.json 99', reason: 'not a resolved player' },
      { at: 'aliases.json 5817.add[1]', reason: 'already an alias' },
      { at: 'aliases.json 5817.remove[0]', reason: 'matches no alias' },
    ]);
  });

  it('refuses an addition that normalises to nothing, naming its path', () => {
    expect(() =>
      buildAliases([PIRLO], { 5817: { add: ['Pirlo', '中村'], remove: [] } }),
    ).toThrow(/^aliases\.json 5817\.add\[1\] must normalize to a name$/);
  });

  it('refuses removing the display name', () => {
    expect(() =>
      buildAliases([PIRLO], { 5817: { add: [], remove: ['andrea  PIRLO'] } }),
    ).toThrow('aliases.json 5817.remove[0] can');
  });

  it('refuses a display name that normalises to nothing', () => {
    expect(() => buildAliases([player('1', 'Аршавин')], {})).toThrow(
      'Player p-1: display name must normalize to a name',
    );
  });

  it('sorts by slug, passes the dataset rules and repeats exactly', () => {
    const input = [ORTEGA, PIRLO, player('2', 'Zé Roberto')];
    const first = buildAliases(input, {});
    expect(first.players.map((p) => p.slug)).toEqual([
      'p-2',
      'p-4147',
      'p-5817',
    ]);
    for (const p of first.players) {
      expect(playerAliasesSchema.safeParse(p.aliases).success).toBe(true);
    }
    expect(JSON.stringify(buildAliases(input, {}))).toBe(JSON.stringify(first));
  });
});

describe('aliasCurationSchema', () => {
  it('fills empty lists, trims and composes to NFC', () => {
    expect(
      aliasCurationSchema.parse({ 7438: { add: ['  Kily '] }, 1: {} }),
    ).toEqual({
      1: { add: [], remove: [] },
      7438: { add: ['Kily'], remove: [] },
    });
    expect(aliasCurationSchema.parse({ 1: { add: ['Şaş'] } })[1]?.add).toEqual([
      'Şaş',
    ]);
  });

  it.each([
    ['a slug key', { 'kily-gonzalez': { add: ['Kily'] } }],
    ['an unknown field', { 1: { add: [], nickname: 'Kily' } }],
    ['a blank name', { 1: { add: ['  '] } }],
    ['a name that is not text', { 1: { add: [7] } }],
  ])('refuses %s', (_, value) => {
    expect(aliasCurationSchema.safeParse(value).success).toBe(false);
  });
});
