import { z } from 'zod';

// extract/parsers/transfermarkt/match.py's reason
export const LIST_LAYOUT_REASON = 'list layout: no formation';

// The import log fields this rule reads
const logLineSchema = z.looseObject({
  kind: z.string().nullable(),
  key: z.string().nullable(),
  result: z.string(),
  reason: z.string().nullable(),
});

export function parseImportLog(text: string): z.infer<typeof logLineSchema>[] {
  return text
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line, index) => {
      let json: unknown;
      try {
        json = JSON.parse(line);
      } catch {
        throw new Error(`import log line ${index + 1}: not JSON`);
      }
      const parsed = logLineSchema.safeParse(json);
      if (!parsed.success) {
        throw new Error(`import log line ${index + 1}: invalid`);
      }
      return parsed.data;
    });
}

// Matches whose latest import refused a list layout
export function listLayoutIds(
  lines: readonly z.infer<typeof logLineSchema>[],
): Set<string> {
  const latest = new Map<string, boolean>();
  for (const line of lines) {
    if (line.kind !== 'match' || line.key === null) continue;
    if (line.result === 'duplicate') continue;
    latest.set(
      line.key,
      line.result === 'refused' && line.reason === LIST_LAYOUT_REASON,
    );
  }
  return new Set([...latest].filter(([, isList]) => isList).map(([id]) => id));
}
