import type { CompetitionKind } from '@/dataset/enums.js';
import { matchSeasonIssue, seasonIssue } from '@/dataset/season.js';

describe('seasonIssue()', () => {
  it.each<[string, string, boolean, string | null]>([
    ['2002-03', '2003-05-03', false, null],
    ['2002-03', '2002-07-01', false, null],
    ['2006', '2006-07-05', true, null],
    ['2002-03', '2003-07-01', false, 'Date is outside the season'],
    ['2002-04', '2003-05-03', false, 'Season years must be consecutive'],
    ['2002', '2002-09-01', false, 'Club seasons span two years'],
    ['2006-07', '2006-07-05', true, 'Tournament seasons are a single year'],
    ['2006', '2007-01-01', true, 'Date is outside the season'],
    ['1999-00', '2000-01-01', false, 'Season is outside the covered range'],
    ['2026', '2026-06-20', true, 'Season is outside the covered range'],
  ])('%s on %s (tournament %s) → %j', (label, date, isTournament, issue) => {
    expect(seasonIssue(label, date, isTournament)).toBe(issue);
  });
});

describe('matchSeasonIssue()', () => {
  it.each<[CompetitionKind, string, string, string | null]>([
    // 2019-20 club seasons run to 31 August 2020
    ['ucl', '2019-20', '2020-08-23', null],
    ['uel', '2019-20', '2020-08-21', null],
    ['league', '2019-20', '2020-08-31', null],
    ['league', '2019-20', '2020-09-01', 'Date is outside the season'],
    ['league', '2018-19', '2019-08-01', 'Date is outside the season'],
    ['league', '2020-21', '2020-06-30', 'Date is outside the season'],
    // Euro 2020 keeps its label and was played in 2021
    ['euro', '2020', '2021-07-11', null],
    ['euro', '2020', '2021-06-01', null],
    ['euro', '2020', '2021-05-31', 'Date is outside the season'],
    ['euro', '2020', '2021-08-01', 'Date is outside the season'],
    ['world_cup', '2020', '2021-07-11', 'Date is outside the season'],
    ['euro', '2016', '2017-06-15', 'Date is outside the season'],
    // Without an exception, the seed's rules apply
    ['world_cup', '2006', '2006-07-09', null],
    ['euro', '2008', '2008-06-29', null],
    ['ucl', '2004-05', '2005-05-25', null],
    ['ucl', '2004', '2005-05-25', 'Club seasons span two years'],
    ['world_cup', '2026', '2026-07-19', 'Season is outside the covered range'],
  ])('%s %s on %s → %j', (kind, label, date, issue) => {
    expect(matchSeasonIssue(kind, label, date)).toBe(issue);
  });
});
