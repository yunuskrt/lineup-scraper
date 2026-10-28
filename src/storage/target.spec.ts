import type { LoadArgs } from '@/load/target.js';
import {
  checkStorageTarget,
  endpointBranch,
  KNOWN_BRANCHES,
} from '@/storage/target.js';

const READ: LoadArgs = { apply: false, target: null, confirm: false };
const CONFIRMED: LoadArgs = { ...READ, target: 'production', confirm: true };

function endpoint(branch: string) {
  return `https://${branch}.storage.c-5.eu-central-1.aws.neon.tech`;
}

describe('endpointBranch', () => {
  it('reads the branch id from the host', () => {
    expect(endpointBranch(endpoint(KNOWN_BRANCHES.ingest))).toBe(
      KNOWN_BRANCHES.ingest,
    );
  });

  it.each(['https://s3.amazonaws.com', 'not a url'])(
    'finds no branch in %s',
    (url) => {
      expect(endpointBranch(url)).toBeNull();
    },
  );
});

describe('checkStorageTarget', () => {
  it("lets ingest use ingest's endpoint", () => {
    expect(
      checkStorageTarget('ingest', endpoint(KNOWN_BRANCHES.ingest), READ),
    ).toEqual({ success: true, allowProduction: false });
  });

  it("lets disposable use a branch that isn't a known one", () => {
    expect(
      checkStorageTarget('disposable', endpoint('br-odd-sea-b1img3j1'), READ)
        .success,
    ).toBe(true);
  });

  it.each(Object.values(KNOWN_BRANCHES))(
    'refuses disposable on the known branch %s',
    (branch) => {
      expect(
        checkStorageTarget('disposable', endpoint(branch), READ).success,
      ).toBe(false);
    },
  );

  it.each([KNOWN_BRANCHES.production, KNOWN_BRANCHES.dev])(
    'refuses ingest on %s',
    (branch) => {
      expect(checkStorageTarget('ingest', endpoint(branch), READ).success).toBe(
        false,
      );
    },
  );

  it('needs --target production --confirm for production', () => {
    const prod = endpoint(KNOWN_BRANCHES.production);
    expect(checkStorageTarget('production', prod, READ).success).toBe(false);
    expect(checkStorageTarget('production', prod, CONFIRMED)).toEqual({
      success: true,
      allowProduction: true,
    });
  });

  it("refuses production on another branch's endpoint", () => {
    expect(
      checkStorageTarget(
        'production',
        endpoint(KNOWN_BRANCHES.ingest),
        CONFIRMED,
      ).success,
    ).toBe(false);
  });

  it('refuses an endpoint that names no branch', () => {
    expect(
      checkStorageTarget('ingest', 'https://s3.amazonaws.com', READ).success,
    ).toBe(false);
  });
});
