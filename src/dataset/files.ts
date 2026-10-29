import { createHash } from 'node:crypto';
import type { DatasetInput } from '@/dataset/schema.js';

export const MANIFEST = 'manifest.json';
export const SOURCES = ['curation', 'transfermarkt'] as const;

type Match = DatasetInput['matches'][number];

export function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sortedRecord<T>(entries: [string, T][]): Record<string, T> {
  return Object.fromEntries(
    entries.toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
}

// `matches/champions-league/2000-01.json`
function matchFile(match: Match): string {
  return `matches/${match.competitionSlug}/${match.season}.json`;
}

// Every dataset file by path; manifest last
export function datasetFiles(
  dataset: DatasetInput,
  schemaHash: string,
): Map<string, string> {
  const files = new Map<string, string>([
    ['competitions.json', json(dataset.competitions)],
    ['clubs.json', json(dataset.clubs)],
    ['players.json', json(dataset.players)],
  ]);
  const byFile = new Map<string, Match[]>();
  for (const match of dataset.matches) {
    const file = matchFile(match);
    byFile.set(file, [...(byFile.get(file) ?? []), match]);
  }
  for (const [file, matches] of byFile) {
    files.set(
      file,
      json(matches.toSorted((a, b) => (a.slug < b.slug ? -1 : 1))),
    );
  }
  const manifest = {
    algorithmVersions: [
      ...new Set(dataset.matches.map((m) => m.memorability.algorithmVersion)),
    ].toSorted(),
    counts: {
      aliases: dataset.players.reduce((n, p) => n + p.aliases.length, 0),
      clubs: dataset.clubs.length,
      competitions: dataset.competitions.length,
      crests: dataset.clubs.filter((c) => c.crestKey !== null).length,
      events: dataset.matches.reduce((n, m) => n + m.events.length, 0),
      lineups: dataset.matches.reduce(
        (n, m) => n + m.home.lineup.length + m.away.lineup.length,
        0,
      ),
      matches: dataset.matches.length,
      photos: dataset.players.filter((p) => p.imageKey !== null).length,
      players: dataset.players.length,
    },
    files: sortedRecord(
      [...files].map(([path, text]): [string, string] => [path, sha256(text)]),
    ),
    matchesBy: sortedRecord(
      [...byFile].map(([file, matches]): [string, number] => [
        file.replace(/^matches\//, '').replace(/\.json$/, ''),
        matches.length,
      ]),
    ),
    schemaHash,
    sources: [...SOURCES],
  };
  files.set(MANIFEST, json(manifest));
  return files;
}
