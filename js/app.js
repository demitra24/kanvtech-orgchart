/* ==========================================================================
   KanvTech · Organization Chart — app.js
   Plain JavaScript. No frameworks, no build step, no backend.
   ========================================================================== */

(() => {
  'use strict';

  if (typeof ORG_DATA === 'undefined') {
    document.body.innerHTML = '<p style="padding:40px;font-family:sans-serif">Data file js/data.js could not be loaded.</p>';
    return;
  }

  /* ---------------- helpers ---------------- */

  const $ = (sel) => document.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
  const initials = (name) => {
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    const a = parts.length ? parts[0][0] : '?';
    const b = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (a + b).toUpperCase();
  };
  const debounce = (fn, ms) => {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  };
  const fmtDate = () => new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  // normalized text for searching: lowercase + collapsed spaces + trimmed
  const norm = (s) => String(s).toLowerCase().replace(/\s+/g, ' ').trim();

  /* ---------------- constants & data index ---------------- */

  const PALETTE = [
    '#175C4A', // 0 · root branch (organization head)
    '#2F6B5E', '#7A5C43', '#43707B', '#8A6D9C', '#A87932',
    '#5E7D46', '#9C5F54', '#64737F', '#86766B', '#4E7D6B',
    '#97823F', '#756289', '#3F6D64'
  ];
  const col = (e) => PALETTE[e.branchIdx % PALETTE.length];

  const EMP = ORG_DATA.employees;
  const META = ORG_DATA.meta;

  /* ---- Manage Data · draft layer -------------------------------------------
     Manual edits (Manage Data panel) are kept in localStorage as a full
     snapshot ("draft") so they survive a refresh. Exporting data.js from the
     panel makes them permanent for everyone. -------------------------------- */
  const DRAFT_KEY = 'kanvtech_draft_v1';
  const ORIG_SNAPSHOT = JSON.parse(JSON.stringify({
    meta: ORG_DATA.meta, branches: ORG_DATA.branches, employees: ORG_DATA.employees,
  }));
  const ORIG_IDS = new Set(ORG_DATA.employees.map((e) => e.id));
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) {
      const snap = JSON.parse(raw);
      if (snap && Array.isArray(snap.employees) && snap.employees.length &&
          snap.employees[0].id && snap.employees[0].headId && snap.employees[0].level) {
        EMP.length = 0;
        EMP.push(...snap.employees);
        if (Array.isArray(snap.branches)) ORG_DATA.branches = snap.branches;
        Object.assign(META, snap.meta || {});
      }
    }
  } catch (err) { console.warn('Draft could not be restored:', err); }

  const byId = new Map(EMP.map((e) => [e.id, e]));
  const childrenOf = new Map();
  EMP.forEach((e) => {
    const p = e.headId === e.id ? null : e.headId;
    if (!childrenOf.has(p)) childrenOf.set(p, []);
    childrenOf.get(p).push(e);
  });
  let root = EMP.find((e) => e.headId === e.id) || EMP[0];

  /* ---------------- state ---------------- */

  const state = {
    view: 'tree',
    query: '',
    branch: '',
    level: '',
    sortKey: 'level',
    sortDir: 'asc',
    zoom: 1,
    expanded: new Set([root.id]),
    currentId: null,
    lastOpener: null,
  };
  let lastVisible = null; // Set of ids passing filters, or null when unfiltered

  /* ---------------- DOM refs ---------------- */

  const els = {
    body: document.body,
    orgTree: $('#orgTree'),
    treeScaler: $('#treeScaler'),
    treeViewport: $('#treeViewport'),
    treeEmpty: $('#treeEmpty'),
    stats: $('#statsStrip'),
    branchFilter: $('#branchFilter'),
    levelFilter: $('#levelFilter'),
    showingNote: $('#showingNote'),
    clearFilters: $('#clearFiltersBtn'),
    search: $('#globalSearch'),
    searchCount: $('#searchCount'),
    searchResults: $('#searchResults'),
    pickModal: $('#pickModal'),
    pickSearch: $('#pickSearch'),
    pickList: $('#pickList'),
    pickCount: $('#pickCount'),
    zoomLevel: $('#zoomLevel'),
    dirBody: $('#dirBody'),
    dirCount: $('#dirCount'),
    treeView: $('#treeView'),
    directoryView: $('#directoryView'),
    empModal: $('#empModal'),
    empModalHead: $('#empModalHead'),
    empDetails: $('#empDetails'),
    empChain: $('#empChain'),
    empReports: $('#empReports'),
    empReportsCount: $('#empReportsCount'),
    empReportsSection: $('#empReportsSection'),
    aboutModal: $('#aboutModal'),
    printProfile: $('#printProfile'),
    printPreview: $('#printPreview'),
    pvPaper: $('#pvPaper'),
    printMenuBtn: $('#printMenuBtn'),
    printMenuPop: $('#printMenuPop'),
    mobileMenu: $('#mobileMenu'),
    burgerBtn: $('#burgerBtn'),
    adminModal: $('#adminModal'),
    adminStatus: $('#adminStatus'),
    adminSearch: $('#adminSearch'),
    adminList: $('#adminList'),
    admForm: $('#adminForm'),
    adminFileInput: $('#adminFileInput'),
    admFormTitle: $('#admFormTitle'),
    admCode: $('#admCode'),
    admName: $('#admName'),
    admLevel: $('#admLevel'),
    admHead: $('#admHead'),
    admBranch: $('#admBranch'),
    admHint: $('#admHint'),
    admDeleteBtn: $('#admDeleteBtn'),
    adminDiscardBtn: $('#adminDiscardBtn'),
    adminNote: $('#adminNote'),
  };

  /* ==========================================================================
     TREE RENDERING
     ========================================================================== */

  function buildTree() {
    els.orgTree.appendChild(buildNode(root));
  }

  function buildNode(e) {
    const li = document.createElement('li');
    li.className = 'node' + (e.headId === e.id ? ' node-root' : '');
    li.dataset.id = e.id;
    li.style.setProperty('--bc', col(e));

    const card = document.createElement('div');
    card.className = 'node-card';
    card.tabIndex = 0;
    card.setAttribute('role', 'treeitem');
    const kids = (childrenOf.get(e.id) || []).length;
    card.setAttribute('aria-label',
      `${e.name}, code ${e.id}, level ${e.level}${kids ? `, ${kids} direct reports` : ''}`);

    const av = document.createElement('span');
    av.className = 'avatar';
    av.setAttribute('aria-hidden', 'true');
    av.textContent = initials(e.name);

    const main = document.createElement('span');
    main.className = 'card-main';

    const name = document.createElement('span');
    name.className = 'card-name';
    name.textContent = e.name;

    const chips = document.createElement('span');
    chips.className = 'card-chips';
    chips.innerHTML =
      `<span class="chip chip-code">${esc(e.id)}</span>` +
      `<span class="chip chip-level">L${e.level}</span>`;

    main.appendChild(name);
    if (e.headId === e.id) {
      const sub = document.createElement('span');
      sub.className = 'card-sub';
      sub.textContent = 'Organization Head';
      main.appendChild(sub);
    }
    main.appendChild(chips);

    card.appendChild(av);
    card.appendChild(main);

    if (kids) {
      const t = document.createElement('button');
      t.type = 'button';
      t.className = 'node-toggle';
      t.textContent = '+' + kids;
      t.setAttribute('aria-expanded', 'false');
      t.setAttribute('aria-label', `${kids} direct reports — click to expand or collapse`);
      t.addEventListener('click', (ev) => {
        ev.stopPropagation();
        toggleExpand(e.id);
      });
      card.appendChild(t);
    }

    card.addEventListener('click', () => openEmployee(e.id, card));
    card.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openEmployee(e.id, card); }
    });

    li.appendChild(card);

    if (kids) {
      const ul = document.createElement('ul');
      (childrenOf.get(e.id) || []).forEach((child) => ul.appendChild(buildNode(child)));
      li.appendChild(ul);
    }
    return li;
  }

  function toggleExpand(id) {
    if (state.expanded.has(id)) state.expanded.delete(id);
    else state.expanded.add(id);
    syncExpansion();
  }

  function ancestorsOf(id) {
    const out = new Set();
    let cur = byId.get(id);
    while (cur && cur.headId !== cur.id) {
      out.add(cur.headId);
      cur = byId.get(cur.headId);
    }
    return out;
  }

  function syncExpansion() {
    const forced = new Set();
    if (lastVisible) {
      lastVisible.forEach((id) => ancestorsOf(id).forEach((a) => forced.add(a)));
    }
    els.orgTree.querySelectorAll('li.node').forEach((li) => {
      const id = li.dataset.id;
      const kids = (childrenOf.get(id) || []).length;
      if (!kids) return;
      const open = state.expanded.has(id) || forced.has(id);
      li.classList.toggle('collapsed', !open);
      const t = li.querySelector(':scope > .node-card > .node-toggle');
      if (t) {
        t.textContent = open ? '\u2212' : '+' + kids;
        t.setAttribute('aria-expanded', String(open));
      }
    });
  }

  /* ==========================================================================
     SEARCH & FILTERS
     ========================================================================== */

  function computeVisible() {
    const q = norm(state.query);
    if (!q && !state.branch && !state.level) return null;
    const out = new Set();
    for (const e of EMP) {
      const qOk = !q || norm(e.name).includes(q) || norm(e.id).includes(q);
      const bOk = !state.branch || e.branchId === state.branch;
      const lOk = !state.level || String(e.level) === state.level;
      if (qOk && bOk && lOk) out.add(e.id);
    }
    return out;
  }

  function applyFilters() {
    lastVisible = computeVisible();
    const searching = !!lastVisible;
    const q = norm(state.query);

    els.orgTree.querySelectorAll('li.node').forEach((li) => {
      const id = li.dataset.id;
      const pass = !searching || lastVisible.has(id);
      li.classList.toggle('is-dim', !pass);
      li.classList.toggle('is-match', !!pass && !!q);
    });

    highlightNames(q);
    syncExpansion();

    const n = searching ? lastVisible.size : EMP.length;
    els.showingNote.textContent = `${n} of ${EMP.length} employees`;
    els.showingNote.classList.toggle('filtered', searching);
    els.clearFilters.hidden = !searching;

    if (q) {
      els.searchCount.hidden = false;
      els.searchCount.textContent = `${n} match${n === 1 ? '' : 'es'}`;
    } else {
      els.searchCount.hidden = true;
    }

    els.treeEmpty.hidden = !(searching && lastVisible.size === 0);
    renderDirectory();

    // live results panel + auto-reveal of the first match in the tree
    renderSearchPanel(q, searching ? lastVisible : null);
    if (q && state.view === 'tree' && searching && lastVisible.size) {
      const firstId = firstRankedMatch(q, lastVisible);
      if (firstId) flashCard(firstId);
    }
  }

  function highlightNames(q) {
    els.orgTree.querySelectorAll('.card-name').forEach((el) => {
      const li = el.closest('li.node');
      const e = byId.get(li && li.dataset.id);
      if (!e) return;
      if (q) {
        const i = e.name.toLowerCase().indexOf(q);
        if (i >= 0) {
          el.innerHTML =
            esc(e.name.slice(0, i)) + '<mark>' + esc(e.name.slice(i, i + q.length)) + '</mark>' +
            esc(e.name.slice(i + q.length));
          return;
        }
      }
      if (el.textContent !== e.name) el.textContent = e.name;
    });
  }

  function clearAllFilters() {
    state.query = '';
    state.branch = '';
    state.level = '';
    els.search.value = '';
    els.branchFilter.value = '';
    els.levelFilter.value = '';
    applyFilters();
  }

  /* ---- ranked search engine: partial name / partial code, best matches first ---- */

  function matchEmployees(rawQ) {
    const q = norm(rawQ);
    if (!q) return [];
    const scored = [];
    for (const e of EMP) {
      const name = norm(e.name), id = norm(e.id);
      let score = -1;
      if (id === q) score = 0;                 // exact code → top
      else if (name.startsWith(q)) score = 1;  // name starts with query
      else if (name.includes(q)) score = 2;    // name contains query anywhere
      else if (id.includes(q)) score = 3;      // code contains query
      if (score >= 0) scored.push([score, e]);
    }
    scored.sort((a, b) => a[0] - b[0] || a[1].name.localeCompare(b[1].name));
    return scored.map(([, e]) => e);
  }

  function firstRankedMatch(q, pool) {
    for (const e of matchEmployees(q)) if (!pool || pool.has(e.id)) return e.id;
    return null;
  }

  function hlName(name, q) {
    if (!q) return esc(name);
    const i = name.toLowerCase().indexOf(q);
    if (i < 0) return esc(name);
    return esc(name.slice(0, i)) + '<mark>' + esc(name.slice(i, i + q.length)) + '</mark>' +
      esc(name.slice(i + q.length));
  }

  /* ---- live results panel under the search bar ("the slide") ---- */

  const ICO_LOCATE = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/></svg>';
  const ICO_PRINT = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="7"/></svg>';

  function renderSearchPanel(q, pool) {
    const box = els.searchResults;
    if (!q) { box.hidden = true; box.innerHTML = ''; return; }
    const list = matchEmployees(q).filter((e) => !pool || pool.has(e.id));
    if (!list.length) {
      box.innerHTML = '<div class="sr-empty">No employee matches \u201C' + esc(q) +
        '\u201D — try a shorter part of the name, or the code.</div>';
      box.hidden = false;
      return;
    }
    const head = '<div class="sr-head">' + list.length + ' match' + (list.length === 1 ? '' : 'es') +
      ' \u00B7 click a row to open the profile</div>';
    box.innerHTML = head + list.map((e) =>
      '<div class="sr-item" data-id="' + esc(e.id) + '" role="button" tabindex="0">' +
        '<span class="avatar mini" style="--bc:' + col(e) + '">' + initials(e.name) + '</span>' +
        '<span class="sr-main">' +
          '<span class="sr-name">' + hlName(e.name, q) + '</span>' +
          '<span class="sr-meta">' + esc(e.id) + ' \u00B7 Level ' + e.level + ' \u00B7 ' + esc(e.branchName) + '</span>' +
        '</span>' +
        '<span class="sr-actions">' +
          '<button type="button" class="sr-btn" data-locate="' + esc(e.id) + '" title="Show in chart" aria-label="Show ' + esc(e.name) + ' in chart">' + ICO_LOCATE + '</button>' +
          '<button type="button" class="sr-btn sr-btn-print" data-printid="' + esc(e.id) + '" title="Print profile" aria-label="Print profile of ' + esc(e.name) + '">' + ICO_PRINT + '</button>' +
        '</span>' +
      '</div>').join('');
    box.hidden = false;
  }

  /* ---- reveal a person inside the tree (expand ancestors + scroll + flash) ---- */

  function flashCard(id) {
    requestAnimationFrame(() => {
      const li = els.orgTree.querySelector('li.node[data-id="' + CSS.escape(id) + '"]');
      if (!li) return;
      li.classList.add('is-flash');
      li.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      setTimeout(() => li.classList.remove('is-flash'), 2400);
    });
  }

  function revealInTree(id) {
    els.searchResults.hidden = true;
    if (state.view !== 'tree') switchView('tree');
    ancestorsOf(id).forEach((a) => state.expanded.add(a));
    syncExpansion();
    flashCard(id);
  }

  /* ==========================================================================
     DIRECTORY TABLE
     ========================================================================== */

  function filteredSorted() {
    const rows = lastVisible ? EMP.filter((e) => lastVisible.has(e.id)) : EMP.slice();
    const k = state.sortKey;
    const dir = state.sortDir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      const va = a[k], vb = b[k];
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      const sa = String(va).toLowerCase(), sb = String(vb).toLowerCase();
      return (sa < sb ? -1 : sa > sb ? 1 : 0) * dir;
    });
    return rows;
  }

  function renderDirectory() {
    const rows = filteredSorted();
    els.dirBody.innerHTML = rows.map((e) => {
      const c = col(e);
      const head = e.headId === e.id
        ? '<span style="color:var(--ink-3)">—</span>'
        : `${esc(e.headName)} <span style="color:var(--ink-3)">(${esc(e.headId)})</span>`;
      return `<tr data-id="${esc(e.id)}">` +
        `<td class="td-code">${esc(e.id)}</td>` +
        `<td class="td-name"><span class="avatar mini" style="--bc:${c}">${initials(e.name)}</span>${esc(e.name)}</td>` +
        `<td>${head}</td>` +
        `<td><span class="chip chip-level">L${e.level}</span></td>` +
        `<td><span class="b-dot" style="background:${c}"></span>${esc(e.branchName)}</td>` +
        `<td>${e.directReports || '<span style="color:var(--ink-3)">0</span>'}</td>` +
        `<td><span class="num-strong">${e.teamSize || '0'}</span></td>` +
        `</tr>`;
    }).join('');
    els.dirCount.textContent = `Showing ${rows.length} of ${EMP.length} employees · click any row for the full profile`;
    document.querySelectorAll('#dirTable thead th').forEach((th) => {
      th.classList.toggle('sorted-asc', th.dataset.sort === state.sortKey && state.sortDir === 'asc');
      th.classList.toggle('sorted-desc', th.dataset.sort === state.sortKey && state.sortDir === 'desc');
    });
  }

  /* ==========================================================================
     EMPLOYEE MODAL
     ========================================================================== */

  function openEmployee(id, opener) {
    const e = byId.get(id);
    if (!e) return;
    state.currentId = id;
    state.lastOpener = opener || state.lastOpener;
    const c = col(e);
    const isRoot = e.headId === e.id;

    els.empModalHead.innerHTML =
      `<span class="avatar lg" style="--bc:${c};border-radius:16px">${initials(e.name)}</span>` +
      `<div><h3 class="m-name" id="empModalName">${esc(e.name)}</h3>` +
      `<div class="m-chips">` +
      `<span class="chip chip-code">${esc(e.id)}</span>` +
      `<span class="chip chip-level">Level ${e.level}</span>` +
      (isRoot
        ? '<span class="chip" style="background:var(--green-tint);color:var(--green-deep)">Organization Head</span>'
        : `<span class="chip" style="background:var(--surface-2);border:1px solid var(--line);color:var(--ink-2)">${esc(e.branchName)}'s branch</span>`) +
      `</div></div>`;

    els.empDetails.innerHTML = `
      <div><dt>Employee code</dt><dd>${esc(e.id)}</dd></div>
      <div><dt>Level</dt><dd>Level ${e.level}</dd></div>
      <div><dt>Reports to</dt><dd>${isRoot
        ? '<span style="color:var(--ink-3)">— Top of organization</span>'
        : `<span class="linkish" data-open="${esc(e.headId)}" role="button" tabindex="0">${esc(e.headName)} (${esc(e.headId)})</span>`}</dd></div>
      <div><dt>Branch</dt><dd><span class="b-dot" style="background:${c};display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:8px"></span>${esc(e.branchName)} (${esc(e.branchId)})</dd></div>
      <div><dt>Direct reports</dt><dd>${e.directReports}</dd></div>
      <div><dt>Total team size</dt><dd>${e.teamSize}${e.teamSize ? ' <span style="color:var(--ink-3);font-weight:600;font-size:12px">incl. sub-teams</span>' : ''}</dd></div>`;

    // reporting chain: top of org → … → this person
    const chainHTML = e.chain.map((p) =>
      `<li><button type="button" class="chain-link" data-open="${esc(p.id)}" title="Open profile">${esc(p.name)}</button></li>`
    ).join('');
    els.empChain.innerHTML = chainHTML +
      `<li><span class="chain-self">${esc(e.name)}</span></li>`;

    // direct reports
    const kids = childrenOf.get(e.id) || [];
    els.empReportsSection.hidden = kids.length === 0;
    els.empReportsCount.textContent = kids.length;
    els.empReports.innerHTML = kids.map((k2) =>
      `<li><button type="button" data-open="${esc(k2.id)}">` +
      `<span class="avatar mini" style="--bc:${col(k2)}">${initials(k2.name)}</span>` +
      `<span><span class="r-name">${esc(k2.name)}</span><br><span class="r-code">${esc(k2.id)} · L${k2.level}</span></span>` +
      `</button></li>`).join('');

    els.empModal.hidden = false;
    $('#empModalClose').focus();
  }

  function closeEmployeeModal() {
    els.empModal.hidden = true;
    if (state.lastOpener && document.contains(state.lastOpener)) state.lastOpener.focus();
    state.lastOpener = null;
  }

  /* ==========================================================================
     PRINTING — real printer pipeline
     --------------------------------------------------------------------------
     How a website prints on real paper: the page first mounts a dedicated
     print layout (a body.print-* class + an @page rule), then calls
     window.print(), which opens the browser's native print dialog. The user
     picks their PHYSICAL printer under "Destination" and the sheet is
     printed on paper. That dialog is the browser's security gate between
     websites and printers — the same flow used by ticket-booking and
     boarding-pass sites.
     ========================================================================== */

  let activePrint = null;   // { mode, pageStyle, onCleanup } while a print layout is mounted
  let pendingPrint = null;  // print mode waiting behind the print-preview modal

  function enterPrintMode(mode, onCleanup) {
    exitPrintMode();
    els.body.classList.add('print-' + mode);
    const pageStyle = document.createElement('style');
    pageStyle.textContent = (mode === 'chart')
      ? '@page{size:A4 landscape;margin:8mm}'
      : '@page{size:A4 portrait;margin:14mm}';
    document.head.appendChild(pageStyle);
    activePrint = { mode, pageStyle, onCleanup };
  }

  function exitPrintMode() {
    if (!activePrint) return;
    els.body.classList.remove('print-' + activePrint.mode);
    activePrint.pageStyle.remove();
    if (activePrint.onCleanup) activePrint.onCleanup();
    activePrint = null;
  }

  function printWith(mode, onCleanup) {
    enterPrintMode(mode, onCleanup);
    window.print(); // opens the browser print dialog → user selects the real printer
    setTimeout(exitPrintMode, 8000); // safety net for browsers that never fire afterprint
  }

  // Ctrl+P / File→Print pressed directly: mount a professional layout instead
  // of dumping the raw page. If the print preview is open, print that sheet.
  window.addEventListener('beforeprint', () => {
    if (activePrint) return;
    if (pendingPrint === 'profile') { enterPrintMode('profile'); return; }
    if (state.view === 'directory') { enterPrintMode('directory'); return; }
    mountChartPrint();
  });
  window.addEventListener('afterprint', exitPrintMode);

  /* ---- employee profile sheet (one markup, used by preview AND printer) ---- */

  function buildProfileSheet(e) {
    const isRoot = e.headId === e.id;
    const chainLine = e.chain.map((p) => esc(p.name))
      .concat([`<strong>${esc(e.name)}</strong>`])
      .join('<span class="sep">›</span>');
    const kids = childrenOf.get(e.id) || [];

    return `
      <div class="pp-head">
        <div class="pp-brand"><span class="pp-mark">K</span>
          <div><strong>KanvTech</strong><small>Organization Directory</small></div>
        </div>
        <div class="pp-doc">Employee Profile<small>Printed ${fmtDate()}</small></div>
      </div>
      <div class="pp-id">
        <div class="pp-avatar">${initials(e.name)}</div>
        <div><h2>${esc(e.name)}</h2>
          <p class="pp-sub">Employee Code ${esc(e.id)} · Level ${e.level} · ${isRoot ? 'Organization Head' : `Branch of ${esc(e.branchName)}`}</p>
        </div>
      </div>
      <table class="pp-table"><tbody>
        <tr><th>Employee code</th><td>${esc(e.id)}</td><th>Level</th><td>${e.level}</td></tr>
        <tr><th>Reports to</th><td>${isRoot ? '— (top of organization)' : `${esc(e.headName)} (${esc(e.headId)})`}</td>
            <th>Branch</th><td>${esc(e.branchName)} (${esc(e.branchId)})</td></tr>
        <tr><th>Direct reports</th><td>${e.directReports}</td>
            <th>Total team size</th><td>${e.teamSize}${e.teamSize ? ' (incl. sub-teams)' : ' (individual contributor)'}</td></tr>
      </tbody></table>
      <div class="pp-block"><h4>Reporting chain</h4><p class="pp-chain-line">${chainLine}</p></div>
      ${kids.length ? `<div class="pp-block"><h4>Direct reports (${kids.length})</h4>
        <ol class="pp-reports">${kids.map((k2) =>
          `<li>${esc(k2.name)} <span>· ${esc(k2.id)}</span></li>`).join('')}</ol></div>` : ''}
      <div class="pp-foot"><span>KanvTech Organization Chart · Source: ${esc(META.sourceFile)}</span>
        <span>Data generated ${esc(META.generated)}</span></div>`;
  }

  function printProfile(id) {
    const e = byId.get(id);
    if (!e) return;
    const sheet = buildProfileSheet(e);
    els.printProfile.innerHTML = sheet; // what the printer will receive
    els.pvPaper.innerHTML = sheet;      // what the user previews on screen
    pendingPrint = 'profile';
    els.printPreview.hidden = false;
    $('#pvConfirmBtn').focus();
  }

  function closePrintPreview() {
    els.printPreview.hidden = true;
    els.pvPaper.innerHTML = '';
    pendingPrint = null;
  }

  /* ==========================================================================
     ONE-PAGE CHART PRINT — the whole organization on a single A4 landscape
     sheet, big enough to actually read.
     --------------------------------------------------------------------------
     Why not just shrink the on-screen tree? A left-to-right tree of 125
     people stacks ~95 leaf cards into ONE column (~2,000px tall). Squeezed
     onto one page that is a ~12% scale — letters 1pt tall, invisible.
     Instead the tree is WRAPPED INTO BALANCED COLUMNS: a root banner on
     top, then each column holds complete branch sub-trees (boxes + elbow
     connector lines, one employee per compact row). Big branches that
     would overflow a column are split at the next level, repeating the
     head card with a "cont." tag so the structure stays obvious.
     125 people / 5 columns = ~27 rows per column ≈ 8pt type — readable.
     ========================================================================== */

  const PT_ROW_BUDGET = 27;   // max rows per printed column (tuned for A4 landscape)

  function ptSize(e, memo) {  // people in this subtree, including e itself
    if (memo.has(e.id)) return memo.get(e.id);
    const n = (childrenOf.get(e.id) || []).reduce((s, k) => s + ptSize(k, memo), 1);
    memo.set(e.id, n);
    return n;
  }

  /* break one (possibly huge) branch into column-sized parts, each rendered
     under the branch head card; parts after the first get a "cont." tag */
  function ptPushParts(head, kidsList, memo, out) {
    let cur = [], rows = 0, first = true;
    const flush = () => {
      if (!cur.length) return;
      out.push({ head, kids: cur, rows: rows + 1, cont: !first });
      first = false; cur = []; rows = 0;
    };
    kidsList.forEach((k) => {
      const s = ptSize(k, memo);
      if (s > PT_ROW_BUDGET - 1) { flush(); ptPushParts(k, childrenOf.get(k.id) || [], memo, out); return; }
      if (rows + s > PT_ROW_BUDGET - 1 && cur.length) flush();
      cur.push(k); rows += s;
    });
    flush();
  }

  function ptCard(e, cls) {
    const d = document.createElement('div');
    d.className = 'pt-card' + (cls ? ' ' + cls : '');
    d.style.setProperty('--bc', col(e));
    const n = document.createElement('span');
    n.className = 'pt-name'; n.textContent = e.name;
    const c = document.createElement('span');
    c.className = 'pt-code'; c.textContent = e.id;
    d.append(n, c);
    return d;
  }

  function ptLi(e) {  // one employee = one row; managers bold with branch-color bar
    const li = document.createElement('li');
    li.className = 'pt-li';
    li.appendChild(ptCard(e, (childrenOf.get(e.id) || []).length ? 'pt-mgr' : ''));
    const ks = childrenOf.get(e.id) || [];
    if (ks.length) {
      const ul = document.createElement('ul');
      ul.className = 'pt-ul';
      ks.forEach((k) => ul.appendChild(ptLi(k)));
      li.appendChild(ul);
    }
    return li;
  }

  function ptBranchPart(part) {
    const b = document.createElement('div');
    b.className = 'pt-branch';
    const hc = ptCard(part.head, 'pt-head-card');
    if (part.cont) {
      const t = document.createElement('span');
      t.className = 'pt-cont'; t.textContent = 'cont.';
      hc.appendChild(t);
    }
    b.appendChild(hc);
    const ul = document.createElement('ul');
    ul.className = 'pt-ul';
    part.kids.forEach((k) => ul.appendChild(ptLi(k)));
    b.appendChild(ul);
    return b;
  }

  function buildPrintChart() {
    const root = EMP.find((x) => x.headId === x.id) || EMP[0];
    const memo = new Map();
    const parts = [];
    (childrenOf.get(root.id) || []).forEach((h) => {
      const total = ptSize(h, memo);
      if (total <= PT_ROW_BUDGET) {
        parts.push({ head: h, kids: childrenOf.get(h.id) || [], rows: total, cont: false });
      } else {
        ptPushParts(h, childrenOf.get(h.id) || [], memo, parts);
      }
    });

    /* balance parts across columns so every column stays within budget */
    const totalRows = parts.reduce((s, p) => s + p.rows, 0);
    const nCols = Math.max(3, Math.min(6, Math.ceil(totalRows / PT_ROW_BUDGET)));
    const cols = Array.from({ length: nCols }, () => ({ rows: 0, parts: [] }));
    parts.sort((a, b) => b.rows - a.rows);
    parts.forEach((p) => {
      const c = cols.reduce((m, x) => (x.rows < m.rows ? x : m), cols[0]);
      c.rows += p.rows; c.parts.push(p);
    });

    const host = document.createElement('div');
    host.className = 'pt-host';
    const tree = document.createElement('div');
    tree.className = 'pt-tree';

    const top = document.createElement('div');
    top.className = 'pt-top';
    top.innerHTML =
      '<div class="pt-root-card"><span class="pt-root-mark">K</span>' +
      '<span class="pt-root-txt"><strong>' + esc(root.name) + '</strong>' +
      '<small>' + esc(root.id) + ' \u00B7 Organization Head \u00B7 ' + EMP.length + ' employees</small></span></div>' +
      '<div class="pt-note">' + EMP.length + ' employees \u00B7 ' + META.branches + ' branches \u00B7 Levels 1\u2013' + META.levels +
      '<br>Full organization on one page \u00B7 printed ' + fmtDate() + '</div>';
    tree.appendChild(top);

    const colsEl = document.createElement('div');
    colsEl.className = 'pt-cols';
    cols.forEach((c) => {
      const colEl = document.createElement('div');
      colEl.className = 'pt-col';
      c.parts.forEach((p) => colEl.appendChild(ptBranchPart(p)));
      colsEl.appendChild(colEl);
    });
    tree.appendChild(colsEl);
    host.appendChild(tree);
    return host;
  }

  function mountChartPrint() {
    const host = buildPrintChart();
    document.body.appendChild(host);
    enterPrintMode('chart', () => host.remove());
    /* measure the natural size and scale to one A4 landscape page
       (≈1060 × 730 CSS px usable) — with balanced columns this lands at 1.0 */
    requestAnimationFrame(() => {
      const t = host.firstChild;
      if (!t) return;
      const fit = Math.min(1, 1040 / t.scrollWidth, 700 / t.scrollHeight);
      host.style.setProperty('--print-fit', fit.toFixed(4));
    });
  }

  function printChart() {
    if (state.view !== 'tree') switchView('tree');
    mountChartPrint();
    // give the browser one frame to lay out the sheet before it snapshots
    requestAnimationFrame(() => setTimeout(() => window.print(), 80));
    setTimeout(() => { if (activePrint && activePrint.mode === 'chart') exitPrintMode(); }, 20000);
  }

  function printDirectory() {
    if (state.view !== 'directory') switchView('directory');
    printWith('directory');
  }

  /* ---- print picker: search + choose any employee, then open the preview ---- */

  function openPickModal() {
    els.pickSearch.value = '';
    renderPickList('');
    els.pickModal.hidden = false;
    els.pickSearch.focus();
  }

  function closePickModal() {
    els.pickModal.hidden = true;
  }

  function renderPickList(rawQ) {
    const q = norm(rawQ);
    const list = q ? matchEmployees(q) : EMP.slice().sort((a, b) => a.name.localeCompare(b.name));
    els.pickCount.textContent = q
      ? list.length + ' match' + (list.length === 1 ? '' : 'es')
      : 'All ' + EMP.length + ' employees — click one to open its print preview';
    els.pickList.innerHTML = list.length ? list.map((e) =>
      '<li><button type="button" class="pick-item" data-id="' + esc(e.id) + '">' +
        '<span class="avatar mini" style="--bc:' + col(e) + '">' + initials(e.name) + '</span>' +
        '<span class="pick-main">' +
          '<span class="pick-name">' + hlName(e.name, q) + '</span>' +
          '<span class="pick-meta">' + esc(e.id) + ' \u00B7 Level ' + e.level + ' \u00B7 ' + esc(e.branchName) + '</span>' +
        '</span>' +
        '<span class="pick-go">Preview' + ICO_PRINT + '</span>' +
      '</button></li>').join('')
      : '<li class="sr-empty">No employee matches \u201C' + esc(q) + '\u201D — try fewer letters.</li>';
  }

  /* ==========================================================================
     MANAGE DATA — manual update panel (add / edit / delete / export)
     ========================================================================== */

  const adminState = { editingId: null };

  function recomputeMeta() {
    META.totalEmployees = EMP.length;
    META.levels = EMP.reduce((m, e) => Math.max(m, e.level), 1);
    META.branches = Math.max(0, ORG_DATA.branches.length - 1);
    META.managers = EMP.filter((e) => (childrenOf.get(e.id) || []).length).length;
    META.generated = new Date().toISOString().slice(0, 10);
  }

  /* recompute every derived field from id/name/level/headId/branchId alone —
     so a saved draft is always consistent, whatever was edited */
  function rebuildIndexes() {
    byId.clear();
    EMP.forEach((e) => byId.set(e.id, e));
    childrenOf.clear();
    EMP.forEach((e) => {
      const p = e.headId === e.id ? null : e.headId;
      if (!childrenOf.has(p)) childrenOf.set(p, []);
      childrenOf.get(p).push(e);
    });
    root = EMP.find((e) => e.headId === e.id) || EMP[0];

    EMP.forEach((e) => { e.directReports = (childrenOf.get(e.id) || []).length; });

    const memo = new Map();
    const teamOf = (id) => {
      if (memo.has(id)) return memo.get(id);
      let t = 0;
      (childrenOf.get(id) || []).forEach((k) => { t += teamOf(k.id) + 1; });
      memo.set(id, t);
      return t;
    };
    EMP.forEach((e) => { e.teamSize = teamOf(e.id); });

    const byLevel = EMP.slice().sort((a, b) => a.level - b.level);
    byLevel.forEach((e) => {
      e.depth = e.level - 1;
      if (e.headId === e.id) { e.headName = e.name; e.branchId = e.id; return; }
      const p = byId.get(e.headId);
      e.headName = p ? p.name : root.name;
      if (!e.branchId || !byId.has(e.branchId)) e.branchId = p ? p.branchId : root.id;
    });

    const leads = EMP.filter((e) => e.branchId === e.id)
      .sort((a, b) => a.level - b.level || b.teamSize - a.teamSize);
    ORG_DATA.branches = leads.map((e) => ({ id: e.id, name: e.name, teamSize: e.teamSize }));
    const bIdx = new Map(ORG_DATA.branches.map((b, i) => [b.id, i]));
    EMP.forEach((e) => {
      const lead = byId.get(e.branchId);
      e.branchName = lead ? lead.name : e.name;
      e.branchIdx = bIdx.has(e.branchId) ? bIdx.get(e.branchId) : 0;
    });

    EMP.forEach((e) => {
      const ch = [];
      let cur = e, guard = 0;
      while (cur && cur.headId !== cur.id && guard++ < 20) {
        const p = byId.get(cur.headId);
        if (!p) break;
        ch.unshift({ id: p.id, name: p.name });
        cur = p;
      }
      e.chain = ch;
    });

    recomputeMeta();
  }

  function rebuildAll() {
    els.orgTree.innerHTML = '';
    buildTree();
    state.expanded = new Set([root.id]);
    state.branch = '';
    els.branchFilter.value = '';
    els.branchFilter.innerHTML = '<option value="">All branches</option>';
    buildBranchOptions();
    renderStats();
    applyFilters();
    updateMetaTexts();
  }

  function updateMetaTexts() {
    $('#aboutTotal').textContent = META.totalEmployees;
    $('#aboutLevels').textContent = META.levels;
    $('#footMeta').textContent =
      `Data source: ${META.sourceFile} · ${META.totalEmployees} employees · ${META.branches} branches · Generated ${META.generated}`;
  }

  function diffCount() {
    const orig = new Map(ORIG_SNAPSHOT.employees.map((e) => [e.id, e]));
    const seen = new Set();
    let n = 0;
    for (const e of EMP) {
      const o = orig.get(e.id);
      if (!o) { n++; continue; }
      seen.add(e.id);
      if (o.name !== e.name || o.level !== e.level || o.headId !== e.headId || o.branchId !== e.branchId) n++;
    }
    orig.forEach((o, id) => { if (!seen.has(id)) n++; });
    return n;
  }

  function saveDraft() {
    const n = diffCount();
    try {
      if (n > 0) {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({
          savedAt: Date.now(), meta: Object.assign({}, META), branches: ORG_DATA.branches, employees: EMP,
        }));
      } else {
        localStorage.removeItem(DRAFT_KEY);
      }
    } catch (err) { console.warn('Draft could not be saved:', err); }
    updateAdminStatus();
  }

  function updateAdminStatus() {
    const n = diffCount();
    els.adminStatus.textContent = n
      ? 'Draft: ' + n + ' change' + (n === 1 ? '' : 's') + ' saved in this browser'
      : 'Original data — no local changes';
    els.adminStatus.classList.toggle('has-draft', n > 0);
    els.adminDiscardBtn.hidden = n === 0;
  }

  function discardDraft() {
    const n = diffCount();
    if (!confirm('Discard all ' + n + ' draft change' + (n === 1 ? '' : 's') + ' and restore the original data?')) return;
    try { localStorage.removeItem(DRAFT_KEY); } catch (err) { /* ignore */ }
    const orig = JSON.parse(JSON.stringify(ORIG_SNAPSHOT));
    EMP.length = 0;
    EMP.push(...orig.employees);
    ORG_DATA.branches = orig.branches;
    Object.keys(META).forEach((k) => { delete META[k]; });
    Object.assign(META, orig.meta);
    rebuildIndexes();
    rebuildAll();
    adminState.editingId = null;
    resetAdmForm();
    renderAdminList(els.adminSearch.value);
    updateAdminStatus();
    setAdmHint('Original data restored.', 'ok');
  }

  function exportDataJson() {
    const payload = { meta: Object.assign({}, META), branches: ORG_DATA.branches, employees: EMP };
    const blob = new Blob([JSON.stringify(payload, null, 1)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'OrgChartData.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    els.adminNote.innerHTML = '<strong>OrgChartData.json downloaded ✓</strong> — JSON opens in Notepad (no security ' +
      'warnings) and can be uploaded straight back with <strong>Upload data file</strong>. To publish for everyone: ' +
      'on GitHub replace the contents of <code>js/data.js</code> with <code>const ORG_DATA = </code> + this JSON + <code>;</code>, ' +
      'then commit &amp; push.';
  }

  /* ==========================================================================
     UPLOAD DATA — load a data file straight from the computer into the
     dashboard. Accepts:
       · .xlsx          real Excel workbooks — first sheet, un-zipped in the browser
       · data.js        the file exported by this panel (edit it, re-upload it)
       · .json          array of employees, or a full ORG_DATA payload
       · .csv / .tsv    columns: Code, Name, Reports To (code and/or name), Level
       · .xls / .htm    the original OrgChartFile HTML-table export
     Everything is validated first — unique codes, exactly one organization
     head, no orphans, no broken chains — and only then does it replace the
     working data: rows whose code already exists are UPDATED, new codes are
     ADDED — nothing is deleted. The result is a draft saved in this browser.
     ========================================================================== */

  function upNorm(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }

  /* strip leading em/en dashes our own exports use for "no head" */
  function upCleanHead(s) { return upNorm(s).replace(/^[\u2013\u2014-][\s\S]*$/, ''); }

  function upHeaderMap(headers) {
    const h = headers.map((x) => upNorm(x).toLowerCase().replace(/[^a-z0-9]/g, ''));
    const find = (...names) => {
      for (const n of names) { const i = h.indexOf(n); if (i >= 0) return i; }
      return -1;
    };
    return {
      id: find('employeecode', 'code', 'empcode', 'employeeid', 'empid', 'id'),
      name: find('employeename', 'name', 'fullname', 'employee'),
      headId: find('headcode', 'reportstocode', 'headid', 'managercode', 'reportingheadcode', 'reportingcode'),
      headName: find('heademployee', 'headname', 'reportsto', 'managername', 'manager', 'head'),
      level: find('levelid', 'level', 'grade'),
    };
  }

  function upRowsToRecords(matrix, map) {
    if (!map || map.id < 0 || map.name < 0) {
      /* fall back to the OrgChartFile column order:
         Employee Code | Employee Name | Head Code | Head Employee | LevelId */
      if (matrix.some((r) => r.length >= 5)) map = { id: 0, name: 1, headId: 2, headName: 3, level: 4 };
      else if (matrix.some((r) => r.length >= 3)) map = { id: 0, name: 1, headId: 2, headName: -1, level: -1 };
    }
    if (!map || map.id < 0 || map.name < 0) {
      throw new Error('could not find Code / Name columns — the file needs columns like ' +
        '"Employee Code, Employee Name, Head Code, Head Employee, Level"');
    }
    const recs = [];
    matrix.forEach((cells, rix) => {
      const id = upNorm(cells[map.id]);
      const name = upNorm(cells[map.name]);
      if (!id && !name) return;                       // blank row
      if (!id || !name) throw new Error('row ' + (rix + 1) + ' has a code but no name (or the other way round)');
      const headId = map.headId >= 0 ? upCleanHead(cells[map.headId]) : '';
      const headName = map.headName >= 0 ? upCleanHead(cells[map.headName]) : '';
      const lv = parseInt(upNorm(cells[map.level]), 10);
      recs.push({ id, name, headId, headName, level: Number.isFinite(lv) && lv > 0 ? lv : null });
    });
    return recs;
  }

  function upParseCsv(txt) {
    txt = txt.replace(/^\uFEFF/, '');
    const first = txt.split(/\r?\n/, 1)[0] || '';
    const count = (ch) => (first.match(new RegExp('\\' + ch, 'g')) || []).length;
    const delim = count('\t') > count(',') ? '\t' : (count(';') > count(',') ? ';' : ',');
    const matrix = [];
    let row = [], cell = '', inQ = false;
    for (let i = 0; i < txt.length; i++) {
      const ch = txt[i];
      if (inQ) {
        if (ch === '"') { if (txt[i + 1] === '"') { cell += '"'; i++; } else inQ = false; }
        else cell += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === delim) { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell); matrix.push(row); row = []; cell = ''; }
      else if (ch !== '\r') cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); matrix.push(row); }
    const rows = matrix.filter((r) => r.some((c) => upNorm(c)));
    if (!rows.length) throw new Error('the file looks empty');
    let map = null, body = rows;
    if (/code|name|level|head/i.test(upNorm(rows[0].join(' ')))) { map = upHeaderMap(rows[0]); body = rows.slice(1); }
    return upRowsToRecords(body, map);
  }

  function upParseHtmlTable(txt) {
    const doc = new DOMParser().parseFromString(txt, 'text/html');
    const table = doc.querySelector('table');
    if (!table) throw new Error('no table found in this file');
    const trs = [...table.querySelectorAll('tr')];
    const cellsOf = (tr) => [...tr.children].map((c) => upNorm(c.textContent));
    let map = null, body = trs;
    const headTr = trs.find((tr) => tr.querySelector('th'));
    if (headTr) { map = upHeaderMap(cellsOf(headTr)); body = trs.filter((tr) => tr !== headTr); }
    const matrix = body.map(cellsOf).filter((r) => r.some((x) => x));
    if (!matrix.length) throw new Error('the table has no data rows');
    return upRowsToRecords(matrix, map);
  }

  function upObjRecord(r) {
    return {
      id: upNorm(r.id != null ? r.id : r.code),
      name: upNorm(r.name),
      headId: upCleanHead(r.headId != null ? r.headId : (r.head != null ? r.head : r.reportsToCode)),
      headName: upCleanHead(r.headName != null ? r.headName : r.reportsTo),
      level: Number(r.level) > 0 ? Number(r.level) : null,
    };
  }

  function upParseJsOrJson(txt) {
    let payload;
    try { payload = JSON.parse(txt); } catch (err) { payload = null; }
    if (payload == null) {
      if (!/ORG_DATA\s*=/.test(txt)) {
        throw new Error('no ORG_DATA found — use OrgChartData.json from "Export data (JSON)", a CSV, an .xlsx, or a .js export of this site');
      }
      payload = new Function(txt + '\n;return ORG_DATA;')();
    }
    const rows = Array.isArray(payload) ? payload : (payload && payload.employees);
    if (!Array.isArray(rows) || !rows.length) throw new Error('no employees array found in the file');
    return rows.map(upObjRecord);
  }

  function upSniff(txt) {
    const tries = [() => upParseJsOrJson(txt), () => upParseCsv(txt), () => upParseHtmlTable(txt)];
    for (const t of tries) {
      try { const r = t(); if (r.length) return r; } catch (err) { /* try next */ }
    }
    throw new Error('unrecognised file type — use .xlsx, .xls, .csv, .json or the exported data.js');
  }

  function handleUploadFile(file) {
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.xlsx')) { upHandleXlsx(file); return; }
    setAdmHint('Reading ' + file.name + '\u2026');
    const reader = new FileReader();
    reader.onerror = () => setAdmHint('Could not read the file — try again.', 'err');
    reader.onload = () => {
      try {
        const txt = String(reader.result);
        let recs;
        if (lower.endsWith('.js') || lower.endsWith('.json')) recs = upParseJsOrJson(txt);
        else if (lower.endsWith('.csv') || lower.endsWith('.tsv') || lower.endsWith('.txt')) recs = upParseCsv(txt);
        else if (lower.endsWith('.xls') || lower.endsWith('.htm') || lower.endsWith('.html')) recs = upParseHtmlTable(txt);
        else recs = upSniff(txt);
        applyUploaded(recs, file.name);
      } catch (err) {
        setAdmHint('Upload failed \u2014 ' + err.message, 'err');
      }
    };
    reader.readAsText(file);
  }

  /* ---- .xlsx support: a tiny built-in reader, no internet needed ----
     A workbook is a ZIP archive of XML files. Browsers can un-zip natively
     (DecompressionStream), so we open the ZIP, read the first worksheet plus
     the shared strings, and turn it into the same row-matrix the CSV import
     uses. Works offline, also from file://. */

  async function upHandleXlsx(file) {
    setAdmHint('Reading ' + file.name + '\u2026');
    try {
      const matrix = await upParseXlsx(await file.arrayBuffer());
      const rows = matrix.filter((r) => r.some((c) => upNorm(c)));
      if (!rows.length) throw new Error('the first sheet of this workbook looks empty');
      let map = null, body = rows;
      if (/code|name|level|head/i.test(upNorm(rows[0].join(' ')))) { map = upHeaderMap(rows[0]); body = rows.slice(1); }
      applyUploaded(upRowsToRecords(body, map), file.name);
    } catch (err) {
      setAdmHint('Upload failed — ' + (err && err.message ? err.message : 'could not read this .xlsx file'), 'err');
    }
  }

  async function upParseXlsx(buf) {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('this browser is too old to un-zip .xlsx — update it, or upload the CSV instead');
    }
    const dv = new DataView(buf);
    const u8 = new Uint8Array(buf);
    const u16 = (o) => dv.getUint16(o, true);
    const u32 = (o) => dv.getUint32(o, true);
    /* find the End Of Central Directory record (scan backwards, comments ≤ 64 KB) */
    let eocd = -1;
    for (let i = buf.byteLength - 22; i >= 0 && i >= buf.byteLength - 65557; i--) {
      if (u32(i) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('not a valid .xlsx file (it is not a ZIP archive)');
    const dec = new TextDecoder();
    const entries = {};
    let off = u32(eocd + 16);
    for (let n = 0; n < u16(eocd + 10); n++) {
      if (u32(off) !== 0x02014b50) throw new Error('corrupt .xlsx (ZIP directory)');
      const method = u16(off + 10), csize = u32(off + 20);
      const nLen = u16(off + 28), eLen = u16(off + 30), cLen = u16(off + 32);
      const lho = u32(off + 42);
      entries[dec.decode(u8.subarray(off + 46, off + 46 + nLen))] = { method, csize, lho };
      off += 46 + nLen + eLen + cLen;
    }
    const read = async (name) => {
      const e = entries[name];
      if (!e) return null;
      if (u32(e.lho) !== 0x04034b50) throw new Error('corrupt .xlsx (entry ' + name + ')');
      const start = e.lho + 30 + u16(e.lho + 26) + u16(e.lho + 28);
      const raw = u8.subarray(start, start + e.csize);
      if (e.method === 0) return raw;                       // stored
      if (e.method !== 8) throw new Error('unsupported .xlsx compression');
      const ds = new DecompressionStream('deflate-raw');     // deflated
      const out = await new Response(new Blob([raw]).stream().pipeThrough(ds)).arrayBuffer();
      return new Uint8Array(out);
    };
    const xml = (bytes) => {
      const doc = new DOMParser().parseFromString(dec.decode(bytes), 'application/xml');
      if (doc.getElementsByTagName('parsererror').length) throw new Error('corrupt .xlsx (bad XML inside)');
      return doc;
    };
    if (!entries['xl/workbook.xml']) throw new Error('not a valid .xlsx workbook');
    const wb = xml(await read('xl/workbook.xml'));
    /* first sheet, resolved through the rels file (Excel & Google Sheets alike) */
    let target = '';
    try {
      const relsXml = await read('xl/_rels/workbook.xml.rels');
      const relMap = {};
      if (relsXml) {
        [...xml(relsXml).getElementsByTagName('Relationship')].forEach((r) => {
          relMap[r.getAttribute('Id')] = r.getAttribute('Target');
        });
      }
      const sh = wb.getElementsByTagName('sheet')[0];
      if (sh) {
        const rid = sh.getAttribute('r:id') ||
          sh.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || '';
        let t = (relMap[rid] || '').replace(/^\//, '');
        if (t && !/^xl\//.test(t)) t = 'xl/' + t;
        target = t;
      }
    } catch (err) { /* fall back to the file-name guess below */ }
    if (!target || !entries[target]) {
      const names = Object.keys(entries);
      target = names.find((n) => /^xl\/worksheets\/sheet1\.xml$/i.test(n)) ||
               names.find((n) => n.indexOf('xl/worksheets/') === 0);
    }
    if (!target) throw new Error('no worksheet found inside the .xlsx');
    /* shared strings: cell type t="s" stores an index into this table */
    const shared = [];
    if (entries['xl/sharedStrings.xml']) {
      [...xml(await read('xl/sharedStrings.xml')).getElementsByTagName('si')].forEach((si) => {
        let s = '';
        [...si.children].forEach((kid) => {
          if (kid.tagName === 't') s += kid.textContent;
          else if (kid.tagName === 'r') [...kid.getElementsByTagName('t')].forEach((t) => { s += t.textContent; });
        });
        shared.push(s);
      });
    }
    /* worksheet → matrix of strings, gaps padded by column reference (r="C5") */
    const sheet = xml(await read(target));
    const matrix = [];
    [...sheet.getElementsByTagName('row')].forEach((rowEl) => {
      const cells = [];
      let last = -1;
      [...rowEl.getElementsByTagName('c')].forEach((c) => {
        const ref = c.getAttribute('r') || '';
        let idx = 0;
        for (const ch of ref) { if (ch >= 'A' && ch <= 'Z') idx = idx * 26 + (ch.charCodeAt(0) - 64); else break; }
        idx = ref ? idx - 1 : last + 1;
        for (let k = last + 1; k < idx; k++) cells.push('');
        last = idx;
        const t = c.getAttribute('t');
        let val = '';
        if (t === 's') {
          const v = c.getElementsByTagName('v')[0];
          const i = v ? parseInt(v.textContent, 10) : -1;
          val = i >= 0 && i < shared.length ? shared[i] : '';
        } else if (t === 'inlineStr') {
          const isEl = c.getElementsByTagName('is')[0];
          if (isEl) [...isEl.getElementsByTagName('t')].forEach((x) => { val += x.textContent; });
        } else {
          const v = c.getElementsByTagName('v')[0];
          val = v ? v.textContent : '';
        }
        cells.push(String(val == null ? '' : val).trim());
      });
      matrix.push(cells);
    });
    return matrix;
  }

  function applyUploaded(recs, fname) {
    /* ---- validate the file itself ---- */
    const seen = new Set();
    recs.forEach((r) => {
      if (!r.id) throw new Error('a row is missing the employee code');
      if (seen.has(r.id)) throw new Error('duplicate employee code "' + r.id + '" in the file');
      seen.add(r.id);
      if (!r.name) throw new Error('employee "' + r.id + '" has no name');
    });

    /* ---- resolve "reports to": inside the file first, then the CURRENT data.
       That way a small file with only the new joiners also works — their
       managers are already in the dashboard and need not be in the file. ---- */
    const byCode = new Map(recs.map((r) => [r.id, r]));
    const curByCode = new Map(EMP.map((e) => [e.id, e]));
    const plain = (s) => s.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
    const byName = new Map();
    recs.forEach((r) => { if (!byName.has(plain(r.name))) byName.set(plain(r.name), r); });
    const curByName = new Map();
    EMP.forEach((e) => { if (!curByName.has(plain(e.name))) curByName.set(plain(e.name), e); });
    const unresolved = [];
    recs.forEach((r) => {
      if (r.headId && (byCode.has(r.headId) || curByCode.has(r.headId))) return;
      const hit = r.headName ? (byName.get(plain(r.headName)) || curByName.get(plain(r.headName))) : null;
      if (hit) { r.headId = hit.id; return; }
      if (!r.headId && !r.headName) { r.headId = r.id; return; }   // empty → top candidate
      unresolved.push(r.id + ' \u2192 "' + (r.headId || r.headName) + '"');
    });
    if (unresolved.length) {
      throw new Error('these rows report to someone not in the file and not in the current data: ' +
        unresolved.slice(0, 3).join(', ') + (unresolved.length > 3 ? ' \u2026' : ''));
    }

    /* ---- merge plan: file rows update or add, untouched rows stay as they are ---- */
    const added = [], updated = [];
    recs.forEach((r) => (curByCode.has(r.id) ? updated : added).push(r));
    const merged = [];
    EMP.forEach((e) => {
      if (byCode.has(e.id)) return;                     // file row replaces this one
      merged.push({ id: e.id, name: e.name, level: e.level, headId: e.headId });
    });
    recs.forEach((r) => {
      merged.push({ id: r.id, name: r.name, level: r.level, headId: r.headId });
    });

    /* ---- validate the MERGED set as one organization ---- */
    const curRoot = EMP.find((e) => e.headId === e.id);
    const mRoots = merged.filter((r) => r.headId === r.id);
    if (mRoots.length !== 1) {
      throw new Error(mRoots.length === 0
        ? 'no organization head \u2014 exactly one row must have an empty "reports to" (or its own code)'
        : 'multiple organization heads found (' + mRoots.map((r) => r.id).join(', ') +
          ') \u2014 only the real head may have an empty "Reports To". Give every other row a manager.');
    }

    /* levels: fill any missing ones from the hierarchy, reject broken chains */
    const lvl = new Map([[mRoots[0].id, 1]]);
    let grew = true;
    while (grew) {
      grew = false;
      merged.forEach((r) => {
        if (lvl.has(r.id)) return;
        const pl = lvl.get(r.headId);
        if (pl != null) { lvl.set(r.id, pl + 1); grew = true; }
      });
    }
    const unlinked = merged.filter((r) => !lvl.has(r.id));
    if (unlinked.length) {
      throw new Error('broken reporting chain at: ' + unlinked.slice(0, 3).map((r) => r.id).join(', ') +
        (unlinked.length > 3 ? ' \u2026' : '') + ' \u2014 check their "Reports To" codes');
    }
    merged.forEach((r) => { if (r.level == null) r.level = lvl.get(r.id); });

    /* branch leads: recompute the level-2 ancestor for every row on the
       merged set (managers may have changed in this upload) */
    const mergedByCode = new Map(merged.map((r) => [r.id, r]));
    const branchOf = (r0) => {
      let cur = r0, guard = 0;
      while (cur && cur.headId !== cur.id && guard++ < 60) {
        const p = mergedByCode.get(cur.headId);
        if (!p) return r0;
        if (p.headId === p.id) return cur;   // parent is the head → cur is a level-2 lead
        cur = p;
      }
      return cur;                            // the head itself
    };
    merged.forEach((r) => { r.branchId = branchOf(r).id; });

    /* ---- confirm with a real summary ---- */
    let summary;
    if (!added.length && !updated.length) {
      summary = 'nothing to change \u2014 the file matches the current data';
    } else if (!added.length) {
      summary = updated.length + ' existing employee' + (updated.length === 1 ? '' : 's') +
        ' will be updated (no new employees)';
    } else {
      summary = added.length + ' new employee' + (added.length === 1 ? '' : 's') + ' will be added' +
        (updated.length ? ', ' + updated.length + ' existing updated' : '') +
        ' (total ' + EMP.length + ' \u2192 ' + (EMP.length + added.length) + ')';
    }
    if (!confirm('Upload "' + fname + '": ' + summary +
        '.\n\nThe tree, counters, search and directory update immediately.')) {
      setAdmHint('Upload cancelled \u2014 current data unchanged.');
      return;
    }

    /* ---- apply: swap EMP contents in place, rebuild everything ---- */
    EMP.length = 0;
    EMP.push(...merged);
    META.sourceFile = fname;
    rebuildIndexes();
    rebuildAll();
    saveDraft();
    adminState.editingId = null;
    resetAdmForm();
    renderAdminList(els.adminSearch.value);
    updateAdminStatus();
    const doneMsg = added.length
      ? added.length + ' employee' + (added.length === 1 ? '' : 's') + ' added' +
        (updated.length ? ', ' + updated.length + ' updated' : '')
      : updated.length + ' employee' + (updated.length === 1 ? '' : 's') + ' updated';
    setAdmHint('Uploaded \u2713 ' + doneMsg + ' \u2014 dashboard now shows ' + EMP.length +
      ' employees. Saved as a draft in this browser.', 'ok');
    els.adminNote.innerHTML = '<strong>Uploaded \u2713</strong> \u2014 <strong>' + esc(doneMsg) +
      '</strong>; the dashboard now shows <strong>' + EMP.length + ' employees</strong> (from <code>' + esc(fname) +
      '</code>). Saved as a draft in this browser \u2014 it survives a refresh. To publish for everyone: ' +
      '<strong>Export data (JSON)</strong> \u2192 on GitHub replace the contents of <code>js/data.js</code> with ' +
      '<code>const ORG_DATA = </code> + the JSON + <code>;</code>.';
  }

  function descendantIdsOf(id) {
    const out = new Set([id]);
    const walk = (pid) => (childrenOf.get(pid) || []).forEach((k) => { out.add(k.id); walk(k.id); });
    walk(id);
    return out;
  }

  function fillHeadOptions(level, excludeId, selected) {
    const bad = excludeId ? descendantIdsOf(excludeId) : new Set();
    const opts = EMP.filter((e) => e.level < level && !bad.has(e.id))
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
    els.admHead.innerHTML = '<option value="">— select manager —</option>' +
      opts.map((e) => '<option value="' + esc(e.id) + '"' + (e.id === selected ? ' selected' : '') + '>' +
        'L' + e.level + ' · ' + esc(e.id) + ' · ' + esc(e.name) + '</option>').join('');
  }

  function fillBranchOptions(selected) {
    els.admBranch.innerHTML = '<option value="">Inherit from manager</option>' +
      ORG_DATA.branches.map((b) => '<option value="' + esc(b.id) + '"' + (b.id === selected ? ' selected' : '') + '>' +
        esc(b.id) + ' · ' + esc(b.name) + '</option>').join('') +
      '<option value="__new__">New branch — this person becomes branch lead</option>';
  }

  function suggestCode() {
    let mx = 0;
    EMP.forEach((e) => {
      const n = parseInt(e.id, 10);
      if (Number.isFinite(n) && String(n) === String(e.id).trim() && n > mx) mx = n;
    });
    return String(mx + 1);
  }

  function setAdmHint(msg, kind) {
    els.admHint.textContent = msg || '';
    els.admHint.className = 'adm-hint' + (kind ? ' ' + kind : '');
  }

  function resetAdmForm() {
    adminState.editingId = null;
    els.admForm.reset();
    els.admFormTitle.textContent = 'Add employee';
    els.admCode.value = suggestCode();
    els.admCode.disabled = false;
    els.admName.disabled = false;
    els.admLevel.disabled = false;
    els.admLevel.value = '3';
    els.admHead.disabled = false;
    els.admBranch.disabled = false;
    fillHeadOptions(3, null, '');
    fillBranchOptions('');
    els.admDeleteBtn.hidden = true;
    setAdmHint('');
    els.adminList.querySelectorAll('.adm-item.is-sel').forEach((b) => b.classList.remove('is-sel'));
  }

  function editEmployee(id) {
    const e = byId.get(id);
    if (!e) return;
    adminState.editingId = id;
    const isRoot = e.headId === e.id;
    els.admFormTitle.textContent = 'Edit — ' + e.name;
    els.admCode.value = e.id;
    els.admName.value = e.name;
    els.admLevel.value = String(e.level);
    fillHeadOptions(e.level, isRoot ? null : id, isRoot ? '' : e.headId);
    fillBranchOptions(isRoot ? '' : (e.branchId === e.id ? '__new__' : e.branchId));
    els.admCode.disabled = true; // codes are the reference keys — never renamed
    els.admName.disabled = false;
    els.admLevel.disabled = isRoot;
    els.admHead.disabled = isRoot;
    els.admBranch.disabled = isRoot;
    els.admDeleteBtn.hidden = isRoot;
    setAdmHint(isRoot
      ? 'This is the organization head — only the name can be edited.'
      : 'Change any field and press Save. Deleting moves their reports under their manager.');
    els.adminList.querySelectorAll('.adm-item').forEach((b) =>
      b.classList.toggle('is-sel', b.dataset.id === id));
  }

  function saveFromForm() {
    const editingId = adminState.editingId;
    const editing = editingId ? byId.get(editingId) : null;
    const isRootEdit = !!(editing && editing.headId === editing.id);
    const name = els.admName.value.trim().replace(/\s+/g, ' ');
    setAdmHint('');

    if (!name) { setAdmHint('Please enter the employee name.', 'err'); els.admName.focus(); return; }

    if (isRootEdit) {
      editing.name = name;
      rebuildIndexes();
      rebuildAll();
      saveDraft();
      renderAdminList(els.adminSearch.value);
      editEmployee(editing.id);
      setAdmHint('Saved ✓ — draft updated in this browser. Export data.js to publish.', 'ok');
      return;
    }

    const code = els.admCode.value.trim();
    const level = parseInt(els.admLevel.value, 10);
    const headId = els.admHead.value;
    const branchPick = els.admBranch.value;

    if (!code || /\s/.test(code)) { setAdmHint('Employee code is required (no spaces).', 'err'); els.admCode.focus(); return; }
    if (!Number.isFinite(level) || level < 2 || level > 5) { setAdmHint('Choose a level between 2 and 5.', 'err'); return; }
    if (!headId || !byId.has(headId)) { setAdmHint('Choose who this employee reports to.', 'err'); els.admHead.focus(); return; }
    if (editing && descendantIdsOf(editingId).has(headId)) {
      setAdmHint('A person cannot report to themselves or to one of their own team members.', 'err');
      return;
    }
    if (!editing && byId.has(code)) {
      setAdmHint('Code "' + code + '" is already used by ' + byId.get(code).name + '.', 'err');
      els.admCode.focus();
      return;
    }

    let target = editing;
    if (!editing) {
      target = {
        id: code, name, headId, headName: '', level, depth: level - 1,
        directReports: 0, teamSize: 0, branchId: '', branchName: '', branchIdx: 0, chain: [],
      };
      EMP.push(target);
    } else {
      target.name = name;
      target.level = level;
      target.depth = level - 1;
      target.headId = headId;
      target.branchId = branchPick === '__new__' ? target.id : branchPick; // '' → inherit from manager (rebuilt below)
    }
    if (!editing && branchPick === '__new__') target.branchId = target.id;
    if (!editing && branchPick && branchPick !== '__new__') target.branchId = branchPick;

    rebuildIndexes();
    rebuildAll();
    saveDraft();
    renderAdminList(els.adminSearch.value);
    editEmployee(target.id);
    setAdmHint('Saved ✓ — draft updated in this browser. Export data.js to publish.', 'ok');
    if (state.view === 'tree') flashCard(target.id);
  }

  function deleteEditing() {
    const id = adminState.editingId;
    const e = id ? byId.get(id) : null;
    if (!e) return;
    if (e.headId === e.id) { setAdmHint('The organization head cannot be deleted.', 'err'); return; }
    const kids = (childrenOf.get(e.id) || []).length;
    const msg = 'Delete ' + e.name + ' (' + e.id + ')?' +
      (kids ? '\n\nTheir ' + kids + ' direct report' + (kids === 1 ? '' : 's') +
        ' will move under their manager (' + e.headName + ').' : '') +
      '\n\nThis becomes permanent when you export and publish data.js.';
    if (!confirm(msg)) return;
    (childrenOf.get(e.id) || []).forEach((k) => { k.headId = e.headId; });
    EMP.splice(EMP.indexOf(e), 1);
    rebuildIndexes();
    rebuildAll();
    saveDraft();
    renderAdminList(els.adminSearch.value);
    resetAdmForm();
    setAdmHint('Deleted ✓ — draft updated in this browser. Export data.js to publish.', 'ok');
  }

  function renderAdminList(rawQ) {
    const q = norm(rawQ);
    const rows = (q
      ? EMP.filter((e) => norm(e.name).includes(q) || norm(e.id).includes(q))
      : EMP.slice()
    ).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
    els.adminList.innerHTML = rows.length ? rows.map((e) => {
      const isNew = !ORIG_IDS.has(e.id);
      return '<li><button type="button" class="adm-item' + (adminState.editingId === e.id ? ' is-sel' : '') +
        '" data-id="' + esc(e.id) + '">' +
        '<span class="avatar mini" style="--bc:' + col(e) + '">' + initials(e.name) + '</span>' +
        '<span class="adm-main">' +
          '<span class="adm-name">' + esc(e.name) + (isNew ? ' <em class="adm-new">new</em>' : '') + '</span>' +
          '<span class="adm-meta">' + esc(e.id) + ' · L' + e.level + ' · ' + esc(e.branchName) + '</span>' +
        '</span>' +
        '</button></li>';
    }).join('') : '<li class="sr-empty">No employee matches “' + esc(q) + '”.</li>';
  }

  function openAdmin() {
    els.adminModal.hidden = false;
    renderAdminList(els.adminSearch.value);
    updateAdminStatus();
    if (!adminState.editingId) resetAdmForm();
    els.adminSearch.focus();
  }

  function closeAdmin() { els.adminModal.hidden = true; }

  /* ==========================================================================
     STATS & FILTER OPTIONS
     ========================================================================== */

  function renderStats() {
    const cards = [
      { label: 'Total Employees', value: META.totalEmployees, sub: `across ${META.levels} reporting levels` },
      { label: 'Branch Units', value: META.branches, sub: 'led by level-2 heads' },
      { label: 'Hierarchy Levels', value: META.levels, sub: `Level 1 → Level ${META.levels}` },
      { label: 'Team Leads', value: META.managers, sub: 'employees with direct reports' },
    ];
    els.stats.innerHTML = cards.map((c) =>
      `<div class="stat-card"><div class="stat-label">${c.label}</div>` +
      `<div class="stat-value">${c.value}</div><div class="stat-sub">${c.sub}</div></div>`).join('');
  }

  function buildBranchOptions() {
    ORG_DATA.branches.slice(1).forEach((b) => { // skip root branch
      const o = document.createElement('option');
      o.value = b.id;
      o.textContent = `${b.id} · ${b.name} (${b.teamSize})`;
      els.branchFilter.appendChild(o);
    });
  }

  /* ==========================================================================
     VIEW SWITCHING & ZOOM
     ========================================================================== */

  function switchView(v) {
    state.view = v;
    els.body.dataset.view = v;
    els.treeView.hidden = v !== 'tree';
    els.directoryView.hidden = v !== 'directory';
    document.querySelectorAll('.nav-link[data-view]').forEach((b) => {
      b.classList.toggle('is-active', b.dataset.view === v);
    });
    els.mobileMenu.hidden = true;
    els.burgerBtn.setAttribute('aria-expanded', 'false');
  }

  function setZoom(z) {
    state.zoom = Math.min(1.5, Math.max(0.5, Math.round(z * 10) / 10));
    els.treeScaler.style.transform = `scale(${state.zoom})`;
    els.zoomLevel.textContent = Math.round(state.zoom * 100) + '%';
  }

  function centerTree() {
    const vp = els.treeViewport;
    vp.scrollLeft = Math.max(0, (vp.scrollWidth - vp.clientWidth) / 2);
    vp.scrollTop = 0;
  }

  function locateInChart(id) {
    closeEmployeeModal();
    if (state.view !== 'tree') switchView('tree');
    state.query = '';
    els.search.value = '';
    renderSearchPanel('', null);
    ancestorsOf(id).forEach((a) => state.expanded.add(a));
    applyFilters();
    flashCard(id);
  }

  /* ==========================================================================
     EVENTS
     ========================================================================== */

  function wireEvents() {
    // view switching (desktop + mobile nav)
    document.querySelectorAll('.nav-link[data-view]').forEach((b) =>
      b.addEventListener('click', () => switchView(b.dataset.view)));

    // about modal
    const openAbout = () => { els.aboutModal.hidden = false; $('#aboutModalClose').focus(); };
    $('#aboutBtn').addEventListener('click', openAbout);
    $('#aboutBtnMobile').addEventListener('click', openAbout);
    $('#aboutModalClose').addEventListener('click', () => { els.aboutModal.hidden = true; });

    // brand → home
    $('#brandHome').addEventListener('click', (ev) => { ev.preventDefault(); clearAllFilters(); switchView('tree'); });

    // search
    els.search.addEventListener('input', debounce(() => {
      state.query = els.search.value;
      applyFilters();
    }, 180));

    // search results panel: open profile · locate in chart · print profile
    els.searchResults.addEventListener('click', (ev) => {
      const pb = ev.target.closest('[data-printid]');
      if (pb) { ev.stopPropagation(); printProfile(pb.dataset.printid); return; }
      const lb = ev.target.closest('[data-locate]');
      if (lb) { ev.stopPropagation(); revealInTree(lb.dataset.locate); return; }
      const item = ev.target.closest('.sr-item');
      if (item) { els.searchResults.hidden = true; openEmployee(item.dataset.id, item); }
    });
    els.searchResults.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      const item = ev.target.closest('.sr-item');
      if (item) { ev.preventDefault(); els.searchResults.hidden = true; openEmployee(item.dataset.id, item); }
    });

    // filters
    els.branchFilter.addEventListener('change', () => { state.branch = els.branchFilter.value; applyFilters(); });
    els.levelFilter.addEventListener('change', () => { state.level = els.levelFilter.value; applyFilters(); });
    els.clearFilters.addEventListener('click', clearAllFilters);

    // expand / collapse / zoom
    $('#expandAllBtn').addEventListener('click', () => {
      EMP.forEach((e) => { if ((childrenOf.get(e.id) || []).length) state.expanded.add(e.id); });
      syncExpansion();
      centerTree();
    });
    $('#collapseAllBtn').addEventListener('click', () => {
      state.expanded = new Set([root.id]);
      syncExpansion();
      centerTree();
    });
    $('#zoomInBtn').addEventListener('click', () => setZoom(state.zoom + 0.1));
    $('#zoomOutBtn').addEventListener('click', () => setZoom(state.zoom - 0.1));

    // print menu
    els.printMenuBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const open = els.printMenuPop.hidden;
      els.printMenuPop.hidden = !open;
      els.printMenuBtn.setAttribute('aria-expanded', String(open));
    });
    els.printMenuPop.addEventListener('click', (ev) => {
      const b = ev.target.closest('button[data-print]');
      if (!b) return;
      els.printMenuPop.hidden = true;
      els.printMenuBtn.setAttribute('aria-expanded', 'false');
      if (b.dataset.print === 'chart') printChart();
      else if (b.dataset.print === 'directory') printDirectory();
      else openPickModal();
    });
    document.addEventListener('click', (ev) => {
      if (!els.printMenuPop.hidden && !ev.target.closest('.printmenu')) {
        els.printMenuPop.hidden = true;
        els.printMenuBtn.setAttribute('aria-expanded', 'false');
      }
      if (!els.searchResults.hidden && !ev.target.closest('.searchbox')) {
        els.searchResults.hidden = true;
      }
    });

    // print picker (Print ▸ Employee profile…)
    $('#pickClose').addEventListener('click', closePickModal);
    els.pickModal.addEventListener('click', (ev) => { if (ev.target === els.pickModal) closePickModal(); });
    els.pickSearch.addEventListener('input', debounce(() => renderPickList(els.pickSearch.value), 140));
    els.pickList.addEventListener('click', (ev) => {
      const item = ev.target.closest('.pick-item');
      if (!item) return;
      closePickModal();
      printProfile(item.dataset.id);
    });

    // manage data panel
    $('#manageBtn').addEventListener('click', openAdmin);
    $('#manageBtnMobile').addEventListener('click', openAdmin);
    $('#adminClose').addEventListener('click', closeAdmin);
    els.adminModal.addEventListener('click', (ev) => { if (ev.target === els.adminModal) closeAdmin(); });
    els.adminSearch.addEventListener('input', debounce(() => renderAdminList(els.adminSearch.value), 120));
    els.adminList.addEventListener('click', (ev) => {
      const b = ev.target.closest('.adm-item');
      if (b) editEmployee(b.dataset.id);
    });
    $('#adminAddBtn').addEventListener('click', () => { resetAdmForm(); els.admName.focus(); });
    $('#adminDiscardBtn').addEventListener('click', discardDraft);
    $('#adminJsonBtn').addEventListener('click', exportDataJson);
    $('#adminUploadBtn').addEventListener('click', () => els.adminFileInput.click());
    els.adminFileInput.addEventListener('change', () => {
      const f = els.adminFileInput.files && els.adminFileInput.files[0];
      els.adminFileInput.value = '';   // allow re-picking the same file later
      if (f) handleUploadFile(f);
    });
    els.admForm.addEventListener('submit', (ev) => { ev.preventDefault(); saveFromForm(); });
    $('#admDeleteBtn').addEventListener('click', deleteEditing);
    $('#admCancelBtn').addEventListener('click', resetAdmForm);
    els.admLevel.addEventListener('change', () => {
      fillHeadOptions(parseInt(els.admLevel.value, 10) || 5, adminState.editingId, els.admHead.value);
    });

    // burger
    els.burgerBtn.addEventListener('click', () => {
      const open = els.mobileMenu.hidden;
      els.mobileMenu.hidden = !open;
      els.burgerBtn.setAttribute('aria-expanded', String(open));
    });

    // directory: row click + column sort
    els.dirBody.addEventListener('click', (ev) => {
      const tr = ev.target.closest('tr[data-id]');
      if (tr) openEmployee(tr.dataset.id, tr);
    });
    document.querySelectorAll('#dirTable thead th').forEach((th) => {
      th.addEventListener('click', () => {
        const k = th.dataset.sort;
        if (state.sortKey === k) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
        else { state.sortKey = k; state.sortDir = 'asc'; }
        renderDirectory();
      });
    });

    // employee modal
    $('#empModalClose').addEventListener('click', closeEmployeeModal);
    els.empModal.addEventListener('click', (ev) => { if (ev.target === els.empModal) closeEmployeeModal(); });
    $('#printProfileBtn').addEventListener('click', () => { if (state.currentId) printProfile(state.currentId); });
    $('#locateBtn').addEventListener('click', () => { if (state.currentId) locateInChart(state.currentId); });
    els.empModal.addEventListener('click', (ev) => {
      const t = ev.target.closest('[data-open]');
      if (t) openEmployee(t.dataset.open, t);
    });
    els.empModal.addEventListener('keydown', (ev) => {
      const t = ev.target.closest('[data-open]');
      if (t && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); openEmployee(t.dataset.open, t); }
    });

    // print preview · send-to-printer station
    $('#pvConfirmBtn').addEventListener('click', () => {
      const mode = pendingPrint || 'profile';
      closePrintPreview();
      setTimeout(() => printWith(mode), 80); // let the overlay unmount before the print snapshot
    });
    $('#pvCancelBtn').addEventListener('click', closePrintPreview);
    $('#pvClose').addEventListener('click', closePrintPreview);
    els.printPreview.addEventListener('click', (ev) => {
      if (ev.target === els.printPreview) closePrintPreview();
    });

    // global escape
    document.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Escape') return;
      if (!els.printPreview.hidden) { closePrintPreview(); return; }
      if (!els.pickModal.hidden) { closePickModal(); return; }
      if (!els.adminModal.hidden) { closeAdmin(); return; }
      if (!els.empModal.hidden) closeEmployeeModal();
      else if (!els.aboutModal.hidden) els.aboutModal.hidden = true;
      els.printMenuPop.hidden = true;
      els.searchResults.hidden = true;
      els.mobileMenu.hidden = true;
    });

    // keep the tree rooted at the organization head when the window is resized
    window.addEventListener('resize', debounce(centerTree, 250));
  }

  /* ==========================================================================
     EXPORT TABLE — full data as rows × columns: copy for Excel + CSV download
     ========================================================================== */

  const TABLE_HEAD = ['Code', 'Employee Name', 'Reports To', 'Reports To Code', 'Level', 'Branch', 'Direct Reports', 'Team Size'];

  function tableMatrix() {
    const rows = EMP.slice().sort((a, b) => a.name.localeCompare(b.name)).map((e) => [
      e.id,
      e.name,
      e.headId === e.id ? '— (Organization Head)' : e.headName,
      e.headId === e.id ? '' : e.headId,
      String(e.level),
      e.branchName,
      String(e.directReports || 0),
      String(e.teamSize || 0)
    ]);
    return [TABLE_HEAD].concat(rows);
  }

  function copyTextFallback(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  function flashBtn(btn, msg) {
    if (!btn || btn.dataset.busy) return;
    btn.dataset.busy = '1';
    const old = btn.innerHTML;
    btn.innerHTML = '<strong>' + esc(msg) + '</strong>';
    setTimeout(() => { btn.innerHTML = old; delete btn.dataset.busy; }, 1800);
  }

  function copyTableForExcel() {
    const tsv = tableMatrix().map((r) =>
      r.map((c) => String(c).replace(/[\t\n]/g, ' ')).join('\t')
    ).join('\n');
    const done = (ok) => flashBtn($('#copyTableBtn'),
      ok ? 'Copied \u2713 paste in Excel' : 'Copy blocked \u2014 use Download CSV');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(tsv).then(() => done(true), () => done(copyTextFallback(tsv)));
    } else {
      done(copyTextFallback(tsv));
    }
  }

  function downloadCSV() {
    const csv = '\uFEFF' + tableMatrix().map((r) =>
      r.map((c) => {
        const s = String(c);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',')
    ).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'kanvtech-employees-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    flashBtn($('#csvBtn'), 'CSV downloaded \u2713');
  }

  $('#copyTableBtn').addEventListener('click', copyTableForExcel);
  $('#csvBtn').addEventListener('click', downloadCSV);

  /* ==========================================================================
     INIT
     ========================================================================== */

  function init() {
    els.body.dataset.view = 'tree';
    renderStats();
    buildBranchOptions();
    buildTree();
    syncExpansion();
    applyFilters();
    setZoom(1);
    wireEvents();
    centerTree();

    // about modal live numbers + footer meta
    updateMetaTexts();
  }

  init();
})();
