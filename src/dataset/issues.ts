import type { z } from 'zod';

// matches[3].home.lineup[2].position
function formatPath(path: readonly PropertyKey[]): string {
  return path
    .map((key, index) => {
      if (typeof key === 'number') return `[${key}]`;
      return index === 0 ? String(key) : `.${String(key)}`;
    })
    .join('');
}

// Paths and messages only: never a name or an XI
export function formatDatasetIssues(error: z.ZodError): string {
  const lines = error.issues.map(
    (issue) => `  ${formatPath(issue.path) || '(root)'}: ${issue.message}`,
  );
  return ['Invalid dataset:', ...lines].join('\n');
}
