/* ---------- Shared helpers ---------- */
// the page opens with the world map, no country chosen, and the map and list on confirmed and probable plants
window.lmState = { layer: 'share' };
window.lmSel = { iso: null, id: null, list: 'probable_plus', mapList: 'probable_plus', flowProd: 'spent', flowYear: 2024 };
var LM_RANK = { A: 5, B: 4, C: 3, D: 2, P: 1, X: 0 };
var LM_LIST = { confirmed: ['A', 'B'], probable_plus: ['A', 'B', 'C'], closed: ['X'], all: null };
var LM_KMAX = 120;
var LM_FACTORY = 'M2 22V11l6 3.5V11l6 3.5V11l4 2.3V3h4v19z';
var LM_SCOPE = { plant: 'this plant', company: 'company total' };
var LM_BUILT = { GHA: true, IND: true };  // countries with their own balance section
// ULAB Plume, where "Predict plume" sends a catalogued site (position, name, catalogue ID, location precision,
// reported lead output where a plant publishes one, and its lead capacity as a hint). The beta site reads these
// first; once ULAB Plume's main branch is promoted to release, point this at https://ulabplume.org/. A page can
// set window.LM_PLUME_URL before this script to override it.
var LM_PLUME_URL = (typeof window !== 'undefined' && window.LM_PLUME_URL) || 'https://ulabplume-beta.netlify.app/';
var LM_PLUME_LEAD_MAX = 200000;  // ULAB Plume's lead produced box takes 10 to 200,000 t/yr
var LM_CAPREF = 250000;  // lead capacity, t/yr, drawn at the largest icon size
var LM_FLOWPROD = { spent: 'spent lead-acid batteries (HS 8549.11)', new: 'new lead-acid batteries (HS 8507.10, 8507.20)' };

function lmFmt(v, fmt) {
  if (v === null || v === undefined || v === '') return null;
  var n = Number(v);
  if (isNaN(n)) return String(v);
  var s;
  if (fmt === 'kt') s = Math.abs(n) < 100 ? d3.format(',.1f')(n) : d3.format(',.0f')(n);
  else if (fmt === 't') s = d3.format(',.0f')(n);
  else s = d3.format(',')(n);
  return s.replace('−', '-');
}

function lmRows(id) {
  var d = dash.data(id);
  return d.status === 'ok' && Array.isArray(d.data) ? d.data : null;
}

function lmEmpty(v) {
  return v === null || v === undefined || v === '' || (typeof v === 'number' && isNaN(v)) || (Array.isArray(v) && v.length === 0);
}

function lmCap(r) {
  var v = r ? Number(r.lead_capacity_tpy) : NaN;
  return r && !lmEmpty(r.lead_capacity_tpy) && isFinite(v) && v > 0 ? v : 0;
}

function lmDerived(r) {
  return !!r && r.lead_capacity_basis === 'battery capacity x 0.6';
}

function lmCountry(iso) {
  if (!iso) return null;
  return (lmRows('countries') || []).find(function (r) { return r.iso3 === iso; }) || null;
}

function lmHasXY(r) {
  return !!r && !lmEmpty(r.lat) && !lmEmpty(r.lon) && isFinite(Number(r.lat)) && isFinite(Number(r.lon));
}

function lmSmelter(id) {
  if (!id) return null;
  return (lmRows('smelters') || []).find(function (r) { return r.id === id; }) || null;
}

function lmLinks(v) {
  var a = v;
  if (typeof a === 'string') { try { a = JSON.parse(a); } catch (e) { a = []; } }
  return (Array.isArray(a) ? a : []).filter(function (l) { return l && /^https:\/\//.test(String(l.url || '')); });
}

function lmStyle(code) {
  if (code === 'A' || code === 'B') return { fill: 'var(--color-ok)', stroke: 'var(--color-bg)', hollow: false };
  if (code === 'C') return { fill: 'var(--color-warn)', stroke: 'var(--color-bg)', hollow: false };
  if (code === 'D' || code === 'P') return { fill: 'var(--cds-chart-muted)', stroke: 'var(--color-fg-muted)', hollow: false };
  return { fill: 'var(--color-bg)', stroke: 'var(--color-bad)', hollow: true };
}

// icon edge in screen pixels: from 14 px up to 36 px at 250,000 t/yr of lead or more; 13 px if capacity is unknown
function lmIconSize(cap) {
  return cap > 0 ? 14 + 22 * Math.sqrt(Math.min(1, cap / LM_CAPREF)) : 13;
}

function lmFactory(sel, s, st) {
  sel.append('path').attr('d', LM_FACTORY)
    .attr('transform', 'translate(' + (-s / 2) + ',' + (-s / 2) + ') scale(' + (s / 24) + ')')
    .attr('vector-effect', 'non-scaling-stroke')
    .style('fill', st.fill).style('stroke', st.stroke).style('stroke-width', st.hollow ? 1.8 : 1)
    .style('stroke-linejoin', 'round');
}

function lmMiniIcon(parent, code, size) {
  var st = lmStyle(code);
  var sv = d3.select(parent).append('svg').attr('width', size).attr('height', size).attr('viewBox', '0 0 24 24').attr('aria-hidden', 'true');
  sv.append('path').attr('d', LM_FACTORY).style('fill', st.fill).style('stroke', st.stroke)
    .style('stroke-width', st.hollow ? 2.4 : 1.4).style('stroke-linejoin', 'round');
}

function lmTipLine(node, text, cls) {
  var d = document.createElement('div');
  if (cls) d.className = cls;
  d.textContent = text;
  node.appendChild(d);
}

function lmTipShow(host, tip, ev, build, hostH) {
  var node = tip.node();
  node.replaceChildren();
  build(node);
  tip.style('display', null);
  var x, y;
  if (ev.type === 'focus') {
    var bb = ev.target.getBoundingClientRect(), hb = host.getBoundingClientRect();
    x = bb.right - hb.left; y = bb.bottom - hb.top;
  } else {
    var p = d3.pointer(ev, host); x = p[0]; y = p[1];
  }
  var tw = node.offsetWidth, th = node.offsetHeight, W = host.clientWidth, H = hostH || host.clientHeight;
  var left = x + 14; if (left + tw > W) left = Math.max(0, x - tw - 14);
  var top = y + 14; if (top + th > H) top = Math.max(0, y - th - 14);
  tip.style('left', left + 'px').style('top', top + 'px');
}

function lmStill() {
  return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

/* ---------- Selection: which country or smelter the panel shows ---------- */
// the chosen country's latest lead balance, if it has one
function lmSelBal() {
  var iso = window.lmSel.iso;
  if (!iso) return null;
  return (lmRows('balance') || []).find(function (r) { return r.iso3 === iso && r.latest; }) || null;
}

// blocks that follow the sign of the chosen country's balance
function lmSyncSelCase() {
  var b = lmSelBal();
  document.querySelectorAll('.lm [data-selcase]').forEach(function (el) { el.hidden = !b || b.status !== el.getAttribute('data-selcase'); });
}

function lmSelect(iso, id, opts) {
  var S = window.lmSel;
  S.iso = iso || null;
  S.id = id || null;
  var r = lmSmelter(S.id);
  document.querySelectorAll('.lm [data-panel]').forEach(function (el) {
    var p = el.getAttribute('data-panel');
    el.hidden = p === 'intro' ? !!S.iso : p === 'country' ? (!S.iso || !!S.id) : !S.id;
  });
  var c = lmCountry(S.iso);
  document.querySelectorAll('.lm [data-for]').forEach(function (el) {
    var f = el.getAttribute('data-for');
    el.hidden = f === 'other' ? !S.iso || !!LM_BUILT[S.iso] : f !== S.iso;
  });
  document.querySelectorAll('.lm [data-has]').forEach(function (el) { el.hidden = !c || lmEmpty(c[el.getAttribute('data-has')]); });
  document.querySelectorAll('.lm [data-hasnot]').forEach(function (el) { el.hidden = !!c && !lmEmpty(c[el.getAttribute('data-hasnot')]); });
  lmSyncSelCase();
  document.querySelectorAll('.lm [data-countrysel]').forEach(function (el) { el.value = S.iso || ''; });
  document.querySelectorAll('.lm [data-fwrap]').forEach(function (el) {
    var f = el.getAttribute('data-fwrap');
    el.hidden = !r || (f === 'sources' ? lmLinks(r.sources).length === 0 : lmEmpty(r[f]));
  });
  ['v', 'plist', 'bal', 'smf', 'cf', 'ct', 'cc', 'cb', 'cl', 'balio', 'map'].forEach(function (n) { dash.draw(n); });
  lmSyncFlow();
  var m = window.lmMap;
  if (m && opts && opts.zoom === 'country' && S.iso) m.zoomTo(window.lmState.layer === 'trade' ? 'world' : S.iso);
  if (m && opts && opts.zoom === 'smelter' && S.id) m.zoomToSmelter(S.id);
}

function lmSetList(list) {
  window.lmSel.list = list;
  document.querySelectorAll('.lm [data-list]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-list') === list)); });
  document.querySelectorAll('.lm [data-listcount]').forEach(function (el) { el.hidden = el.getAttribute('data-listcount') !== list; });
  dash.draw('plist');
  dash.draw('cc');
  dash.draw('v');
}

function lmSetMapList(list) {
  window.lmSel.mapList = list;
  document.querySelectorAll('.lm [data-maplist]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-maplist') === list)); });
  dash.draw('map');
}

/* ---------- Which sentences show: follows the sign of each balance ---------- */
dash.onData(function () {
  var rows = lmRows('balance');
  if (!rows) return;
  document.querySelectorAll('.lm [data-case]').forEach(function (el) {
    var p = el.getAttribute('data-case').split(':');
    var r = rows.find(function (x) { return x.key === p[0]; });
    el.hidden = !(r && r.status === p[1]);
  });
  lmSyncSelCase();
});

/* ---------- Controls ---------- */
document.querySelectorAll('.lm [data-layer]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var layer = btn.getAttribute('data-layer');
    window.lmState.layer = layer;
    document.querySelectorAll('.lm [data-layer]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
    document.querySelectorAll('.lm [data-layerkey]').forEach(function (el) { el.hidden = el.getAttribute('data-layerkey') !== layer; });
    dash.draw('map');
    dash.draw('sw');
    lmSyncFlow();
    if (lmFlowMode() && window.lmMap) window.lmMap.zoomTo('world');
  });
});
document.querySelectorAll('.lm [data-zoom]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var z = btn.getAttribute('data-zoom');
    if (z === 'world') { if (window.lmMap) window.lmMap.zoomTo('world'); }
    else lmSelect(z, null, { zoom: 'country' });
  });
});
document.querySelectorAll('.lm [data-zoomby]').forEach(function (btn) {
  btn.addEventListener('click', function () { if (window.lmMap) window.lmMap.zoomBy(btn.getAttribute('data-zoomby') === 'in' ? 1.6 : 1 / 1.6); });
});
document.querySelectorAll('.lm [data-maplist]').forEach(function (btn) {
  btn.addEventListener('click', function () { lmSetMapList(btn.getAttribute('data-maplist')); });
});
document.querySelectorAll('.lm [data-flowprod]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    window.lmSel.flowProd = btn.getAttribute('data-flowprod');
    document.querySelectorAll('.lm [data-flowprod]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
    dash.draw('map');
    lmSyncFlow();
  });
});
document.querySelectorAll('.lm [data-flowyear]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    window.lmSel.flowYear = Number(btn.getAttribute('data-flowyear'));
    document.querySelectorAll('.lm [data-flowyear]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
    dash.draw('map');
    lmSyncFlow();
  });
});
document.querySelectorAll('.lm [data-countrysel]').forEach(function (sel) {
  sel.addEventListener('change', function () { if (sel.value) lmSelect(sel.value, null, { zoom: 'country' }); });
});
document.querySelectorAll('.lm [data-pick]').forEach(function (btn) {
  btn.addEventListener('click', function () { lmSelect(btn.getAttribute('data-pick'), null, { zoom: 'country' }); });
});
document.querySelectorAll('.lm [data-clear]').forEach(function (btn) {
  btn.addEventListener('click', function () { lmSelect(null, null); });
});
document.querySelectorAll('.lm [data-back]').forEach(function (btn) {
  btn.addEventListener('click', function () { lmSelect(window.lmSel.iso, null, { zoom: 'country' }); });
});
document.querySelectorAll('.lm [data-list]').forEach(function (btn) {
  btn.addEventListener('click', function () { lmSetList(btn.getAttribute('data-list')); });
});

/* ---------- Single values in sentences and tables ---------- */
dash.draw('v', function (el) {
  var src = el.getAttribute('data-source'), field = el.getAttribute('data-field');
  var where = (el.getAttribute('data-where') || '').split('=');
  var rows = lmRows(src);
  var inTable = el.tagName === 'TD';
  var row = rows ? rows.find(function (r) { return String(r[where[0]]) === decodeURIComponent(where[1] || ''); }) : null;
  var txt = row ? lmFmt(row[field], el.getAttribute('data-fmt')) : null;
  if (txt === null) { el.textContent = row ? 'not reported' : (inTable ? '' : '—'); return; }
  var lf = el.getAttribute('data-link');
  if (lf && row[lf] && /^https:\/\//.test(String(row[lf]))) {
    var a = document.createElement('a');
    a.href = String(row[lf]); a.target = '_blank'; a.rel = 'noopener';
    a.textContent = txt;
    if (row.note) a.title = String(row.note);
    el.replaceChildren(a);
  } else {
    el.textContent = txt;
  }
});

/* ---------- The panel's smelter list for one country ---------- */
dash.draw('plist', function (tbody) {
  var iso = tbody.getAttribute('data-iso');
  if (iso === 'sel') iso = window.lmSel.iso;
  var d = dash.data('smelters');
  var body = d3.select(tbody);
  body.selectAll('tr.lm-msgrow').remove();
  if (d.status !== 'ok' || !Array.isArray(d.data)) {
    body.selectAll('tr').remove();
    body.append('tr').attr('class', 'lm-msgrow').append('td').attr('colspan', 4).attr('class', 'lm-msg')
      .text(d.status === 'error' ? 'Failed to load' : '—');
    return;
  }
  var codes = LM_LIST[window.lmSel.list];
  var rows = d.data.filter(function (r) { return r.iso3 === iso && (!codes || codes.indexOf(r.grade_code) >= 0); })
    .sort(function (a, b) { return (LM_RANK[b.grade_code] - LM_RANK[a.grade_code]) || (lmCap(b) - lmCap(a)) || (a.id < b.id ? -1 : 1); });
  body.selectAll('tr').data(rows, function (r) { return r && r.id; }).join('tr')
    .attr('data-key', function (r) { return r.id; })
    .each(function (r) {
      var tr = d3.select(this);
      tr.selectAll('*').remove();
      var go = function () { lmSelect(r.iso3, r.id, { zoom: 'smelter' }); };
      tr.on('click', go);
      var name = tr.append('td').append('span').attr('class', 'lm-fname');
      lmMiniIcon(name.node(), r.grade_code, 14);
      name.append('button').attr('type', 'button').attr('class', 'lm-linkbtn').text(r.facility)
        .on('click', function (ev) { ev.stopPropagation(); go(); });
      tr.append('td').text(r.grade);
      var cap = tr.append('td').attr('class', 'num');
      if (lmCap(r)) {
        cap.append('span').attr('data-source', 'smelters').attr('data-field', 'lead_capacity_tpy')
          .attr('data-where', 'id=' + encodeURIComponent(r.id)).text(lmFmt(lmCap(r), 't'));
        if (lmDerived(r)) cap.append('span').attr('class', 'lm-subline').text('from battery capacity');
      } else {
        cap.append('span').attr('class', 'lm-na').text('Not reported');
      }
      var out = tr.append('td').attr('class', 'num');
      if (lmEmpty(r.reported_output_t)) {
        out.append('span').attr('class', 'lm-na').text('Not reported');
      } else {
        out.append('span').attr('data-source', 'smelters').attr('data-field', 'reported_output_t')
          .attr('data-where', 'id=' + encodeURIComponent(r.id)).text(lmFmt(r.reported_output_t, 't'));
        out.append('span').attr('class', 'lm-subline')
          .text(r.reported_output_period + (r.reported_output_scope === 'company' ? ', company total' : ''));
      }
    });
  if (!rows.length) {
    body.append('tr').attr('class', 'lm-msgrow').append('td').attr('colspan', 4).attr('class', 'lm-msg')
      .text('No catalogued smelters in this group.');
  }
});

/* ---------- One smelter's details ---------- */
dash.draw('smf', function (el) {
  var f = el.getAttribute('data-f');
  var r = lmSmelter(window.lmSel.id);
  el.replaceChildren();
  if (!r) { el.textContent = '—'; return; }
  var where = 'id=' + encodeURIComponent(r.id);
  var mark = function (parent, field, text) {
    var s = document.createElement('span');
    s.setAttribute('data-source', 'smelters');
    s.setAttribute('data-field', field);
    s.setAttribute('data-where', where);
    s.textContent = text;
    parent.appendChild(s);
    return s;
  };
  var add = function (parent, text, cls) {
    var s = document.createElement('span');
    if (cls) s.className = cls;
    s.textContent = text;
    parent.appendChild(s);
    return s;
  };
  var link = function (parent, href, text, field) {
    var a = document.createElement('a');
    a.href = href; a.target = '_blank'; a.rel = 'noopener'; a.textContent = text;
    if (field) { a.setAttribute('data-source', 'smelters'); a.setAttribute('data-field', field); a.setAttribute('data-where', where); }
    parent.appendChild(a);
    return a;
  };
  if (f === 'where') {
    mark(el, 'id', r.id); add(el, ' · ');
    mark(el, 'location', r.location); add(el, ' · ');
    mark(el, 'country', r.country);
    return;
  }
  if (f === 'grade') {
    var chip = add(el, '', 'lm-chip');
    lmMiniIcon(chip, r.grade_code, 14);
    mark(chip, 'grade', r.grade);
    if (!lmEmpty(r.status_as_of)) { add(chip, ' · as of '); mark(chip, 'status_as_of', r.status_as_of); }
    return;
  }
  if (f === 'reported_output_t') {
    if (lmEmpty(r[f])) { add(el, 'Not reported', 'lm-na'); return; }
    mark(el, f, lmFmt(r[f], 't'));
    var sub = add(el, '', 'lm-subline');
    mark(sub, 'reported_output_period', r.reported_output_period);
    if (r.reported_output_scope) add(sub, ', ' + (LM_SCOPE[r.reported_output_scope] || r.reported_output_scope));
    return;
  }
  if (/_tpy$/.test(f)) {
    if (lmEmpty(r[f])) { add(el, 'Not reported', 'lm-na'); return; }
    mark(el, f, lmFmt(r[f], 't'));
    if (f === 'lead_capacity_tpy' && lmDerived(r)) add(el, 'battery capacity × 0.6', 'lm-subline');
    return;
  }
  if (f === 'reported_output_note') {
    if (lmEmpty(r[f])) { add(el, 'Not reported', 'lm-na'); return; }
    mark(el, f, r[f]);
    if (/^https:\/\//.test(String(r.reported_output_url || ''))) {
      add(el, ' ');
      link(el, String(r.reported_output_url), r.reported_output_source || 'Source', 'reported_output_source');
    }
    return;
  }
  if (f === 'plume') {
    var located = lmHasXY(r);
    var prec = lmEmpty(r.location_precision) ? '' : String(r.location_precision);
    var lead = r.reported_output_scope === 'plant' && !lmEmpty(r.reported_output_t) ? Math.round(Number(r.reported_output_t)) : null;
    if (lead !== null && (lead < 10 || lead > LM_PLUME_LEAD_MAX)) lead = null;
    var cap = lmEmpty(r.lead_capacity_tpy) ? null : Math.round(Number(r.lead_capacity_tpy));
    if (located) {
      var q = new URLSearchParams();
      q.set('site_lat', String(r.lat));
      q.set('site_lon', String(r.lon));
      q.set('site_name', String(r.facility || '').slice(0, 120));
      q.set('site_ref', String(r.id));
      if (prec) q.set('site_precision', prec);
      if (lead !== null) q.set('lead_produced_tpy', String(lead));
      if (cap !== null && cap > 0) q.set('lead_capacity_tpy', String(cap));
      q.set('from', 'lmic-smelter-map');
      var btn = link(el, LM_PLUME_URL + '?' + q.toString(), 'Predict plume in ULAB Plume ↗');
      btn.className = 'lm-plume-btn';
      btn.setAttribute('data-plume', r.id);
    } else {
      var off = add(el, 'Predict plume', 'lm-plume-btn lm-plume-off');
      off.setAttribute('aria-disabled', 'true');
    }
    var note = document.createElement('p');
    note.className = 'lm-note';
    if (!located) {
      note.textContent = 'Not located in the catalogue, so there is no site to send to ULAB Plume.';
    } else {
      var t = 'Opens ULAB Plume, the dispersion screening tool, with the site at this map position';
      t += prec === 'Compound' ? '' : ' (' + (prec || 'precision not given').toLowerCase() + ': move the pin onto the plant before a final run)';
      if (lead !== null) t += ' and lead produced set to the reported output, ' + lmFmt(lead, 't') + ' t a year (' + r.reported_output_period + ').';
      else t += '. No output is reported, so lead produced stays at the scenario\'s default' + (cap ? '; the lead capacity, ' + lmFmt(cap, 't') + ' t/yr, goes along as a hint only.' : '.');
      note.textContent = t;
    }
    el.appendChild(note);
    return;
  }
  if (f === 'coords') {
    if (lmHasXY(r)) { mark(el, 'lat', String(r.lat)); add(el, ', '); mark(el, 'lon', String(r.lon)); add(el, ' · '); }
    mark(el, 'location_precision', lmEmpty(r.location_precision) ? 'Not located' : r.location_precision);
    if (!lmEmpty(r.coordinate_source)) { add(el, '. '); mark(el, 'coordinate_source', r.coordinate_source); }
    return;
  }
  if (f === 'sources') {
    var ls = lmLinks(r.sources);
    if (!ls.length) { add(el, 'Not reported', 'lm-na'); return; }
    var ul = document.createElement('ul');
    ul.className = 'lm-srcs';
    ul.setAttribute('data-source', 'smelters'); ul.setAttribute('data-field', 'sources'); ul.setAttribute('data-where', where);
    ls.forEach(function (l) { var li = document.createElement('li'); link(li, l.url, l.title || l.url); ul.appendChild(li); });
    el.appendChild(ul);
    return;
  }
  if (lmEmpty(r[f])) add(el, 'Not reported', 'lm-na');
  else mark(el, f, String(r[f]));
});

/* ---------- A country without its own balance section ---------- */
// a figure from the chosen country's latest balance, marked to its row
dash.draw('cb', function (el) {
  var f = el.getAttribute('data-f'), r = lmSelBal();
  el.replaceChildren();
  if (!r || lmEmpty(r[f])) { el.textContent = '—'; return; }
  var s = document.createElement('span');
  s.setAttribute('data-source', 'balance'); s.setAttribute('data-field', f); s.setAttribute('data-where', 'key=' + encodeURIComponent(r.key));
  s.textContent = typeof r[f] === 'number' ? lmFmt(r[f], el.getAttribute('data-fmt')) : String(r[f]);
  el.appendChild(s);
});

// a list field of the chosen country, one item per line
dash.draw('cl', function (el) {
  var c = lmCountry(window.lmSel.iso), f = el.getAttribute('data-f');
  el.replaceChildren();
  var items = c && Array.isArray(c[f]) ? c[f] : [];
  items.forEach(function (t) {
    var li = document.createElement('li');
    li.textContent = String(t);
    el.appendChild(li);
  });
});

// lead coming in (own used batteries and imports) against lead going out (smelter feed and exports)
dash.draw('balio', function (el) {
  el.replaceChildren();
  var d = dash.data('balance');
  if (d.status !== 'ok' || !Array.isArray(d.data)) {
    var m = document.createElement('div'); m.className = 'lm-msg';
    m.textContent = d.status === 'error' ? 'Failed to load' : '—';
    el.appendChild(m); return;
  }
  var r = lmSelBal();
  if (!r) return;
  var w = Math.max(260, el.clientWidth || 400);
  var labH = 16, rowH = 22, gap = 22, top = 2;
  var y1 = top + labH, y2 = y1 + rowH + gap + labH, h = y2 + rowH + 18;
  var max = Math.max(r.inflow_high, r.outflow_high, 1) * 1.02;
  var x = d3.scaleLinear().domain([0, max]).range([0, w - 2]);
  var svg = d3.select(el).append('svg').attr('viewBox', [0, 0, w, h]).attr('width', w).attr('height', h)
    .attr('role', 'img')
    .attr('aria-label', r.country + ': lead coming in against lead going out, thousand tonnes, with low to high ranges');
  var pid = 'lm-hatch-io-' + r.key;
  var pat = svg.append('defs').append('pattern').attr('id', pid).attr('patternUnits', 'userSpaceOnUse')
    .attr('width', 6).attr('height', 6).attr('patternTransform', 'rotate(45)');
  pat.append('line').attr('x1', 1).attr('y1', 0).attr('x2', 1).attr('y2', 6)
    .style('stroke', 'var(--cds-chart-status-critical)').style('stroke-width', 2);
  var tip = d3.select(el).append('div').attr('class', 'lm-tip').style('display', 'none');
  var kt = function (v) { return lmFmt(v / 1000, 'kt') + ' kt'; };
  var rng = function (lo, hi) { return ' (' + lmFmt(lo / 1000, 'kt') + '–' + lmFmt(hi / 1000, 'kt') + ')'; };
  var hover = function (sel, lines) {
    sel.on('pointermove', function (ev) {
      lmTipShow(el, tip, ev, function (n) { lines.forEach(function (l, i) { lmTipLine(n, l, i === 0 ? 'lm-tip-h' : 'lm-tip-s'); }); }, h);
    }).on('pointerleave', function () { tip.style('display', 'none'); });
  };
  var bar = function (y, segs) {
    var x0 = 0;
    segs.forEach(function (s) {
      var v = Math.max(0, s.v);
      if (!(v > 0)) return;
      var rect = svg.append('rect').attr('x', x(x0)).attr('y', y).attr('width', Math.max(0, x(x0 + v) - x(x0))).attr('height', rowH).style('fill', s.c);
      hover(rect, [s.label, kt(s.v)]);
      if (x(x0 + v) - x(x0) > 44) {
        svg.append('text').attr('class', 'lm-vl').attr('x', x(x0) + 5).attr('y', y + rowH / 2 + 4).text(lmFmt(s.v / 1000, 'kt'));
      }
      x0 += v;
    });
  };
  svg.append('text').attr('class', 'lm-axl').attr('x', 0).attr('y', y1 - 4)
    .text('Coming in: ' + kt(r.inflow) + rng(r.inflow_low, r.inflow_high));
  bar(y1, [
    { v: r.own, label: 'Lead in own used batteries', c: dash.colors[0] },
    { v: r.spent_in, label: 'Spent batteries imported', c: dash.colors[1] },
    { v: r.scrap_in, label: 'Lead scrap imported', c: dash.colors[2] }
  ]);
  svg.append('text').attr('class', 'lm-axl').attr('x', 0).attr('y', y2 - 4)
    .text('Going out: ' + kt(r.outflow) + rng(r.outflow_low, r.outflow_high));
  bar(y2, [
    { v: r.intake, label: 'Fed to smelters (refined lead exports ÷ recovery)', c: dash.colors[3] || 'var(--cds-chart-muted)' },
    { v: r.spent_out, label: 'Spent batteries exported', c: dash.colors[1] },
    { v: r.scrap_out, label: 'Lead scrap exported', c: dash.colors[2] }
  ]);
  if (r.status === 'unaccounted') {
    var ua = svg.append('rect').attr('x', x(r.outflow)).attr('y', y2).attr('width', Math.max(0, x(r.inflow) - x(r.outflow))).attr('height', rowH)
      .style('fill', 'url(#' + pid + ')').style('stroke', 'var(--cds-chart-status-critical)').style('stroke-width', 1);
    hover(ua, ['Unaccounted', kt(r.unaccounted) + ', ' + r.share_pct + '% of the lead left for recycling at home']);
    svg.append('text').attr('class', 'lm-vl-out').attr('text-anchor', 'end').attr('x', x(r.inflow)).attr('y', y2 + rowH + 13)
      .text('Unaccounted ' + kt(r.unaccounted) + ' (' + r.share_pct + '%)');
  } else {
    var ex = svg.append('rect').attr('x', x(r.inflow)).attr('y', y1).attr('width', Math.max(0, x(r.outflow) - x(r.inflow))).attr('height', rowH)
      .style('fill', 'url(#' + pid + ')').style('stroke', 'var(--cds-chart-status-critical)').style('stroke-width', 1).style('stroke-dasharray', '3 2');
    hover(ex, ['Not in recorded supply', kt(r.unrecorded) + ' going out that the records do not show coming in']);
    svg.append('text').attr('class', 'lm-vl-out').attr('text-anchor', 'end').attr('x', x(r.outflow)).attr('y', y1 + rowH + 13)
      .text('Unrecorded ' + kt(r.unrecorded));
  }
  [[y1, r.inflow_low, r.inflow_high], [y2, r.outflow_low, r.outflow_high]].forEach(function (a) {
    var yy = a[0] + rowH / 2;
    var g = svg.append('g').style('stroke', 'var(--color-fg)').style('stroke-width', 1.2);
    g.append('line').attr('x1', x(a[1])).attr('x2', x(a[2])).attr('y1', yy).attr('y2', yy);
    g.append('line').attr('x1', x(a[1])).attr('x2', x(a[1])).attr('y1', yy - 5).attr('y2', yy + 5);
    g.append('line').attr('x1', x(a[2])).attr('x2', x(a[2])).attr('y1', yy - 5).attr('y2', yy + 5);
  });
});

dash.draw('cf', function (el) {
  var f = el.getAttribute('data-f');
  var c = lmCountry(window.lmSel.iso);
  el.replaceChildren();
  if (!c) { el.textContent = '—'; return; }
  var mark = function (src, field, where, text) {
    var s = document.createElement('span');
    s.setAttribute('data-source', src); s.setAttribute('data-field', field); s.setAttribute('data-where', where);
    s.textContent = text;
    el.appendChild(s);
    return s;
  };
  var cw = 'iso3=' + encodeURIComponent(c.iso3);
  if (f === 'lead_in_kt' || f === 'lead_out_kt') {
    var key = c.iso3 + '-' + c.trade_year;
    var t = (lmRows('leadtrade') || []).find(function (r) { return r.key === key; });
    if (t) mark('leadtrade', f, 'key=' + encodeURIComponent(key), lmFmt(t[f], 'kt'));
    else el.textContent = '—';
    return;
  }
  if (lmEmpty(c[f])) { el.textContent = '—'; return; }
  if (f === 'production_kt' || f === 'exports_kt') { mark('countries', f, cw, lmFmt(c[f], 'kt')); return; }
  if (f === 'production_source' && /^https:\/\//.test(String(c.production_url || ''))) {
    var a = document.createElement('a');
    a.href = String(c.production_url); a.target = '_blank'; a.rel = 'noopener';
    a.textContent = String(c[f]);
    a.setAttribute('data-source', 'countries'); a.setAttribute('data-field', f); a.setAttribute('data-where', cw);
    el.appendChild(a);
    return;
  }
  mark('countries', f, cw, String(c[f]));
});

dash.draw('ct', function (td) {
  var c = lmCountry(window.lmSel.iso);
  td.replaceChildren();
  if (!c) return;
  var key = c.iso3 + '-' + td.getAttribute('data-p') + '-' + td.getAttribute('data-flow') + '-' + c.trade_year;
  var r = (lmRows('trade') || []).find(function (x) { return x.key === key; });
  if (!r) return;
  if (lmEmpty(r.tonnes)) {
    var na = document.createElement('span');
    na.className = 'lm-na';
    na.textContent = 'not reported';
    if (r.note) na.title = String(r.note);
    td.appendChild(na);
    return;
  }
  var a = document.createElement(/^https:\/\//.test(String(r.url || '')) ? 'a' : 'span');
  if (a.tagName === 'A') { a.href = String(r.url); a.target = '_blank'; a.rel = 'noopener'; }
  a.setAttribute('data-source', 'trade'); a.setAttribute('data-field', 'tonnes'); a.setAttribute('data-where', 'key=' + encodeURIComponent(key));
  a.textContent = lmFmt(r.tonnes, 't');
  var tip = [r.basis, r.note].filter(function (x) { return !lmEmpty(x); }).join('. ');
  if (tip) a.title = tip;
  td.appendChild(a);
});

dash.draw('cc', function (el) {
  var iso = window.lmSel.iso;
  el.replaceChildren();
  var key = iso + '-' + window.lmSel.list;
  var r = iso ? (lmRows('catalogue') || []).find(function (x) { return x.key === key; }) : null;
  if (!r) { el.textContent = '—'; return; }
  var f = el.getAttribute('data-f');
  if (f === 'capacity_tpy' && !r.with_capacity) { el.textContent = '—'; return; }
  var s = document.createElement('span');
  s.setAttribute('data-source', 'catalogue'); s.setAttribute('data-field', f); s.setAttribute('data-where', 'key=' + encodeURIComponent(key));
  s.textContent = lmFmt(r[f], 't');
  el.appendChild(s);
});

/* ---------- Trade partners of the chosen country ---------- */
function lmFlowMode() {
  return window.lmState.layer === 'trade' && !!window.lmSel.iso;
}

function lmFlowRows(dir) {
  var S = window.lmSel;
  return (lmRows('flows') || []).filter(function (r) {
    return r.iso3 === S.iso && r.product === S.flowProd && Number(r.year) === S.flowYear && (!dir || r.direction === dir);
  });
}

function lmSyncFlow() {
  var on = lmFlowMode();
  document.querySelectorAll('.lm [data-flowbox]').forEach(function (el) { el.hidden = !on; });
  document.querySelectorAll('.lm .lm-mapcard').forEach(function (el) { el.classList.toggle('lm-flowmode', on); });
  ['ftitle', 'ftot', 'flist'].forEach(function (n) { dash.draw(n); });
}

dash.draw('ftitle', function (el) {
  var c = lmCountry(window.lmSel.iso);
  el.textContent = c ? c.country + ', ' + LM_FLOWPROD[window.lmSel.flowProd] + ', ' + window.lmSel.flowYear : '—';
});

dash.draw('ftot', function (el) {
  el.replaceChildren();
  var r = lmFlowRows(el.getAttribute('data-dir')).find(function (x) { return x.partner_iso3 === '_ALL'; });
  if (!r) { el.textContent = '—'; return; }
  var f = el.getAttribute('data-f');
  var s = document.createElement('span');
  s.setAttribute('data-source', 'flows'); s.setAttribute('data-field', f); s.setAttribute('data-where', 'key=' + encodeURIComponent(r.key));
  s.textContent = lmFmt(r[f], 't');
  el.appendChild(s);
});

dash.draw('flist', function (tbody) {
  var body = d3.select(tbody);
  body.selectAll('tr.lm-msgrow').remove();
  var rows = lmFlowRows(tbody.getAttribute('data-dir')).filter(function (r) { return r.partner_iso3 !== '_ALL'; })
    .sort(function (a, b) { return b.tonnes - a.tonnes; }).slice(0, 10);
  body.selectAll('tr').data(rows, function (r) { return r && r.key; }).join('tr')
    .attr('data-key', function (r) { return r.key; })
    .each(function (r) {
      var tr = d3.select(this);
      tr.selectAll('*').remove();
      var td = tr.append('td').text(r.partner);
      if (r.basis !== 'own report') td.append('span').attr('class', 'lm-subline').text(r.basis);
      tr.append('td').attr('class', 'num').text(lmFmt(r.tonnes, 't'));
      tr.append('td').attr('class', 'num').text(lmFmt(r.share_pct, 'kt'));
    });
  if (!rows.length) {
    body.append('tr').attr('class', 'lm-msgrow').append('td').attr('colspan', 3).attr('class', 'lm-msg').text('None recorded.');
  }
});

/* ---------- Parameter table ---------- */
dash.draw('params', function (tbody) {
  var rows = lmRows('inputs') || [];
  d3.select(tbody).selectAll('tr').data(rows, function (r) { return r && r.id; }).join('tr')
    .attr('data-key', function (r) { return r.id; })
    .each(function (r) {
      var tr = d3.select(this);
      tr.selectAll('*').remove();
      tr.append('td').text(r.label);
      tr.append('td').text(r.scope);
      ['low', 'central', 'high'].forEach(function (k) { tr.append('td').attr('class', 'num').text(lmFmt(r[k])); });
      tr.append('td').text(r.unit);
      var td = tr.append('td');
      td.append('span').text(r.basis + ' ');
      if (r.url && /^https:\/\//.test(String(r.url))) {
        td.append('a').attr('href', String(r.url)).attr('target', '_blank').attr('rel', 'noopener').text(r.source);
      } else if (r.source) {
        td.append('span').text(r.source);
      }
    });
});

/* ---------- Balance bars for one country ---------- */
dash.draw('bal', function (el) {
  el.replaceChildren();
  var key = el.getAttribute('data-bal');
  var d = dash.data('balance');
  if (d.status !== 'ok' || !Array.isArray(d.data)) {
    var m = document.createElement('div'); m.className = 'lm-msg';
    m.textContent = d.status === 'error' ? 'Failed to load' : '—';
    el.appendChild(m); return;
  }
  var r = d.data.find(function (x) { return x.key === key; });
  if (!r) return;
  var w = Math.max(260, el.clientWidth || 400);
  var labH = 16, rowH = 22, gap = 22, top = 2;
  var y1 = top + labH, y2 = y1 + rowH + gap + labH, h = y2 + rowH + 18;
  var max = Math.max(r.supply_high, r.intake_high) * 1.02;
  var x = d3.scaleLinear().domain([0, max]).range([0, w - 2]);
  var svg = d3.select(el).append('svg').attr('viewBox', [0, 0, w, h]).attr('width', w).attr('height', h)
    .attr('role', 'img')
    .attr('aria-label', r.country + ': lead available for recycling against lead fed to smelters, thousand tonnes, with low to high ranges');
  var pid = 'lm-hatch-' + key;
  var pat = svg.append('defs').append('pattern').attr('id', pid).attr('patternUnits', 'userSpaceOnUse')
    .attr('width', 6).attr('height', 6).attr('patternTransform', 'rotate(45)');
  pat.append('line').attr('x1', 1).attr('y1', 0).attr('x2', 1).attr('y2', 6)
    .style('stroke', 'var(--cds-chart-status-critical)').style('stroke-width', 2);
  var tip = d3.select(el).append('div').attr('class', 'lm-tip').style('display', 'none');
  var kt = function (v) { return lmFmt(v / 1000, 'kt') + ' kt'; };
  var hover = function (sel, lines) {
    sel.on('pointermove', function (ev) {
      lmTipShow(el, tip, ev, function (n) { lines.forEach(function (l, i) { lmTipLine(n, l, i === 0 ? 'lm-tip-h' : 'lm-tip-s'); }); }, h);
    }).on('pointerleave', function () { tip.style('display', 'none'); });
  };
  svg.append('text').attr('class', 'lm-axl').attr('x', 0).attr('y', y1 - 4)
    .text('Available for recycling: ' + kt(r.supply) + ' (' + lmFmt(r.supply_low / 1000, 'kt') + '–' + lmFmt(r.supply_high / 1000, 'kt') + ')');
  var segs = [
    { v: r.own, label: 'Lead in own used batteries', c: dash.colors[0] },
    { v: r.spent, label: 'Spent batteries imported, net', c: dash.colors[1] },
    { v: r.scrap, label: 'Lead scrap imported, net', c: dash.colors[2] }
  ];
  var x0 = 0;
  segs.forEach(function (s) {
    var v = Math.max(0, s.v);
    var rect = svg.append('rect').attr('x', x(x0)).attr('y', y1).attr('width', Math.max(0, x(x0 + v) - x(x0))).attr('height', rowH).style('fill', s.c);
    hover(rect, [s.label, kt(s.v)]);
    if (x(x0 + v) - x(x0) > 44) {
      svg.append('text').attr('class', 'lm-vl').attr('x', x(x0) + 5).attr('y', y1 + rowH / 2 + 4).text(lmFmt(s.v / 1000, 'kt'));
    }
    x0 += v;
  });
  var label2 = r.iso3 === 'IND' ? 'Fed to registered recyclers: ' : 'Fed to smelters (exports ÷ recovery): ';
  svg.append('text').attr('class', 'lm-axl').attr('x', 0).attr('y', y2 - 4)
    .text(label2 + kt(r.intake) + ' (' + lmFmt(r.intake_low / 1000, 'kt') + '–' + lmFmt(r.intake_high / 1000, 'kt') + ')');
  var ib = svg.append('rect').attr('x', x(0)).attr('y', y2).attr('width', x(r.intake) - x(0)).attr('height', rowH).style('fill', dash.colors[3] || 'var(--cds-chart-muted)');
  hover(ib, [label2.replace(/: $/, ''), kt(r.intake)]);
  if (r.status === 'unaccounted') {
    var ua = svg.append('rect').attr('x', x(r.intake)).attr('y', y2).attr('width', Math.max(0, x(r.supply) - x(r.intake))).attr('height', rowH)
      .style('fill', 'url(#' + pid + ')').style('stroke', 'var(--cds-chart-status-critical)').style('stroke-width', 1);
    hover(ua, ['Unaccounted', kt(r.unaccounted) + ', ' + r.share_pct + '% of the lead available']);
    svg.append('text').attr('class', 'lm-vl-out').attr('text-anchor', 'end').attr('x', x(r.supply)).attr('y', y2 + rowH + 13)
      .text('Unaccounted ' + kt(r.unaccounted) + ' (' + r.share_pct + '%)');
  } else {
    var ex = svg.append('rect').attr('x', x(r.supply)).attr('y', y1).attr('width', Math.max(0, x(r.intake) - x(r.supply))).attr('height', rowH)
      .style('fill', 'url(#' + pid + ')').style('stroke', 'var(--cds-chart-status-critical)').style('stroke-width', 1).style('stroke-dasharray', '3 2');
    hover(ex, ['Not in recorded supply', kt(-r.unaccounted) + ' that the smelters must get from unrecorded sources']);
    svg.append('text').attr('class', 'lm-vl-out').attr('text-anchor', 'end').attr('x', x(r.intake)).attr('y', y1 + rowH + 13)
      .text('Unrecorded feed ' + kt(-r.unaccounted));
  }
  // low-high whiskers
  [[y1, r.supply_low, r.supply_high], [y2, r.intake_low, r.intake_high]].forEach(function (a) {
    var yy = a[0] + rowH / 2;
    var g = svg.append('g').style('stroke', 'var(--color-fg)').style('stroke-width', 1.2);
    g.append('line').attr('x1', x(a[1])).attr('x2', x(a[2])).attr('y1', yy).attr('y2', yy);
    g.append('line').attr('x1', x(a[1])).attr('x2', x(a[1])).attr('y1', yy - 5).attr('y2', yy + 5);
    g.append('line').attr('x1', x(a[2])).attr('x2', x(a[2])).attr('y1', yy - 5).attr('y2', yy + 5);
  });
});

/* ---------- Map ---------- */
function lmOnMap(r) {
  var codes = LM_LIST[window.lmSel.mapList];
  return !codes || codes.indexOf(r.grade_code) >= 0;
}

// one site per distinct point; plants that share a point are drawn side by side
function lmBuildSites(st) {
  var all = lmRows('smelters') || [];
  var selId = window.lmSel.id;
  var vis = all.filter(function (r) { return lmHasXY(r) && (lmOnMap(r) || r.id === selId); });
  st.sites = d3.groups(vis, function (r) { return Number(r.lat).toFixed(4) + ',' + Number(r.lon).toFixed(4); }).map(function (e) {
    var items = e[1].slice().sort(function (a, b) { return (lmCap(b) - lmCap(a)) || (LM_RANK[b.grade_code] - LM_RANK[a.grade_code]); });
    var p = st.proj([Number(items[0].lon), Number(items[0].lat)]);
    var sizes = items.map(function (r) { return lmIconSize(lmCap(r)); });
    return { key: e[0], x: p[0], y: p[1], items: items, sizes: sizes,
      w: d3.sum(sizes) + 3 * (items.length - 1), h: d3.max(sizes), cap: d3.sum(items, lmCap) };
  });
}

// sites whose icons would overlap at zoom k are drawn as one icon with a count
function lmClusters(sites, k) {
  var order = sites.slice().sort(function (a, b) { return (b.cap - a.cap) || (b.items.length - a.items.length) || (a.key < b.key ? -1 : 1); });
  var out = [];
  order.forEach(function (s) {
    var hit = null;
    for (var i = 0; i < out.length && !hit; i++) {
      var c = out[i];
      if (Math.abs(s.x - c.x) * k < (s.w + c.w) / 2 + 3 && Math.abs(s.y - c.y) * k < (s.h + c.h) / 2 + 3) hit = c;
    }
    if (hit) hit.sites.push(s);
    else out.push({ x: s.x, y: s.y, w: s.w, h: s.h, sites: [s] });
  });
  out.forEach(function (c) {
    c.items = [];
    c.sites.forEach(function (s) { c.items = c.items.concat(s.items); });
    c.key = c.items.map(function (r) { return r.id; }).sort().join('|');
    c.size = Math.min(42, lmIconSize(d3.sum(c.items, lmCap)) + 4);
  });
  return out;
}

function lmTipSmelter(n, r) {
  lmTipLine(n, r.facility, 'lm-tip-h');
  lmTipLine(n, lmCap(r) ? 'Lead capacity ' + lmFmt(lmCap(r), 't') + ' t/yr' + (lmDerived(r) ? ' (battery capacity × 0.6)' : '') : 'Lead capacity not reported', 'lm-tip-v');
  lmTipLine(n, r.grade + (lmEmpty(r.status_as_of) ? '' : ', as of ' + r.status_as_of), 'lm-tip-s');
  if (!lmEmpty(r.reported_output_t)) {
    lmTipLine(n, 'Reported output ' + lmFmt(r.reported_output_t, 't') + ' t, ' + r.reported_output_period + (r.reported_output_scope === 'company' ? ' (company total)' : ''), 'lm-tip-s');
  }
  lmTipLine(n, 'Mapped as: ' + String(r.location_precision || '').toLowerCase(), 'lm-tip-s');
  lmTipLine(n, 'Click for details', 'lm-tip-hint');
}

function lmDrawCluster(st, g, c) {
  g.selectAll('*').remove();
  var selId = window.lmSel.id;
  var hide = function () { st.tip.style('display', 'none'); };
  var spread = c.sites.length === 1 || st.k >= LM_KMAX * 0.98;
  if (spread) {
    var items = c.sites.length === 1 ? c.sites[0].items : c.items.slice().sort(function (a, b) { return lmCap(b) - lmCap(a); });
    var sizes = items.map(function (r) { return lmIconSize(lmCap(r)); });
    var x = -(d3.sum(sizes) + 3 * (items.length - 1)) / 2;
    items.forEach(function (r, i) {
      var s = sizes[i], cx = x + s / 2;
      x += s + 3;
      var ig = g.append('g').attr('class', 'lm-ico').attr('transform', 'translate(' + cx + ',0)')
        .attr('tabindex', 0).attr('role', 'button')
        .attr('aria-label', r.facility + '. ' + r.grade + '. ' + (lmCap(r) ? 'Lead capacity ' + lmFmt(lmCap(r), 't') + ' tonnes a year.' : 'Lead capacity not reported.'));
      ig.append('rect').attr('x', -s / 2 - 2).attr('y', -s / 2 - 2).attr('width', s + 4).attr('height', s + 4).attr('rx', 3)
        .style('fill', 'transparent');
      if (r.id === selId) ig.append('circle').attr('r', s / 2 + 5).style('fill', 'none').style('stroke', 'var(--color-fg)').style('stroke-width', 2);
      lmFactory(ig, s, lmStyle(r.grade_code));
      var tip = function (ev) { lmTipShow(st.el, st.tip, ev, function (n) { lmTipSmelter(n, r); }, st.h); };
      var go = function () { hide(); lmSelect(r.iso3, r.id); };
      ig.on('pointermove', tip).on('focus', tip).on('pointerleave', hide).on('blur', hide)
        .on('click', go)
        .on('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); } });
    });
    return;
  }
  var s = c.size;
  var best = c.items.slice().sort(function (a, b) { return LM_RANK[b.grade_code] - LM_RANK[a.grade_code]; })[0];
  var ig = g.append('g').attr('class', 'lm-ico').attr('tabindex', 0).attr('role', 'button')
    .attr('aria-label', c.items.length + ' smelters close together: ' + c.items.map(function (r) { return r.facility; }).join('; ') + '. Press to zoom in.');
  ig.append('rect').attr('x', -s / 2 - 2).attr('y', -s / 2 - 2).attr('width', s + 4).attr('height', s + 4).attr('rx', 3)
    .style('fill', 'transparent');
  if (c.items.some(function (r) { return r.id === selId; })) {
    ig.append('circle').attr('r', s / 2 + 5).style('fill', 'none').style('stroke', 'var(--color-fg)').style('stroke-width', 2);
  }
  lmFactory(ig, s, lmStyle(best.grade_code));
  var bx = s / 2 - 1, by = -s / 2 + 1;
  ig.append('circle').attr('cx', bx).attr('cy', by).attr('r', 8)
    .style('fill', 'var(--color-fg)').style('stroke', 'var(--color-bg)').style('stroke-width', 1.5);
  ig.append('text').attr('class', 'lm-badge').attr('x', bx).attr('y', by + 3.5).attr('text-anchor', 'middle').text(c.items.length);
  var tip = function (ev) {
    lmTipShow(st.el, st.tip, ev, function (n) {
      lmTipLine(n, c.items.length + ' smelters close together', 'lm-tip-h');
      c.items.forEach(function (r) {
        lmTipLine(n, r.facility + ': ' + (lmCap(r) ? lmFmt(lmCap(r), 't') + ' t/yr' : 'capacity not reported'), 'lm-tip-s');
      });
      lmTipLine(n, 'Click to zoom in', 'lm-tip-hint');
    }, st.h);
  };
  var go = function () { hide(); lmZoomCluster(st, c); };
  ig.on('pointermove', tip).on('focus', tip).on('pointerleave', hide).on('blur', hide)
    .on('click', go)
    .on('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); } });
}

function lmDrawSmelters(st, force) {
  var k = st.k || 1;
  var cl = lmClusters(st.sites || [], k);
  var sig = cl.map(function (c) { return c.key; }).join(';') + '#' + (window.lmSel.id || '') + (k >= LM_KMAX * 0.98 ? '#max' : '');
  var nodes = st.gs.selectAll('g.lm-fac').data(cl, function (c) { return c && c.key; }).join('g').attr('class', 'lm-fac');
  nodes.attr('transform', function (c) { return 'translate(' + c.x + ',' + c.y + ') scale(' + (1 / k) + ')'; });
  if (!force && sig === st.sig) return;
  st.sig = sig;
  nodes.each(function (c) { lmDrawCluster(st, d3.select(this), c); });
}

function lmRescale(st) {
  var k = st.k || 1, iso = window.lmSel.iso;
  st.gc.selectAll('path').style('stroke-width', function (f) { return (f.properties.iso3 === iso ? 1.8 : f.properties.catalogue ? 0.9 : 0.4) / k; });
  st.gt.selectAll('g.lm-glyph').attr('transform', function (d) { return 'translate(' + d.x + ',' + d.y + ') scale(' + (1 / k) + ')'; });
  if (st.gf) st.gf.selectAll('g.lm-fpt').attr('transform', function (d) { return 'translate(' + d.x + ',' + d.y + ') scale(' + (1 / k) + ')'; });
}

// lines from each partner to the chosen country (imports) and from it to each partner (exports)
function lmDrawFlows(st, proj, feats) {
  if (!st.ga || !st.gf) return;
  var S = window.lmSel;
  var hide = function () { st.tip.style('display', 'none'); };
  var flows = [], pts = [];
  var home = null;
  if (lmFlowMode()) {
    var f = feats.find(function (x) { return x.properties.iso3 === S.iso; });
    var c = lmCountry(S.iso);
    if (f) home = proj(d3.geoCentroid(f));
    if (home) {
      flows = lmFlowRows().filter(function (r) { return r.partner_iso3 !== '_ALL' && !lmEmpty(r.lon) && !lmEmpty(r.lat); })
        .map(function (r) {
          var p = proj([Number(r.lon), Number(r.lat)]);
          var a = r.direction === 'Imports' ? p : home, b = r.direction === 'Imports' ? home : p;
          var dx = b[0] - a[0], dy = b[1] - a[1], len = Math.sqrt(dx * dx + dy * dy) || 1, bend = 0.22 * len;
          var cx = (a[0] + b[0]) / 2 - dy / len * bend, cy = (a[1] + b[1]) / 2 + dx / len * bend;
          return { r: r, p: p, d: 'M' + a[0] + ',' + a[1] + 'Q' + cx + ',' + cy + ' ' + b[0] + ',' + b[1], name: c ? c.country : S.iso };
        });
    }
  }
  var tmax = d3.max(flows, function (d) { return d.r.tonnes; }) || 1;
  flows.sort(function (a, b) { return b.r.tonnes - a.r.tonnes; });
  var col = function (d) { return d.r.direction === 'Imports' ? dash.colors[0] : dash.colors[1]; };
  var tipFlow = function (ev, d) {
    lmTipShow(st.el, st.tip, ev, function (n) {
      var r = d.r;
      lmTipLine(n, r.direction === 'Imports' ? r.partner + ' → ' + d.name : d.name + ' → ' + r.partner, 'lm-tip-h');
      lmTipLine(n, lmFmt(r.tonnes, 't') + ' t, ' + lmFmt(r.share_pct, 'kt') + '% of ' + (r.direction === 'Imports' ? 'its imports' : 'its exports'), 'lm-tip-v');
      lmTipLine(n, LM_FLOWPROD[r.product] + ', ' + r.year + '; ' + (r.basis === 'own report' ? d.name + "'s own report" : r.basis), 'lm-tip-s');
    }, st.h);
  };
  var lines = st.ga.selectAll('g.lm-flow').data(flows, function (d) { return d && d.r.key; }).join('g').attr('class', 'lm-flow');
  lines.selectAll('*').remove();
  lines.each(function (d) {
    var g = d3.select(this);
    var w = 1 + 9 * Math.sqrt(d.r.tonnes / tmax);
    g.append('path').attr('d', d.d).attr('vector-effect', 'non-scaling-stroke')
      .style('fill', 'none').style('stroke', col(d)).style('stroke-opacity', 0.8).style('stroke-width', w).style('stroke-linecap', 'round')
      .style('stroke-dasharray', d.r.basis === 'own report' ? null : '6 4');
    g.append('path').attr('d', d.d).attr('vector-effect', 'non-scaling-stroke')
      .style('fill', 'none').style('stroke', 'transparent').style('stroke-width', w + 8)
      .on('pointermove', function (ev) { tipFlow(ev, d); }).on('pointerleave', hide);
  });
  // partner points, largest first, the eight largest labelled; the chosen country's point on top
  flows.forEach(function (d, i) { pts.push({ key: d.r.key, x: d.p[0], y: d.p[1], d: d, label: i < 8 ? d.r.partner : '' }); });
  if (home && flows.length) pts.push({ key: 'home', x: home[0], y: home[1], home: true, label: '' });
  var dots = st.gf.selectAll('g.lm-fpt').data(pts, function (d) { return d && d.key; }).join('g').attr('class', 'lm-fpt');
  dots.selectAll('*').remove();
  dots.each(function (o) {
    var g = d3.select(this);
    if (o.home) {
      g.append('circle').attr('r', 6).style('fill', 'var(--color-fg)').style('stroke', 'var(--color-bg)').style('stroke-width', 2);
      return;
    }
    g.append('circle').attr('r', 2.5 + 4 * Math.sqrt(o.d.r.tonnes / tmax))
      .style('fill', col(o.d)).style('stroke', 'var(--color-bg)').style('stroke-width', 1)
      .on('pointermove', function (ev) { tipFlow(ev, o.d); }).on('pointerleave', hide);
    if (o.label) g.append('text').attr('class', 'lm-flabel').attr('x', 7).attr('y', 4).text(o.label);
  });
  st.gs.style('opacity', flows.length ? 0.45 : null);
  st.gt.style('display', lmFlowMode() ? 'none' : null);
}

function lmApplyZoom(st, t, instant) {
  if (instant || lmStill()) st.svg.call(st.zoom.transform, t);
  else st.svg.transition().duration(650).call(st.zoom.transform, t);
}

function lmCountryView(st, iso) {
  var f = (st.features || []).find(function (x) { return x.properties.iso3 === iso; });
  if (!f || !st.path) return null;
  var b = st.path.bounds(f);
  if ((b[1][0] - b[0][0]) / st.w > 0.4 && st.proj) {
    // a country as wide as Russia is framed on its catalogued plants instead
    var pts = (lmRows('smelters') || []).filter(function (r) { return r.iso3 === iso && lmHasXY(r); })
      .map(function (r) { return st.proj([Number(r.lon), Number(r.lat)]); });
    if (pts.length) {
      var x0 = d3.min(pts, function (p) { return p[0]; }), x1 = d3.max(pts, function (p) { return p[0]; });
      var y0 = d3.min(pts, function (p) { return p[1]; }), y1 = d3.max(pts, function (p) { return p[1]; });
      var pad = Math.max(24, (x1 - x0) * 0.3, (y1 - y0) * 0.3);
      b = [[x0 - pad, y0 - pad], [x1 + pad, y1 + pad]];
    }
  }
  var dx = b[1][0] - b[0][0], dy = b[1][1] - b[0][1];
  return { k: Math.max(1, Math.min(LM_KMAX, 0.82 / Math.max(dx / st.w, dy / st.h))), cx: (b[0][0] + b[1][0]) / 2, cy: (b[0][1] + b[1][1]) / 2 };
}

function lmZoomState(st, iso, instant) {
  if (!st.path) return;
  var t = d3.zoomIdentity;
  if (iso && iso !== 'world') {
    var v = lmCountryView(st, iso);
    if (!v) return;
    t = d3.zoomIdentity.translate(st.w / 2 - v.k * v.cx, st.h / 2 - v.k * v.cy).scale(v.k);
  }
  lmApplyZoom(st, t, instant);
}

// centre on one smelter, at the country's zoom or closer, until no other site shares its icon
function lmZoomSmelter(st, id) {
  if (!st.proj) return;
  lmBuildSites(st);
  var r = lmSmelter(id);
  var site = st.sites.find(function (s) { return s.items.some(function (x) { return x.id === id; }); });
  if (!site) { if (r) lmZoomState(st, r.iso3); return; }
  var v = r ? lmCountryView(st, r.iso3) : null;
  var k = v ? v.k : 1;
  for (var i = 0; i < 40 && k < LM_KMAX; i++) {
    var c = lmClusters(st.sites, k).find(function (x) { return x.sites.indexOf(site) >= 0; });
    if (!c || c.sites.length === 1) break;
    k = Math.min(LM_KMAX, k * 1.25);
  }
  lmApplyZoom(st, d3.zoomIdentity.translate(st.w / 2 - k * site.x, st.h / 2 - k * site.y).scale(k));
}

function lmZoomCluster(st, c) {
  var xs = c.sites.map(function (s) { return s.x; }), ys = c.sites.map(function (s) { return s.y; });
  var x0 = d3.min(xs), x1 = d3.max(xs), y0 = d3.min(ys), y1 = d3.max(ys);
  var dx = Math.max(1e-6, x1 - x0), dy = Math.max(1e-6, y1 - y0);
  var k = Math.min(LM_KMAX, Math.max(st.k * 1.6, 0.5 * Math.min(st.w / dx, st.h / dy)));
  lmApplyZoom(st, d3.zoomIdentity.translate(st.w / 2 - k * (x0 + x1) / 2, st.h / 2 - k * (y0 + y1) / 2).scale(k));
}

dash.draw('map', {
  mount: function (el) {
    var svg = d3.select(el).append('svg').attr('role', 'group');
    var pat = svg.append('defs').append('pattern').attr('id', 'lm-hatch-map').attr('patternUnits', 'userSpaceOnUse')
      .attr('width', 6).attr('height', 6).attr('patternTransform', 'rotate(45)');
    pat.append('rect').attr('width', 6).attr('height', 6).style('fill', dash.colors[1]).style('fill-opacity', 0.22);
    pat.append('line').attr('x1', 1).attr('y1', 0).attr('x2', 1).attr('y2', 6).style('stroke', dash.colors[1]).style('stroke-width', 2);
    var g = svg.append('g');
    var st = { el: el, svg: svg, g: g, gc: g.append('g'), gt: g.append('g'), gs: g.append('g'), ga: g.append('g'), gf: g.append('g'), k: 1, w: 0, h: 0, sites: [] };
    st.msg = d3.select(el).append('div').attr('class', 'lm-msg').style('display', 'none');
    st.tip = d3.select(el).append('div').attr('class', 'lm-tip').style('display', 'none');
    st.zoom = d3.zoom().scaleExtent([1, LM_KMAX]).clickDistance(4)
      .extent(function () { return [[0, 0], [st.w || 1, st.h || 1]]; })
      .filter(function (ev) { return (ev.type !== 'wheel' || ev.ctrlKey || ev.metaKey) && !ev.button; })
      .on('zoom', function (ev) {
        st.k = ev.transform.k;
        g.attr('transform', ev.transform);
        lmRescale(st);
        lmDrawSmelters(st);
      });
    svg.call(st.zoom);
    window.lmMap = {
      zoomTo: function (iso) { lmZoomState(st, iso); },
      zoomToSmelter: function (id) { lmZoomSmelter(st, id); },
      zoomBy: function (f) {
        if (lmStill()) st.svg.call(st.zoom.scaleBy, f);
        else st.svg.transition().duration(300).call(st.zoom.scaleBy, f);
      }
    };
    return st;
  },
  update: function (el, st) {
    var W = dash.data('world');
    if (W.status !== 'ok' || !W.data || !Array.isArray(W.data.features)) {
      st.svg.style('display', 'none');
      st.msg.style('display', null).text(W.status === 'error' ? 'Failed to load the map' : 'Loading the map…');
      return;
    }
    st.svg.style('display', null);
    st.msg.style('display', 'none').text('');
    var w = Math.max(280, Math.floor(el.clientWidth || 600));
    var h = Math.round(Math.max(260, Math.min(620, w * 0.58)));
    var resized = w !== st.w || h !== st.h;
    st.svg.attr('viewBox', [0, 0, w, h]).attr('width', w).attr('height', h);
    st.zoom.extent([[0, 0], [w, h]]).translateExtent([[-w * 0.25, -h * 0.25], [w * 1.25, h * 1.25]]);
    if (resized) {
      st.w = w; st.h = h; st.k = 1;
      st.svg.call(st.zoom.transform, d3.zoomIdentity);
    }
    var feats = W.data.features.filter(function (f) { return f.properties.name !== 'Antarctica'; });
    var proj = d3.geoNaturalEarth1().fitExtent([[6, 6], [w - 6, h - 6]], { type: 'FeatureCollection', features: feats });
    var path = d3.geoPath(proj);
    st.path = path; st.features = feats; st.proj = proj;
    var bal = {}, lt = {};
    (lmRows('balance') || []).forEach(function (r) { if (r.latest) bal[r.iso3] = r; });
    (lmRows('leadtrade') || []).forEach(function (r) { if (r.latest) lt[r.iso3] = r; });
    var layer = window.lmState.layer, selIso = window.lmSel.iso;
    st.svg.attr('aria-label', (layer === 'share'
      ? 'World map: catalogue countries in grey; countries with a lead balance shaded by the share of lead left unaccounted, or hatched where more lead goes out than recorded supply holds.'
      : lmFlowMode() ? 'World map: lines show where the chosen country\'s ' + LM_FLOWPROD[window.lmSel.flowProd] + ' came from and went to in ' + window.lmSel.flowYear + '; the partner tables below the map list the figures.'
      : 'World map: half-circles show lead coming into and going out of each catalogue country in its latest reported year.') +
      ' Factory icons are catalogued smelters, sized by lead capacity.');

    var fill = function (f) {
      var r = bal[f.properties.iso3];
      if (r && layer === 'share') return r.status === 'gap' ? 'url(#lm-hatch-map)' : dash.colors[0];
      if (r || f.properties.catalogue) return 'var(--cds-chart-muted)';
      return 'var(--color-bg)';
    };
    var opacity = function (f) {
      var r = bal[f.properties.iso3];
      if (r && layer === 'share') return r.status === 'gap' ? 1 : 0.2 + 0.8 * Math.min(1, r.share_pct / 50);
      if (r) return 0.55;
      if (f.properties.catalogue) return 0.35;
      return 1;
    };
    var tipCountry = function (ev, f) {
      lmTipShow(el, st.tip, ev, function (n) {
        var iso = f.properties.iso3, r = bal[iso], t = lt[iso];
        lmTipLine(n, f.properties.name, 'lm-tip-h');
        if (r) {
          if (r.status === 'gap') lmTipLine(n, 'None unaccounted in ' + r.period + ': ' + (LM_BUILT[iso] ? 'smelters need about ' + r.excess_pct + '% more lead than recorded supply.' : 'lead going out is ' + r.over_phrase + ' the lead recorded coming in.'), 'lm-tip-s');
          else lmTipLine(n, 'Unaccounted: ' + r.share_pct + '% of lead available for recycling (' + r.share_low_pct + '–' + r.share_high_pct + '%), ' + r.period + '.', 'lm-tip-s');
        } else if (f.properties.catalogue) {
          lmTipLine(n, 'In the catalogue; no lead balance yet.', 'lm-tip-s');
        }
        if (t) lmTipLine(n, 'Lead in ' + lmFmt(t.lead_in_kt, 'kt') + ' kt, out ' + lmFmt(t.lead_out_kt, 'kt') + ' kt (' + t.year + (t.missing ? '; ' + t.missing + ' of 8 figures not reported' : '') + ').', 'lm-tip-s');
        if (f.properties.catalogue) lmTipLine(n, layer === 'trade' ? 'Click to draw its battery trade partners' : 'Click for its figures and smelters', 'lm-tip-hint');
      }, st.h);
    };
    st.gc.selectAll('path').data(feats, function (f) { return f && f.id; }).join('path')
      .attr('d', path)
      .style('fill', fill)
      .style('fill-opacity', opacity)
      .style('stroke', function (f) { return f.properties.iso3 === selIso ? 'var(--color-fg)' : f.properties.catalogue ? 'var(--color-fg-muted)' : 'var(--cds-chart-axis)'; })
      .style('stroke-linejoin', 'round')
      .style('cursor', function (f) { return f.properties.catalogue ? 'pointer' : null; })
      .on('pointermove', tipCountry)
      .on('pointerleave', function () { st.tip.style('display', 'none'); })
      .on('click', function (ev, f) {
        if (!f.properties.catalogue) return;
        st.tip.style('display', 'none');
        lmSelect(f.properties.iso3, null, { zoom: 'country' });
      });
    st.gc.selectAll('path').filter(function (f) { return f.properties.iso3 === selIso; }).raise();

    // lead in and out (half-circles, area by tonnes of lead)
    var glyphs = [];
    if (layer === 'trade') {
      var vmax = d3.max(Object.keys(lt), function (iso) { return Math.max(lt[iso].lead_in, lt[iso].lead_out); }) || 1;
      var rmax = Math.max(16, Math.min(30, w / 28));
      Object.keys(lt).forEach(function (iso) {
        var f = feats.find(function (x) { return x.properties.iso3 === iso; });
        if (!f) return;
        var p = proj(d3.geoCentroid(f));
        glyphs.push({ iso: iso, x: p[0], y: p[1], t: lt[iso], name: f.properties.name,
          rin: rmax * Math.sqrt(lt[iso].lead_in / vmax), rout: rmax * Math.sqrt(lt[iso].lead_out / vmax) });
      });
    }
    var gg = st.gt.selectAll('g.lm-glyph').data(glyphs, function (d) { return d && d.iso; }).join('g').attr('class', 'lm-glyph');
    gg.selectAll('*').remove();
    gg.each(function (d) {
      var s = d3.select(this);
      s.append('path').attr('d', d3.arc()({ innerRadius: 0, outerRadius: Math.max(2, d.rin), startAngle: Math.PI, endAngle: 2 * Math.PI }))
        .style('fill', dash.colors[0]).style('fill-opacity', 0.9).style('stroke', 'var(--color-bg)').style('stroke-width', 1);
      s.append('path').attr('d', d3.arc()({ innerRadius: 0, outerRadius: Math.max(2, d.rout), startAngle: 0, endAngle: Math.PI }))
        .style('fill', dash.colors[1]).style('fill-opacity', 0.9).style('stroke', 'var(--color-bg)').style('stroke-width', 1);
      s.append('text').attr('class', 'lm-vl-out').attr('text-anchor', 'middle').attr('y', Math.max(d.rin, d.rout) + 13)
        .style('paint-order', 'stroke').style('stroke', 'var(--color-bg)').style('stroke-width', 3)
        .text('in ' + lmFmt(d.t.lead_in_kt, 'kt') + ' · out ' + lmFmt(d.t.lead_out_kt, 'kt') + ' kt');
      s.on('pointermove', function (ev) {
        lmTipShow(el, st.tip, ev, function (n) {
          var t = d.t;
          lmTipLine(n, d.name + ', ' + t.year + ', thousand tonnes of lead', 'lm-tip-h');
          lmTipLine(n, 'In: refined ' + lmFmt(t.in_refined_kt, 'kt') + ', spent batteries ' + lmFmt(t.in_spent_kt, 'kt') + ', scrap ' + lmFmt(t.in_scrap_kt, 'kt') + ', new batteries ' + lmFmt(t.in_new_kt, 'kt'), 'lm-tip-s');
          lmTipLine(n, 'Out: refined ' + lmFmt(t.out_refined_kt, 'kt') + ', spent batteries ' + lmFmt(t.out_spent_kt, 'kt') + ', scrap ' + lmFmt(t.out_scrap_kt, 'kt') + ', new batteries ' + lmFmt(t.out_new_kt, 'kt'), 'lm-tip-s');
          if (t.missing) lmTipLine(n, t.missing + ' of the 8 figures were not reported and count as zero.', 'lm-tip-hint');
        }, st.h);
      }).on('pointerleave', function () { st.tip.style('display', 'none'); });
    });

    // trade flows of the chosen country
    lmDrawFlows(st, proj, feats);

    // smelters as factory icons
    lmBuildSites(st);
    lmRescale(st);
    lmDrawSmelters(st, true);
    if (resized && selIso) lmZoomState(st, selIso, true);
  },
  unmount: function () { window.lmMap = null; }
});

/* ---------- Legend swatches ---------- */
dash.draw('sw', function (el) {
  el.replaceChildren();
  var kind = el.getAttribute('data-kind');
  if (kind === 'cap25' || kind === 'cap100' || kind === 'cap250') {
    var s = lmIconSize({ cap25: 25000, cap100: 100000, cap250: LM_CAPREF }[kind]);
    var box = Math.ceil(s) + 2;
    var sv0 = d3.select(el).append('svg').attr('width', box).attr('height', box).attr('aria-hidden', 'true');
    lmFactory(sv0.append('g').attr('transform', 'translate(' + box / 2 + ',' + box / 2 + ')'), s, lmStyle('A'));
    return;
  }
  var sv = d3.select(el).append('svg').attr('width', 22).attr('height', 16).attr('aria-hidden', 'true');
  if (kind === 'share') {
    [0.2, 0.52, 0.84, 1].forEach(function (o, i) {
      sv.append('rect').attr('x', i * 5.5).attr('y', 2).attr('width', 5.5).attr('height', 12).style('fill', dash.colors[0]).style('fill-opacity', o);
    });
  } else if (kind === 'gap') {
    var p = sv.append('defs').append('pattern').attr('id', 'lm-hatch-legend').attr('patternUnits', 'userSpaceOnUse')
      .attr('width', 6).attr('height', 6).attr('patternTransform', 'rotate(45)');
    p.append('rect').attr('width', 6).attr('height', 6).style('fill', dash.colors[1]).style('fill-opacity', 0.22);
    p.append('line').attr('x1', 1).attr('y1', 0).attr('x2', 1).attr('y2', 6).style('stroke', dash.colors[1]).style('stroke-width', 2);
    sv.append('rect').attr('x', 1).attr('y', 2).attr('width', 20).attr('height', 12).style('fill', 'url(#lm-hatch-legend)');
  } else if (kind === 'trade') {
    sv.append('path').attr('transform', 'translate(11,8)').attr('d', d3.arc()({ innerRadius: 0, outerRadius: 6, startAngle: Math.PI, endAngle: 2 * Math.PI })).style('fill', dash.colors[0]);
    sv.append('path').attr('transform', 'translate(11,8)').attr('d', d3.arc()({ innerRadius: 0, outerRadius: 6, startAngle: 0, endAngle: Math.PI })).style('fill', dash.colors[1]);
  } else if (kind === 'flowin' || kind === 'flowout' || kind === 'flowdash') {
    sv.append('path').attr('d', 'M1,12 Q11,0 21,12').style('fill', 'none')
      .style('stroke', kind === 'flowin' ? dash.colors[0] : kind === 'flowout' ? dash.colors[1] : 'var(--color-fg-muted)')
      .style('stroke-width', 2.5).style('stroke-dasharray', kind === 'flowdash' ? '4 3' : null);
  } else if (kind === 'cat') {
    sv.append('rect').attr('x', 1).attr('y', 2).attr('width', 20).attr('height', 12)
      .style('fill', 'var(--cds-chart-muted)').style('fill-opacity', 0.35).style('stroke', 'var(--color-fg-muted)');
  } else {
    lmFactory(sv.append('g').attr('transform', 'translate(11,8)'), 15, lmStyle(kind));
  }
});
