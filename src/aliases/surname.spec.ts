import { surname } from '@/aliases/surname.js';

describe('surname', () => {
  it.each([
    ['Andrea Pirlo', 'Pirlo'],
    ['Juan Román Riquelme', 'Riquelme'],
    ['Giovane Élber', 'Élber'],
    ['Rafael van der Vaart', 'van der Vaart'],
    ['Alessandro Del Piero', 'Del Piero'],
    ['Lilian Thuram-Ulien', 'Thuram-Ulien'],
    ['  Fabio   Pinto ', 'Pinto'],
  ])('takes %s → %s', (name, expected) => {
    expect(surname(name)).toBe(expected);
  });

  it('gives none for a one-word name', () => {
    expect(surname('Batista')).toBeNull();
    expect(surname('  Washington ')).toBeNull();
  });

  it('never starts at the first word or ends on a particle', () => {
    // `De` as a first name, `da` as a last word
    expect(surname('De Jong')).toBe('Jong');
    expect(surname('Luis da')).toBe('da');
  });
});
