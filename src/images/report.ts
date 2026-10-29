import { DEFAULT_CROP } from '@/images/crop.js';
import { STANDARD_PHOTO, type Made, type Processed } from '@/images/process.js';

function list(title: string, lines: string[]): string[] {
  if (lines.length === 0) return [];
  return ['', `## ${title}`, '', ...lines.map((line) => `- ${line}`)];
}

export function renderReport(processed: Processed): string {
  const { keys, missing, small, oddPhotos, unusedCrops, made } = processed;
  const cropped = made.filter(
    (m) => m.kind === 'photo' && m.crop !== null && m.crop !== DEFAULT_CROP,
  );
  return [
    '# Images',
    '',
    `Crests: ${keys.crests.length}. Photos: ${keys.photos.length}. ` +
      `Missing: ${missing.length}.`,
    '',
    `Photos to check by eye: ${oddPhotos.length} (not Transfermarkt's ` +
      `${STANDARD_PHOTO.width}×${STANDARD_PHOTO.height}; the centre crop ` +
      'was tuned on that framing). All are in `images.html`.',
    ...list(
      'Photos with another framing: check these',
      oddPhotos.map((o) => `\`${o.slug}\`: ${o.width}×${o.height}`),
    ),
    ...list(
      'No saved image (save it, S18a)',
      missing.map((m) => `${m.kind} \`${m.slug}\``),
    ),
    ...list(
      'Sources below the size floor (64 px crest, 80 px photo)',
      small.map((s) => `${s.kind} \`${s.slug}\`: ${s.width}×${s.height}`),
    ),
    ...list(
      'Photo crops from data/curation/images.json',
      cropped.map((m) => `\`${m.entry.slug}\`: ${String(m.crop)}`),
    ),
    ...list(
      'Crops for players not in the dataset',
      unusedCrops.map((slug) => `\`${slug}\``),
    ),
    '',
  ].join('\n');
}

function escape(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

// Paths relative to data/reports/
function card(made: Made): string {
  const output = `../work/images/${made.entry.key}`;
  const source = `../images/${made.source}`;
  const shape = made.kind === 'photo' ? 'photo' : 'crest';
  const crop = made.crop === null ? '' : ` · crop ${String(made.crop)}`;
  return [
    `<figure class="${shape}">`,
    `  <img class="source" src="${escape(source)}" alt="">`,
    `  <img class="big" src="${escape(output)}" alt="">`,
    `  <img class="small" src="${escape(output)}" alt="">`,
    `  <figcaption>${escape(made.entry.slug)}<br>` +
      `${made.width}×${made.height}${escape(crop)}</figcaption>`,
    '</figure>',
  ].join('\n');
}

// As the web draws them: discs and the dark panel
export function renderSheet(processed: Processed): string {
  const crests = processed.made.filter((m) => m.kind === 'crest');
  const photos = processed.made.filter((m) => m.kind === 'photo');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Images</title>
<style>
  body { background: #0a0f0c; color: #c9d4cc; font: 12px system-ui, sans-serif; margin: 16px; }
  section { display: flex; flex-wrap: wrap; gap: 12px; }
  figure { background: #1a241e; border-radius: 8px; margin: 0; padding: 8px; width: 180px; }
  .source { display: block; height: 90px; margin-bottom: 8px; }
  .photo .big, .photo .small { background: #121a15; border-radius: 50%; object-fit: cover; }
  .crest .big, .crest .small { background: #121a15; border-radius: 4px; object-fit: contain; }
  .photo .big { width: 80px; height: 80px; }
  .photo .small { width: 40px; height: 40px; }
  .crest .big { width: 64px; height: 64px; }
  .crest .small { width: 32px; height: 32px; }
  figcaption { margin-top: 6px; word-break: break-all; }
</style>
</head>
<body>
<h1>Crests (${crests.length})</h1>
<section>
${crests.map(card).join('\n')}
</section>
<h1>Photos (${photos.length})</h1>
<section>
${photos.map(card).join('\n')}
</section>
</body>
</html>
`;
}
