import type { ApplyReport } from '@/load/apply.js';
import { TABLES, type Plan } from '@/load/plan.js';

// Counts only: never a name, an alias or an XI
export function renderPlan(plan: Plan): string[] {
  const width = Math.max(...TABLES.map((table) => table.length));
  const lines = TABLES.map((table) => {
    const { create, update, same } = plan[table];
    const removed = plan[table].delete.length;
    const rows = create.length + update.length + same;
    return (
      `${table.padEnd(width)} ${String(rows).padStart(6)} rows: ` +
      `${create.length} create, ${update.length} update, ${removed} delete, ${same} same`
    );
  });
  return [
    ...lines,
    `XIs rewritten whole: ${plan.rewrittenSides.length}`,
    `matches with events replaced: ${plan.replacedEvents.length}`,
    `matches retired (score row deleted): ${plan.retired.length}`,
    `played matches affected: ${plan.played.length}`,
  ];
}

export function changeCount(plan: Plan): number {
  return TABLES.reduce(
    (sum, table) =>
      sum +
      plan[table].create.length +
      plan[table].update.length +
      plan[table].delete.length,
    0,
  );
}

// What was written, per table, counts only
export function renderReport(report: ApplyReport, plan: Plan): string[] {
  const width = Math.max(...TABLES.map((table) => table.length));
  const total = TABLES.reduce(
    (sum, t) => sum + report[t].created + report[t].updated + report[t].deleted,
    0,
  );
  return [
    ...TABLES.map((table) => {
      const { created, updated, deleted } = report[table];
      const { create, update, same } = plan[table];
      const rows = create.length + update.length + same;
      return (
        `${table.padEnd(width)} ${String(rows).padStart(6)} rows: ` +
        `${created} created, ${updated} updated, ${deleted} deleted`
      );
    }),
    `rows written: ${total}`,
  ];
}
