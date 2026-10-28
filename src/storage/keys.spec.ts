import { createHash } from 'node:crypto';
import { imageKey, isImageContentType, objectUrl } from '@/storage/keys.js';

const BYTES = new TextEncoder().encode(
  '<svg xmlns="http://www.w3.org/2000/svg"/>',
);
const HASH = createHash('sha256').update(BYTES).digest('hex').slice(0, 12);

describe('imageKey', () => {
  it('names a crest by slug and content hash', () => {
    expect(imageKey('crest', 'galatasaray', BYTES, 'image/svg+xml')).toEqual({
      success: true,
      key: `crests/galatasaray/${HASH}.svg`,
    });
  });

  it.each([
    ['image/webp', 'webp'],
    ['image/png', 'png'],
  ])('maps %s to .%s under players/', (contentType, ext) => {
    expect(imageKey('player', 'oliver-kahn', BYTES, contentType)).toEqual({
      success: true,
      key: `players/oliver-kahn/${HASH}.${ext}`,
    });
  });

  it('gives the same bytes the same key, and changed bytes another', () => {
    const again = imageKey('player', 'oliver-kahn', BYTES, 'image/png');
    const changed = imageKey(
      'player',
      'oliver-kahn',
      new Uint8Array([...BYTES, 0]),
      'image/png',
    );
    expect(again).toEqual(
      imageKey('player', 'oliver-kahn', BYTES, 'image/png'),
    );
    expect(changed.success && again.success && changed.key).not.toBe(
      again.success && again.key,
    );
  });

  it.each([
    ['a JPEG', 'oliver-kahn', 'image/jpeg', BYTES],
    ['an unknown type', 'oliver-kahn', 'text/html', BYTES],
    ['a bad slug', 'Oliver Kahn', 'image/png', BYTES],
    ['a slug with a slash', 'a/b', 'image/png', BYTES],
    ['empty bytes', 'oliver-kahn', 'image/png', new Uint8Array()],
  ])('refuses %s', (_, slug, contentType, bytes) => {
    expect(imageKey('player', slug, bytes, contentType).success).toBe(false);
  });

  it('never echoes the slug in an error', () => {
    const result = imageKey('player', 'Secret Name', BYTES, 'image/png');
    expect(!result.success && result.error).not.toContain('Secret');
  });
});

describe('isImageContentType', () => {
  it('knows only the web formats', () => {
    expect(isImageContentType('image/webp')).toBe(true);
    expect(isImageContentType('toString')).toBe(false);
  });
});

describe('objectUrl', () => {
  it('joins endpoint, bucket and key, path-style', () => {
    expect(
      objectUrl('https://br-x.storage.example/', 'images', 'crests/a/b.svg'),
    ).toBe('https://br-x.storage.example/images/crests/a/b.svg');
  });
});
