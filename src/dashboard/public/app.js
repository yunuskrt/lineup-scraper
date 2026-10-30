// Renders what the server computes; no counting here
'use strict';

const state = {
  tab: 'progress',
  overview: null,
  dimension: 'group',
  type: 'Match Report',
  coverage: { show: 'below', kind: '' },
  links: { page: 1 },
  history: { page: 1 },
};

const DIMENSION_NAMES = {
  group: 'Group',
  competition: 'Competition',
  season: 'Season',
  era: 'Era',
  club: 'Curated club',
};

const CELL_NAMES = {
  clubEra: 'Club, per era',
  leagueSeason: 'League season',
  uclSeason: 'Champions League season',
  tournament: 'World Cup or Euro',
};

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (name === 'class') node.className = value;
    else if (name.startsWith('on')) node.addEventListener(name.slice(2), value);
    else if (name in node && name !== 'list') node[name] = value;
    else node.setAttribute(name, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : String(child));
  }
  return node;
}

const fmt = (n) => Number(n).toLocaleString('en-US');

function pct(count, total) {
  if (!total) return '0%';
  const share = (count / total) * 100;
  return `${share < 10 && share > 0 ? share.toFixed(1) : Math.round(share)}%`;
}

function mb(bytes) {
  return `${(bytes / 1_000_000).toFixed(bytes < 10_000_000 ? 2 : 1)} MB`;
}

function meter(count, total, small = false) {
  const width = total ? Math.min(100, (count / total) * 100) : 0;
  return el(
    'div',
    {
      class: small ? 'meter small' : 'meter',
      role: 'meter',
      'aria-valuemin': 0,
      'aria-valuemax': total,
      'aria-valuenow': count,
      title: `${fmt(count)} of ${fmt(total)} (${pct(count, total)})`,
    },
    el('span', { style: `width:${width}%` }),
  );
}

function statusBadge(status) {
  if (status.startsWith('error: ')) {
    return el('span', { class: 'badge critical', title: status }, status);
  }
  if (status === 'ingested') return el('span', { class: 'badge good' }, status);
  if (status === 'to save') return el('span', { class: 'badge neutral' }, status);
  return el('span', { class: 'badge' }, status);
}

function select(options, value, onchange, label) {
  return el(
    'select',
    { 'aria-label': label, onchange: (e) => onchange(e.target.value) },
    options.map(([v, text]) => el('option', { value: v, selected: v === value }, text)),
  );
}

function table(headers, rows) {
  if (rows.length === 0) return el('div', { class: 'table-wrap' }, el('div', { class: 'empty' }, 'Nothing here'));
  return el(
    'div',
    { class: 'table-wrap' },
    el(
      'table',
      {},
      el('thead', {}, el('tr', {}, headers.map(([text, cls]) => el('th', { class: cls }, text)))),
      el('tbody', {}, rows),
    ),
  );
}

function pager(view, go) {
  return el(
    'div',
    { class: 'pager' },
    el('button', { type: 'button', disabled: view.page <= 1, onclick: () => go(view.page - 1) }, '‹ Prev'),
    el('span', {}, `Page ${view.page} of ${view.pages}`),
    el('button', { type: 'button', disabled: view.page >= view.pages, onclick: () => go(view.page + 1) }, 'Next ›'),
  );
}

async function api(path) {
  const res = await fetch(path, { headers: { accept: 'application/json' } });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

function showError(section, error) {
  section.replaceChildren(el('div', { class: 'card errors' }, `Could not load: ${error.message}`));
}

function keyLabel(dimension, key) {
  const labels = state.overview?.labels;
  if (dimension === 'competition') return labels?.competitions[key] ?? key;
  if (dimension === 'club') return labels?.clubs[key] ?? key;
  return key;
}

function renderWarnings(overview) {
  const box = document.getElementById('warnings');
  const items = [
    ...overview.problems.map((message) => ({ message, command: '' })),
    ...overview.warnings,
  ];
  box.replaceChildren(
    ...items.map((w) =>
      el('div', { class: 'warning' }, el('span', { class: 'badge warning' }, 'Check'), el('span', {}, w.message), w.command ? el('code', {}, w.command) : null),
    ),
  );
}

function typeCard(progress) {
  return el(
    'div',
    { class: 'card' },
    el('h3', {}, progress.type, el('span', {}, `${fmt(progress.total)} links`)),
    progress.steps.map((s) =>
      el(
        'div',
        { class: 'step' },
        el('span', {}, s.step),
        meter(s.count, progress.total),
        el('span', { class: 'value' }, `${fmt(s.count)}/${fmt(progress.total)} · ${pct(s.count, progress.total)}`),
      ),
    ),
    progress.errors ? el('div', { class: 'errors' }, el('span', { class: 'badge critical' }, `${fmt(progress.errors)} at error`)) : null,
  );
}

function breakdownTable(overview) {
  const rows = overview.breakdowns[state.dimension] ?? [];
  const sample = overview.totals.find((t) => t.type === state.type);
  const steps = sample ? sample.steps.map((s) => s.step) : [];
  return table(
    [[DIMENSION_NAMES[state.dimension]], ['Links', 'num'], ...steps.map((s) => [s, 'num']), ['Errors', 'num']],
    rows.flatMap((row) => {
      const p = row.types.find((t) => t.type === state.type);
      if (!p) return [];
      return [
        el(
          'tr',
          {},
          el('td', {}, keyLabel(state.dimension, row.key)),
          el('td', { class: 'num' }, fmt(p.total)),
          p.steps.map((s) =>
            el('td', { class: 'num' }, el('div', { class: 'cell-meter' }, `${fmt(s.count)} · ${pct(s.count, p.total)}`, meter(s.count, p.total, true))),
          ),
          el('td', { class: 'num' }, p.errors ? el('span', { class: 'badge critical' }, fmt(p.errors)) : '0'),
        ),
      ];
    }),
  );
}

function renderProgress() {
  const section = document.getElementById('progress');
  const overview = state.overview;
  if (!overview) return;
  const types = overview.totals.map((t) => [t.type, t.type]);
  section.replaceChildren(
    el('div', { class: 'cards' }, overview.totals.map(typeCard)),
    el('h2', {}, 'Breakdown'),
    el(
      'div',
      { class: 'toolbar' },
      select(Object.entries(DIMENSION_NAMES), state.dimension, (v) => { state.dimension = v; renderProgress(); }, 'Break down by'),
      select(types, state.type, (v) => { state.type = v; renderProgress(); }, 'Link type'),
      el('span', { class: 'count' }, 'Players and images count under their match block'),
    ),
    breakdownTable(overview),
  );
}

async function renderCoverage() {
  const section = document.getElementById('coverage');
  const view = await api('/api/coverage');
  const { show, kind } = state.coverage;
  const cells = view.cells.filter(
    (c) =>
      (!kind || c.kind === kind) &&
      (show === 'all' ||
        (show === 'below' && c.isBelow && !c.isUnreachable) ||
        (show === 'unreachable' && c.isUnreachable) ||
        (show === 'reached' && !c.isBelow)),
  );
  const owner = (c) => (c.kind === 'clubEra' ? view.labels.clubs[c.owner] : view.labels.competitions[c.owner]) ?? c.owner;
  const stateOf = (c) => {
    if (!c.isBelow) return el('span', { class: 'badge good' }, 'at floor');
    if (c.isUnreachable) return el('span', { class: 'badge warning' }, `can't reach (pool ${c.pool})`);
    return el('span', { class: 'badge neutral' }, `${c.floor - c.ingested} to go`);
  };
  const count = (f) => view.cells.filter(f).length;
  section.replaceChildren(
    el(
      'div',
      { class: 'toolbar' },
      select(
        [
          ['below', `Below floor, reachable (${count((c) => c.isBelow && !c.isUnreachable)})`],
          ['unreachable', `Can't reach (${count((c) => c.isUnreachable)})`],
          ['reached', `At floor (${count((c) => !c.isBelow)})`],
          ['all', `All cells (${view.cells.length})`],
        ],
        show,
        (v) => { state.coverage.show = v; renderCoverage().catch((e) => showError(section, e)); },
        'Show cells',
      ),
      select([['', 'Every cell kind'], ...Object.entries(CELL_NAMES)], kind, (v) => { state.coverage.kind = v; renderCoverage().catch((e) => showError(section, e)); }, 'Cell kind'),
      el('span', { class: 'count' }, `${fmt(cells.length)} cells · playable means ingested`),
    ),
    table(
      [['Cell'], ['For'], ['Period'], ['Ingested / floor', 'num'], ['Pool', 'num'], ['State']],
      cells.map((c) =>
        el(
          'tr',
          {},
          el('td', {}, CELL_NAMES[c.kind]),
          el('td', {}, owner(c)),
          el('td', {}, c.period),
          el('td', { class: 'num' }, el('div', { class: 'cell-meter' }, `${fmt(c.ingested)}/${c.floor}`, meter(c.ingested, c.floor, true))),
          el('td', { class: 'num' }, fmt(c.pool)),
          el('td', {}, stateOf(c)),
        ),
      ),
    ),
    el('p', { class: 'note' }, "Can't reach: the groups hold fewer pool matches than the floor (match-pool-scope.md § 3). It's a gap in the groups, not in your saving."),
  );
}

function linksQuery() {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(state.links)) if (value) params.set(name, value);
  return params.toString();
}

async function renderLinks() {
  const section = document.getElementById('links');
  const view = await api(`/api/links?${linksQuery()}`);
  const f = state.links;
  const set = (name) => (value) => {
    state.links = { ...state.links, [name]: value, page: 1 };
    renderLinks().catch((e) => showError(section, e));
  };
  const options = (values, all, label = (v) => v) => [['', all], ...values.map((v) => [v, label(v)])];
  let timer;
  const search = el('input', {
    type: 'search',
    placeholder: 'Id or file name',
    value: f.q ?? '',
    'aria-label': 'Search links',
    oninput: (e) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        state.focusSearch = true;
        set('q')(e.target.value);
      }, 250);
    },
  });
  section.replaceChildren(
    el(
      'div',
      { class: 'toolbar' },
      select(options(view.facets.types, 'Every type'), f.type ?? '', set('type'), 'Type'),
      select(options(view.facets.statuses, 'Every status', (s) => (s === 'error' ? 'any error' : s)), f.status ?? '', set('status'), 'Status'),
      select(options(view.facets.groups, 'Every group'), f.group ?? '', set('group'), 'Group'),
      select(options(view.facets.competitions, 'Every competition', (c) => keyLabel('competition', c)), f.competition ?? '', set('competition'), 'Competition'),
      select(options(view.facets.seasons, 'Every season'), f.season ?? '', set('season'), 'Season'),
      search,
      el('span', { class: 'count' }, `${fmt(view.total)} links`),
    ),
    table(
      [['#', 'num'], ['Type'], ['Id'], ['Save as'], ['Status'], ['Group'], ['Competition'], ['Season'], ['Link']],
      view.rows.map((r) =>
        el(
          'tr',
          {},
          el('td', { class: 'num' }, r.index),
          el('td', {}, r.type),
          el('td', {}, el('code', {}, r.key)),
          el('td', {}, el('code', {}, r.saveAs)),
          el('td', {}, statusBadge(r.status)),
          el('td', {}, r.groups.join(', ')),
          el('td', {}, r.competition ? keyLabel('competition', r.competition) : ''),
          el('td', {}, r.season ?? ''),
          el('td', {}, el('a', { href: r.link, target: '_blank', rel: 'noopener noreferrer' }, 'Open')),
        ),
      ),
    ),
    pager(view, (page) => { state.links.page = page; renderLinks().catch((e) => showError(section, e)); }),
    el('p', { class: 'note' }, 'Open opens the link in your own browser, for you to save. The dashboard never fetches it.'),
  );
  if (state.focusSearch) {
    state.focusSearch = false;
    search.focus();
    search.setSelectionRange(search.value.length, search.value.length);
  }
}

async function renderHistory() {
  const section = document.getElementById('history');
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(state.history)) if (value) params.set(name, value);
  const view = await api(`/api/history?${params}`);
  const h = state.history;
  const set = (name) => (value) => {
    state.history = { ...state.history, [name]: value, page: 1 };
    renderHistory().catch((e) => showError(section, e));
  };
  const date = (name, label) => el('input', { type: 'date', value: h[name] ?? '', 'aria-label': label, onchange: (e) => set(name)(e.target.value) });
  section.replaceChildren(
    el(
      'div',
      { class: 'toolbar' },
      select([['', 'Every kind'], ...['fixture', 'match', 'player', 'crest', 'photo'].map((k) => [k, k])], h.kind ?? '', set('kind'), 'Kind'),
      select([['', 'Every result'], ...['imported', 'duplicate', 'refused'].map((r) => [r, r])], h.result ?? '', set('result'), 'Result'),
      el('label', {}, 'From ', date('from', 'From')),
      el('label', {}, 'To ', date('to', 'To')),
      el('span', { class: 'count' }, `${fmt(view.total)} imports`),
    ),
    el('div', { class: 'days' }, view.perDay.map((d) => el('span', {}, `${d.day}: ${fmt(d.count)}`))),
    table(
      [['When'], ['File'], ['Kind'], ['Key'], ['Result'], ['Reason'], ['Records', 'num']],
      view.lines.map((l) =>
        el(
          'tr',
          {},
          el('td', {}, l.at.replace('T', ' ').replace('Z', ' UTC')),
          el('td', {}, el('code', {}, l.file)),
          el('td', {}, l.kind ?? ''),
          el('td', {}, l.key ?? ''),
          el('td', {}, el('span', { class: l.result === 'refused' ? 'badge critical' : l.result === 'imported' ? 'badge good' : 'badge neutral' }, l.result)),
          el('td', {}, l.reason ?? ''),
          el('td', { class: 'num' }, l.records),
        ),
      ),
    ),
    pager(view, (page) => { state.history.page = page; renderHistory().catch((e) => showError(section, e)); }),
  );
}

async function renderFailures() {
  const section = document.getElementById('failures');
  const failures = await api('/api/failures');
  const names = { row: 'Link', import: 'Import', inbox: 'Inbox', note: 'Status' };
  section.replaceChildren(
    failures.length === 0
      ? el('div', { class: 'card' }, el('span', { class: 'badge good' }, 'No failures'))
      : table(
          [['From'], ['Where'], ['Reason'], ['What to do']],
          failures.map((f) =>
            el(
              'tr',
              {},
              el('td', {}, names[f.source] ?? f.source),
              el('td', {}, el('code', {}, f.ref)),
              el('td', {}, el('span', { class: f.source === 'inbox' ? 'badge warning' : 'badge critical' }, f.reason)),
              el('td', {}, f.todo),
            ),
          ),
        ),
  );
}

async function renderSizes(refresh = false) {
  const section = document.getElementById('sizes');
  section.replaceChildren(el('div', { class: 'empty' }, 'Reading the database and the bucket…'));
  const view = await api(`/api/sizes${refresh ? '?refresh=1' : ''}`);
  const blocks = [
    el(
      'div',
      { class: 'toolbar' },
      el('span', {}, `Target `, el('code', {}, view.target), ` · read ${view.readAt.replace('T', ' ').slice(0, 19)} UTC`),
      el('button', { type: 'button', onclick: () => renderSizes(true).catch((e) => showError(section, e)) }, 'Refresh'),
    ),
  ];
  if (view.databaseBytes !== null) {
    blocks.push(
      el(
        'div',
        { class: 'card' },
        el('h3', {}, 'Database', el('span', {}, view.limitSource)),
        el(
          'div',
          { class: 'step' },
          el('span', {}, 'size'),
          meter(view.databaseBytes, 1_000_000_000),
          el('span', { class: 'value' }, `${mb(view.databaseBytes)} · ${(view.databaseShare * 100).toFixed(1)}%`),
        ),
      ),
    );
  }
  if (view.tables) {
    blocks.push(
      el('h2', {}, 'Content tables'),
      table(
        [['Table'], ['Rows', 'num'], ['Size', 'num']],
        view.tables.map((t) => el('tr', {}, el('td', {}, el('code', {}, t.table)), el('td', { class: 'num' }, fmt(t.rows)), el('td', { class: 'num' }, mb(t.bytes)))),
      ),
    );
  }
  if (view.bucket) {
    blocks.push(
      el('h2', {}, `Images bucket · ${mb(view.bucketBytes)}`),
      table(
        [['Prefix'], ['Objects', 'num'], ['Size', 'num']],
        view.bucket.map((p) => el('tr', {}, el('td', {}, el('code', {}, p.prefix)), el('td', { class: 'num' }, fmt(p.objects)), el('td', { class: 'num' }, mb(p.bytes)))),
      ),
    );
  }
  for (const note of view.notes) blocks.push(el('p', { class: 'note' }, note));
  blocks.push(el('p', { class: 'note' }, 'Read only. pg_database_size can differ from the storage Neon bills.'));
  section.replaceChildren(...blocks);
}

const RENDERERS = {
  progress: async () => renderProgress(),
  coverage: renderCoverage,
  links: renderLinks,
  history: renderHistory,
  failures: renderFailures,
  sizes: () => renderSizes(false),
};

async function show(tab) {
  state.tab = tab;
  for (const button of document.querySelectorAll('.tabs button')) {
    button.setAttribute('aria-selected', String(button.dataset.tab === tab));
  }
  for (const section of document.querySelectorAll('.view')) section.hidden = section.id !== tab;
  const section = document.getElementById(tab);
  try {
    await RENDERERS[tab]();
  } catch (error) {
    showError(section, error);
  }
}

async function reload() {
  try {
    state.overview = await api('/api/overview');
    renderWarnings(state.overview);
  } catch (error) {
    showError(document.getElementById('progress'), error);
  }
  await show(state.tab);
}

for (const button of document.querySelectorAll('.tabs button')) {
  button.addEventListener('click', () => show(button.dataset.tab));
}
document.getElementById('reload').addEventListener('click', reload);
void reload();
