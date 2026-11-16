// Stand-in for the dashboard runtime the page was written for: loads the datasets from data/, runs the
// declared calculations once the data are in, and redraws every registered drawing.
(function () {
  'use strict';
  var NAMES = ['trade', 'inputs', 'smelters', 'countries', 'flows', 'world'];
  var VERSION = '90f490ed4f';
  var DATA = {}, calcs = {}, draws = {}, made = new Map(), od = [], memo = {}, state = 'loading';
  var dash = {
    colors: ['var(--c0)', 'var(--c1)', 'var(--c2)', 'var(--c3)'],
    calc: function (id, def) { calcs[id] = def; },
    data: function (id) {
      if (state === 'error') return { status: 'error', data: null };
      if (state !== 'ok') return { status: 'loading', data: null };
      if (DATA[id]) return { status: 'ok', data: DATA[id] };
      if (calcs[id]) {
        if (!memo[id]) memo[id] = calcs[id].fn.apply(null, calcs[id].inputs.map(function (i) { return dash.data(i).data; }));
        return { status: 'ok', data: memo[id] };
      }
      return { status: 'missing', data: null };
    },
    draw: function (name, f) {
      if (f !== undefined) { draws[name] = f; return; }
      var g = draws[name];
      if (!g) return;
      document.querySelectorAll('[data-draw="' + name + '"]').forEach(function (el) {
        if (el.closest('[hidden]')) return;
        try {
          if (typeof g === 'function') g(el);
          else { if (!made.has(el)) { el.replaceChildren(); made.set(el, g.mount(el)); } g.update(el, made.get(el)); }
        } catch (e) { console.error('drawing ' + name, e); }
      });
    },
    onData: function (fn) { od.push(fn); },
  };
  window.dash = dash;
  function boot() {
    od.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } });
    Object.keys(draws).forEach(function (n) { dash.draw(n); });
    if (state === 'error') {
      var m = document.getElementById('site-load-error');
      if (m) m.hidden = false;
    }
  }
  var ready = new Promise(function (res) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', res); else res();
  });
  Promise.all(NAMES.map(function (n) {
    return fetch('data/' + n + '.json?v=' + VERSION).then(function (r) {
      if (!r.ok) throw new Error(n + '.json: HTTP ' + r.status);
      return r.json();
    });
  })).then(function (list) {
    list.forEach(function (d, i) { DATA[NAMES[i]] = NAMES[i] === 'world' ? d : d.rows; });
    state = 'ok';
  }).catch(function (e) {
    console.error('Failed to load the data', e);
    state = 'error';
  }).then(function () { return ready; }).then(boot);
})();
