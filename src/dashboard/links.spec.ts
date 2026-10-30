import { isError, linkKey, parseGeneral } from '@/dashboard/links.js';
import { HEADER } from '@/dashboard/spec-fixtures.js';

const TM = 'https://www.transfermarkt.com';
const IMG = 'https://img.a.transfermarkt.technology';

describe('linkKey', () => {
  it.each([
    [
      'Fixture',
      `${TM}/x/gesamtspielplan/wettbewerb/GB1?saison_id=2000`,
      'GB1-2000',
    ],
    [
      'Fixture',
      `${TM}/x/gesamtspielplan/pokalwettbewerb/EURO/saison_id/2020`,
      'EURO-2020',
    ],
    ['Match Report', `${TM}/spielbericht/index/spielbericht/990248`, '990248'],
    ['Player', `${TM}/oliver-kahn/profil/spieler/206`, '206'],
    ['Crest', `${IMG}/wappen/normquad/27_1400571853.png?lm=1`, '27'],
    ['Crest', `${IMG}/wappen/normquad/1049.png?lm=1`, '1049'],
    ['PlayerPhoto', `${IMG}/portrait/header/206-1464084738.jpg?lm=4711`, '206'],
    [
      'PlayerPhoto',
      `${IMG}/portrait/header/s_7573_123_2012_1.jpg?lm=4711`,
      '7573',
    ],
  ] as const)('%s %s', (type, link, key) => {
    expect(linkKey(type, link)).toBe(key);
  });

  it('gives null for a link of the wrong shape', () => {
    expect(
      linkKey('Player', `${TM}/spielbericht/index/spielbericht/1`),
    ).toBeNull();
  });
});

describe('parseGeneral', () => {
  const line = (cells: string) => `${HEADER}\n${cells}\n`;

  it('reads rows with their id', () => {
    const parsed = parseGeneral(
      line(
        `7,Player,${TM}/x/profil/spieler/206,player-206.html,data/inbox/,"error: a, b"`,
      ),
    );
    expect(parsed).toEqual({
      success: true,
      rows: [
        {
          index: 7,
          type: 'Player',
          link: `${TM}/x/profil/spieler/206`,
          saveAs: 'player-206.html',
          status: 'error: a, b',
          key: '206',
        },
      ],
    });
  });

  it('refuses another header', () => {
    expect(parseGeneral('#,Link,Save as,Folder,Status\n')).toEqual({
      success: false,
      error: 'general.csv: unexpected header',
    });
  });

  it('names the line and the column, never the value', () => {
    const parsed = parseGeneral(
      line(`1,Player,${TM}/x/profil/spieler/206,p.html,data/inbox/,done`),
    );
    expect(parsed).toEqual({
      success: false,
      error: 'general.csv line 2: invalid Status',
    });
  });

  it('refuses a link with no id', () => {
    const parsed = parseGeneral(
      line(`1,Player,${TM}/x,p.html,data/inbox/,saved`),
    );
    expect(parsed).toEqual({
      success: false,
      error: 'general.csv line 2: no id',
    });
  });

  it('knows an error status', () => {
    expect(isError('error: challenge page')).toBe(true);
    expect(isError('parsed')).toBe(false);
  });
});
