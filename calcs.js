/* ---------- Calculations: readers can see this code in Sources ---------- */
dash.calc('balance', {
  inputs: ['trade', 'inputs'],
  title: 'Lead balance by country',
  description: 'Lead available for recycling against lead fed to industrial or registered smelters and lead exported, with low and high cases.',
  fn: function (trade, inputs) {
    const P = (id, k) => { const r = inputs.find((x) => x.id === id); return r ? Number(r[k]) : NaN; };
    const has = (id) => inputs.some((x) => x.id === id);
    const T = (iso3, product, flow, year) => {
      const r = trade.find((x) => x.iso3 === iso3 && x.product === product && x.flow === flow && Number(x.year) === year);
      return r && r.tonnes !== null && r.tonnes !== '' ? Number(r.tonnes) : 0;
    };
    const own = (r) => r.basis.indexOf('Reported by') === 0;
    const kt = (t) => { const v = t / 1000; return Math.abs(v) < 100 ? Math.round(v * 10) / 10 : Math.round(v); };
    const L = { lo: P('lead_fraction', 'low'), c: P('lead_fraction', 'central'), hi: P('lead_fraction', 'high') };
    const F = { lo: P('scrap_fraction', 'low'), c: P('scrap_fraction', 'central'), hi: P('scrap_fraction', 'high') };
    const R = { lo: P('recovery', 'low'), c: P('recovery', 'central'), hi: P('recovery', 'high') };
    const flat = (t) => ({ lo: t, c: t, hi: t });
    // lead in a gross flow of material (tonnes {lo, c, hi}); lo pairs the low tonnage with the low lead content
    const gross = (t, f) => ({ lo: t.lo * f.lo, c: t.c * f.c, hi: t.hi * f.hi });
    // lead in a net flow (imports less exports, tonnes {lo, c, hi}), whatever its sign: lo is the least lead available
    const net = (t, f) => ({ lo: Math.min(t.lo * f.lo, t.lo * f.hi), c: t.c * f.c, hi: Math.max(t.hi * f.lo, t.hi * f.hi) });
    const add3 = (...xs) => ({ lo: xs.reduce((a, x) => a + x.lo, 0), c: xs.reduce((a, x) => a + x.c, 0), hi: xs.reduce((a, x) => a + x.hi, 0) });
    const out = [];
    // own3: lead in the country's own used batteries; spent and scrap: tonnes imported and exported, each {lo, c, hi}
    const finish = (row, own3, spent, scrap, intake3, outputT, basis) => {
      const netT = (x) => ({ lo: x.in.lo - x.out.hi, c: x.in.c - x.out.c, hi: x.in.hi - x.out.lo });
      const spent3 = net(netT(spent), L), scrap3 = net(netT(scrap), F);
      const sup = add3(own3, spent3, scrap3);
      // gross flows: lead coming in (own used batteries and imports) and going out (smelter feed and exports)
      const sIn = gross(spent.in, L), sOut = gross(spent.out, L), cIn = gross(scrap.in, F), cOut = gross(scrap.out, F);
      const inflow = add3(own3, sIn, cIn), outflow = add3(intake3, sOut, cOut);
      const unacc = sup.c - intake3.c;
      const positive = sup.c > 0;
      // share unaccounted, of the lead left for recycling at home: central uses central supply and intake; the low
      // case pairs the lowest supply with the highest intake, the high case the reverse.
      const sh = { c: (sup.c - intake3.c) / sup.c, lo: (sup.lo - intake3.hi) / sup.lo, hi: (sup.hi - intake3.lo) / sup.hi };
      // the same unaccounted lead as a share of the lead in the country's own used batteries
      const shOwn = { c: (sup.c - intake3.c) / own3.c, lo: (sup.lo - intake3.hi) / own3.lo, hi: (sup.hi - intake3.lo) / own3.hi };
      // lead going out against lead coming in (used where more goes out than comes in)
      const ov = { c: outflow.c / inflow.c - 1, lo: outflow.lo / inflow.hi - 1, hi: outflow.hi / inflow.lo - 1 };
      const pct = (x) => Math.round(Math.max(0, x) * 100);
      const exc = (x) => Math.round(Math.max(0, -x) * 100);
      const r1 = (x) => Math.round((1 + x) * 10) / 10;
      const p0 = (x) => Math.round(x * 100);
      Object.assign(row, {
        own: Math.round(own3.c), own_low: Math.round(own3.lo), own_high: Math.round(own3.hi),
        spent: Math.round(spent3.c), spent_low: Math.round(spent3.lo), spent_high: Math.round(spent3.hi),
        scrap: Math.round(scrap3.c), scrap_low: Math.round(scrap3.lo), scrap_high: Math.round(scrap3.hi),
        supply: Math.round(sup.c), supply_low: Math.round(sup.lo), supply_high: Math.round(sup.hi),
        smelter_output: Math.round(outputT), intake_basis: basis,
        intake: Math.round(intake3.c), intake_low: Math.round(intake3.lo), intake_high: Math.round(intake3.hi),
        spent_in: Math.round(sIn.c), spent_in_low: Math.round(sIn.lo), spent_in_high: Math.round(sIn.hi),
        spent_out: Math.round(sOut.c), spent_out_low: Math.round(sOut.lo), spent_out_high: Math.round(sOut.hi),
        scrap_in: Math.round(cIn.c), scrap_in_low: Math.round(cIn.lo), scrap_in_high: Math.round(cIn.hi),
        scrap_out: Math.round(cOut.c), scrap_out_low: Math.round(cOut.lo), scrap_out_high: Math.round(cOut.hi),
        inflow: Math.round(inflow.c), inflow_low: Math.round(inflow.lo), inflow_high: Math.round(inflow.hi),
        outflow: Math.round(outflow.c), outflow_low: Math.round(outflow.lo), outflow_high: Math.round(outflow.hi),
        exported: Math.round(sOut.c + cOut.c),
        unaccounted: Math.round(unacc),
        // where more lead goes out than the recorded supply holds: the lead that must come from unrecorded sources
        unrecorded: Math.round(Math.max(0, -unacc)),
        share_pct: positive ? pct(sh.c) : 0, share_low_pct: positive ? pct(sh.lo) : 0, share_high_pct: positive ? pct(sh.hi) : 0,
        share_own_pct: positive ? pct(shOwn.c) : 0, share_own_low_pct: positive ? pct(shOwn.lo) : 0, share_own_high_pct: positive ? pct(shOwn.hi) : 0,
        // where intake exceeds supply: how much more lead the smelters take in than the recorded supply holds
        excess_pct: positive ? exc(sh.c) : null, excess_low_pct: positive ? exc(sh.hi) : null, excess_high_pct: positive ? exc(sh.lo) : null,
        over_pct: p0(ov.c), over_low_pct: p0(ov.lo), over_high_pct: p0(ov.hi),
        over_ratio: r1(ov.c), over_low_ratio: r1(ov.lo), over_high_ratio: r1(ov.hi),
        // wording for the panels where more lead goes out than comes in
        over_phrase: unacc >= 0 ? '' : ov.c >= 1 ? r1(ov.c) + ' times' : p0(ov.c) + '% more than',
        over_range: unacc >= 0 ? '' : ov.c >= 1 ? 'range ' + r1(ov.lo) + '–' + r1(ov.hi) + ' times'
          : ov.lo >= 0 ? 'range ' + p0(ov.lo) + '–' + p0(ov.hi) + '% more'
          : 'range: from ' + p0(-ov.lo) + '% less to ' + p0(ov.hi) + '% more',
        status: unacc >= 0 ? 'unaccounted' : 'gap',
      });
      for (const k of ['own', 'spent', 'scrap', 'supply', 'intake', 'smelter_output', 'unaccounted', 'unrecorded', 'spent_in', 'spent_out', 'scrap_in', 'scrap_out', 'inflow', 'outflow', 'exported']) row[k + '_kt'] = kt(row[k]);
      for (const k of ['own', 'spent', 'scrap', 'supply', 'intake', 'spent_in', 'spent_out', 'scrap_in', 'scrap_out', 'inflow', 'outflow']) { row[k + '_low_kt'] = kt(row[k + '_low']); row[k + '_high_kt'] = kt(row[k + '_high']); }
      out.push(row);
    };
    // Countries that make no batteries at home (assumed): lead in their own used batteries = lead in new batteries
    // they imported, net of exports, 2-4 years earlier (years they reported themselves); smelter intake = refined lead
    // exports / recovery. A parameter named <iso3>_spent_<flow>_<year> replaces the trade figure for spent batteries.
    const IMPORTERS = [['GHA', 'Ghana', [2023, 2024]], ['NGA', 'Nigeria', [2024]], ['COD', 'DR Congo', [2024]], ['ETH', 'Ethiopia', [2023]]];
    const spentT = (iso3, flow, year) => {
      const id = iso3.toLowerCase() + '_spent_' + flow.toLowerCase() + '_' + year;
      return has(id) ? { lo: P(id, 'low'), c: P(id, 'central'), hi: P(id, 'high') } : flat(T(iso3, 'Spent batteries', flow, year));
    };
    for (const [iso3, country, years] of IMPORTERS) {
      for (const year of years) {
        const yrs = [year - 4, year - 3, year - 2];
        const nets = yrs.map((y) => {
          const m = trade.find((x) => x.iso3 === iso3 && x.product === 'New lead-acid batteries' && x.flow === 'Imports' && Number(x.year) === y);
          if (!m || !own(m) || m.tonnes === null || m.tonnes === '') return null;
          return Number(m.tonnes) - T(iso3, 'New lead-acid batteries', 'Exports', y);
        }).filter((v) => v !== null);
        if (!nets.length) continue;
        const mean = nets.reduce((a, b) => a + b, 0) / nets.length;
        const own3 = { lo: Math.min(...nets) * L.lo, c: mean * L.c, hi: Math.max(...nets) * L.hi };
        const spent = { in: spentT(iso3, 'Imports', year), out: spentT(iso3, 'Exports', year) };
        const scrap = { in: flat(T(iso3, 'Lead waste and scrap', 'Imports', year)), out: flat(T(iso3, 'Lead waste and scrap', 'Exports', year)) };
        const exp = T(iso3, 'Refined and unwrought lead', 'Exports', year);
        const intake = { lo: exp / R.hi, c: exp / R.c, hi: exp / R.lo };
        finish({ key: iso3 + '-' + year, iso3: iso3, country: country, year: year, period: String(year), battery_years: nets.length, battery_from: year - 4, battery_to: year - 2 },
          own3, spent, scrap, intake, exp, 'refined lead exports ÷ recovery');
      }
    }
    // India (FY2024-25, matched to calendar 2024 trade): lead in its own used batteries = battery share of refined
    // lead consumption three years earlier, less lead in net exports of new batteries that year; intake by
    // registered recyclers = registered share x recycled lead output / recovery; high case = EPR-reported recycling.
    {
      const year = 2024, ly = 2021;
      const netBat = T('IND', 'New lead-acid batteries', 'Exports', ly) - T('IND', 'New lead-acid batteries', 'Imports', ly);
      const own3 = {
        lo: P('ind_battery_share', 'low') * P('ind_consumption_2021', 'low') - netBat * L.hi,
        c: P('ind_battery_share', 'central') * P('ind_consumption_2021', 'central') - netBat * L.c,
        hi: P('ind_battery_share', 'high') * P('ind_consumption_2021', 'high') - netBat * L.lo,
      };
      const spent = { in: flat(T('IND', 'Spent batteries', 'Imports', year)), out: flat(T('IND', 'Spent batteries', 'Exports', year)) };
      const scrap = { in: flat(T('IND', 'Lead waste and scrap', 'Imports', year)), out: flat(T('IND', 'Lead waste and scrap', 'Exports', year)) };
      const prod = P('ind_recycled_output_fy2025', 'central');
      const regOut = P('ind_registered_share', 'central') * prod;
      const eprLead = P('ind_epr_recycled', 'central') / P('ind_epr_months', 'central') * 12 * L.c;
      const intake = { lo: P('ind_registered_share', 'low') * prod / R.hi, c: regOut / R.c, hi: Math.max(eprLead, regOut / R.lo) };
      finish({ key: 'IND-2024', iso3: 'IND', country: 'India', year: year, period: 'FY2024–25', battery_years: 1, battery_from: ly, battery_to: ly },
        own3, spent, scrap, intake, regOut, "Registered recyclers' output ÷ recovery");
    }
    // Indonesia, provisional (2024 trade): lead in its own used batteries = Wilson's 2021 estimate of used
    // batteries generated (battery stock / service life) x lead fraction; smelter intake = industrial secondary
    // lead output / recovery (low: 2024 refined lead exports, central: USGS 2022, high: formal capacity run full).
    if (has('idn_ulab_t') && has('idn_secondary_output_t')) {
      const year = 2024;
      const own3 = { lo: P('idn_ulab_t', 'low') * L.lo, c: P('idn_ulab_t', 'central') * L.c, hi: P('idn_ulab_t', 'high') * L.hi };
      const spent = { in: flat(T('IDN', 'Spent batteries', 'Imports', year)), out: flat(T('IDN', 'Spent batteries', 'Exports', year)) };
      const scrap = { in: flat(T('IDN', 'Lead waste and scrap', 'Imports', year)), out: flat(T('IDN', 'Lead waste and scrap', 'Exports', year)) };
      const o = { lo: P('idn_secondary_output_t', 'low'), c: P('idn_secondary_output_t', 'central'), hi: P('idn_secondary_output_t', 'high') };
      const intake = { lo: o.lo / R.hi, c: o.c / R.c, hi: o.hi / R.lo };
      finish({ key: 'IDN-' + year, iso3: 'IDN', country: 'Indonesia', year: year, period: year + ' (provisional)', battery_years: 1, battery_from: 2020, battery_to: 2020, provisional: true },
        own3, spent, scrap, intake, o.c, 'secondary lead output ÷ recovery');
    }
    // the latest year for each country is the one the map and the country panel show
    out.forEach((r) => { r.latest = !out.some((o) => o.iso3 === r.iso3 && o.year > r.year); });
    return out;
  }
});

dash.calc('leadtrade', {
  inputs: ['trade', 'inputs'],
  title: 'Lead in and out, by product',
  description: 'Imports and exports of refined lead, spent batteries, scrap and new batteries, in tonnes of lead.',
  fn: function (trade, inputs) {
    const P = (id) => { const r = inputs.find((x) => x.id === id); return r ? Number(r.central) : NaN; };
    const lf = P('lead_fraction'), sf = P('scrap_fraction');
    const kt = (t) => { const v = t / 1000; return Math.abs(v) < 100 ? Math.round(v * 10) / 10 : Math.round(v); };
    const find = (iso3, product, flow, year) => trade.find((x) => x.iso3 === iso3 && x.product === product && x.flow === flow && Number(x.year) === year);
    const T = (iso3, product, flow, year) => { const r = find(iso3, product, flow, year); return r && r.tonnes !== null && r.tonnes !== '' ? Number(r.tonnes) : 0; };
    // every country and year with refined lead rows; a figure that was not reported counts as zero and is counted in `missing`
    const pairs = [];
    trade.forEach((x) => {
      if (x.product !== 'Refined and unwrought lead') return;
      if (!pairs.some((p) => p[0] === x.iso3 && p[2] === Number(x.year))) pairs.push([x.iso3, x.country, Number(x.year)]);
    });
    const rows = [];
    for (const [iso3, country, year] of pairs) {
      const r = { key: iso3 + '-' + year, iso3, country, year, missing: 0 };
      for (const [flow, pre] of [['Imports', 'in'], ['Exports', 'out']]) {
        for (const product of ['Refined and unwrought lead', 'Spent batteries', 'Lead waste and scrap', 'New lead-acid batteries']) {
          const f = find(iso3, product, flow, year);
          if (!f || f.tonnes === null || f.tonnes === '') r.missing += 1;
        }
        r[pre + '_refined'] = Math.round(T(iso3, 'Refined and unwrought lead', flow, year));
        r[pre + '_spent'] = Math.round(lf * T(iso3, 'Spent batteries', flow, year));
        r[pre + '_scrap'] = Math.round(sf * T(iso3, 'Lead waste and scrap', flow, year));
        r[pre + '_new'] = Math.round(lf * T(iso3, 'New lead-acid batteries', flow, year));
        r['lead_' + pre] = r[pre + '_refined'] + r[pre + '_spent'] + r[pre + '_scrap'] + r[pre + '_new'];
      }
      r.net_export = r.lead_out - r.lead_in;
      for (const k of ['lead_in', 'lead_out', 'net_export', 'in_refined', 'in_spent', 'in_scrap', 'in_new', 'out_refined', 'out_spent', 'out_scrap', 'out_new']) r[k + '_kt'] = kt(r[k]);
      rows.push(r);
    }
    // the latest year for each country is the one the map draws
    rows.forEach((r) => { r.latest = !rows.some((o) => o.iso3 === r.iso3 && o.year > r.year); });
    return rows;
  }
});

dash.calc('catalogue', {
  inputs: ['smelters'],
  title: 'Smelters and lead capacity by status',
  description: 'Catalogued smelters and their combined lead output capacity, by country and status group.',
  fn: function (smelters) {
    // smelters and lead capacity per country for each list filter: confirmed = grades A-B,
    // probable_plus = A-C, closed = X, all = every catalogued row
    const groups = { confirmed: ['A', 'B'], probable_plus: ['A', 'B', 'C'], closed: ['X'], all: null };
    const out = [];
    const isos = [];
    smelters.forEach((s) => { if (isos.indexOf(s.iso3) < 0) isos.push(s.iso3); });
    for (const iso3 of isos) for (const filter of Object.keys(groups)) {
      const codes = groups[filter];
      const list = smelters.filter((s) => s.iso3 === iso3 && (!codes || codes.indexOf(s.grade_code) >= 0));
      // lead capacity: the catalogue's lead output, or its battery capacity x 0.6 where that is all it gives
      const withCap = list.filter((s) => s.lead_capacity_tpy !== null && s.lead_capacity_tpy !== '' && s.lead_capacity_tpy !== undefined);
      out.push({ key: iso3 + '-' + filter, iso3: iso3, filter: filter, smelters: list.length, with_capacity: withCap.length,
        capacity_tpy: Math.round(withCap.reduce((a, s) => a + Number(s.lead_capacity_tpy), 0)) });
    }
    return out;
  }
});

