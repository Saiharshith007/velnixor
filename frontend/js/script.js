'use strict';

// Icon paths from Lucide (ISC license, lucide.dev), inlined so the app works offline.
const ICONS = {
    play: '<path d="M6 3l14 9-14 9V3z"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    sheet: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18M3 15h18M9 9v12"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    external: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    briefcase: '<rect width="20" height="14" x="2" y="7" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
    alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
};

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icon = name => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
$$('i[data-i]').forEach(el => { el.outerHTML = icon(el.dataset.i); });

const store = {
    get(key) { try { return JSON.parse(localStorage.getItem('velnixor:' + key)); } catch { return null; } },
    set(key, value) { try { localStorage.setItem('velnixor:' + key, JSON.stringify(value)); } catch { /* storage disabled */ } },
};

const state = { files: [], paths: [], results: [], view: [], filter: 'short', sort: { key: 'score', dir: -1 }, open: null, criteria: '' };

function toast(message, kind = 'info') {
    const el = Object.assign(document.createElement('div'), { className: `toast ${kind}`, textContent: message });
    $('#toasts').append(el);
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 250); }, 4000);
}

async function api(url, body) {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
}

function saveFile(blob, name) {
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// --- Tabs --------------------------------------------------------------------------------------------------------

function route() {
    const tab = location.hash === '#results' ? 'results' : 'setup';
    $$('.view').forEach(v => { v.hidden = v.id !== `view-${tab}`; });
    $$('.tabs a').forEach(a => {
        a.classList.toggle('active', a.dataset.tab === tab);
        a.setAttribute('aria-selected', a.dataset.tab === tab);
    });
    if (tab === 'setup') closeDrawer();
}
window.addEventListener('hashchange', route);

// --- Job ---------------------------------------------------------------------------------------------------------

const jd = $('#jd'), minExp = $('#minExp'), threshold = $('#threshold');

function tagField(id) {
    const box = $('#' + id), input = $('input', box);
    let items = [];
    const render = () => {
        $$('.tag', box).forEach(t => t.remove());
        items.forEach((v, i) => input.insertAdjacentHTML('beforebegin',
            `<span class="tag">${esc(v)}<button type="button" data-rm="${i}" aria-label="Remove ${esc(v)}">${icon('x')}</button></span>`));
        jobChanged();
    };
    const add = text => {
        text.split(/[,\n]/).map(s => s.trim()).filter(Boolean).forEach(v => {
            if (!items.some(x => x.toLowerCase() === v.toLowerCase())) items.push(v);
        });
        render();
    };
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(input.value); input.value = ''; }
        else if (e.key === 'Backspace' && !input.value && items.length) { items.pop(); render(); }
    });
    input.addEventListener('blur', () => { if (input.value.trim()) { add(input.value); input.value = ''; } });
    input.addEventListener('paste', e => {
        const text = e.clipboardData.getData('text');
        if (/[,\n]/.test(text)) { e.preventDefault(); add(text); }
    });
    box.addEventListener('click', e => {
        const rm = e.target.closest('[data-rm]');
        if (rm) { items.splice(+rm.dataset.rm, 1); render(); } else input.focus();
    });
    return { get: () => [...items], set: list => { items = []; add((list || []).join('\n')); } };
}

const skills = tagField('skills'), keywords = tagField('keywords');
const weights = () => Object.fromEntries($$('[data-w]').map(r => [r.dataset.w, +r.value]));
const criteria = () => JSON.stringify([jd.value.trim(), skills.get(), keywords.get()]);

function jobChanged() {
    store.set('job', { jd: jd.value, skills: skills.get(), keywords: keywords.get(), minExp: minExp.value, weights: weights(), threshold: +threshold.value });
    $('#stale').hidden = !state.results.length || criteria() === state.criteria;
    renderChecklist();
}

// Weights are relative, so each slider shows its share of the overall score.
function syncScoring() {
    const w = weights(), total = Object.values(w).reduce((a, b) => a + b, 0) || 1;
    $$('#view-setup input[type=range]').forEach(r => r.style.setProperty('--p', r.value + '%'));
    for (const r of $$('[data-w]')) {
        $('output', r.parentElement).value = Math.round(100 * w[r.dataset.w] / total) + '%';
        $(`.dist [data-seg="${r.dataset.w}"]`).style.width = (100 * w[r.dataset.w] / total) + '%';
    }
    $('#thresholdOut').value = threshold.value + '%';
    $('#thresholdText').textContent = threshold.value;
}

function renderChecklist() {
    const words = jd.value.trim() ? jd.value.trim().split(/\s+/).length : 0;
    const total = totalQueued(), nSkills = skills.get().length, nKeywords = keywords.get().length;
    const rows = [
        ['Job description', words ? plural(words, 'word') : 'Empty', words > 0],
        ['Required skills', nSkills, nSkills > 0],
        ['Keywords', nKeywords, nKeywords > 0],
        ['Minimum experience', minExp.value ? `${minExp.value} years` : 'Optional', !!minExp.value],
        ['Resumes', total, total > 0],
    ];
    $('#checklist').innerHTML = rows.map(([label, value, ok]) =>
        `<li><i class="dot${ok ? ' ok' : ''}">${ok ? icon('check') : ''}</i><span>${label}</span><b>${esc(value)}</b></li>`).join('');
    $('#runBtn').disabled = state.running || !total || !(words || nSkills || nKeywords);
}

function applyJob(job) {
    jd.value = job.jd || '';
    skills.set(job.skills);
    keywords.set(job.keywords);
    minExp.value = job.minExp ?? '';
    for (const r of $$('[data-w]')) if (job.weights?.[r.dataset.w] != null) r.value = job.weights[r.dataset.w];
    if (job.threshold != null) threshold.value = job.threshold;
    syncScoring();
    updateCount();
    jobChanged();
}

function updateCount() {
    const words = jd.value.trim() ? jd.value.trim().split(/\s+/).length : 0;
    $('#jdCount').textContent = plural(words, 'word');
}

jd.addEventListener('input', () => { updateCount(); jobChanged(); });
minExp.addEventListener('input', () => { jobChanged(); renderResults(); });
$$('#view-setup input[type=range]').forEach(r => r.addEventListener('input', () => { syncScoring(); jobChanged(); renderResults(); }));
syncScoring();

// --- Resumes -----------------------------------------------------------------------------------------------------

const SUPPORTED = /\.(pdf|docx|txt|md)$/i;
const totalQueued = () => state.files.length + state.paths.reduce((sum, p) => sum + p.count, 0);
const fmtSize = b => b < 1024 ? `${b} B` : b < 1048576 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1)} MB`;

function addFiles(list) {
    let skipped = 0;
    for (const f of list) {
        if (!SUPPORTED.test(f.name)) { skipped++; continue; }
        if (!state.files.some(x => x.name === f.name && x.size === f.size)) state.files.push(f);
    }
    if (skipped) toast(`Skipped ${plural(skipped, 'file')} (only PDF, DOCX, TXT and MD are supported).`, 'warn');
    renderSources();
}

// Dropped folders arrive as directory entries; walk them to get the files.
async function filesFromDrop(dt) {
    const entries = [...dt.items].map(i => i.webkitGetAsEntry?.()).filter(Boolean);
    if (!entries.length) return [...dt.files];
    const out = [];
    const walk = async entry => {
        if (entry.isFile) out.push(await new Promise((res, rej) => entry.file(res, rej)));
        else if (entry.isDirectory) {
            const reader = entry.createReader();
            for (let batch; (batch = await new Promise((res, rej) => reader.readEntries(res, rej))).length;) {
                for (const e of batch) await walk(e);
            }
        }
    };
    for (const e of entries) await walk(e);
    return out;
}

async function addPath(raw) {
    const path = raw.trim().replace(/^"|"$/g, '');
    if (!path) return toast('Enter a folder path or click Choose.', 'warn');
    if (state.paths.some(p => p.path === path)) return toast('Folder already added.');
    try {
        const { count } = await api('/api/scan', { path });
        state.paths.push({ path, count });
        $('#pathInput').value = '';
        renderSources();
        if (!count) toast('No PDF, DOCX or TXT files in that folder.', 'warn');
    } catch (e) { toast(e.message, 'error'); }
}

function renderSources() {
    const items = [
        ...state.paths.map((p, i) => ({ key: `path:${i}`, icon: 'folder', name: p.path, meta: `Folder · ${plural(p.count, 'resume')}` })),
        ...state.files.map((f, i) => ({ key: `file:${i}`, icon: 'file', name: f.name, meta: `${f.name.split('.').pop().toUpperCase()} · ${fmtSize(f.size)}` })),
    ];
    const total = totalQueued();
    $('#sources').hidden = !items.length;
    $('#queueCount').textContent = `${total} queued`;
    $('#sourcesTotal').textContent = `${plural(total, 'resume')} queued`;
    $('#sourceList').innerHTML = items.map(it => `<li><span class="src-icon">${icon(it.icon)}</span>
        <span class="src-body"><span class="src-name" title="${esc(it.name)}">${esc(it.name)}</span><span class="src-meta">${esc(it.meta)}</span></span>
        <button class="icon-btn" data-src="${it.key}" aria-label="Remove ${esc(it.name)}">${icon('x')}</button></li>`).join('');
    renderChecklist();
}

const dropzone = $('#dropzone');
$('#fileInput').addEventListener('change', e => { addFiles(e.target.files); e.target.value = ''; });
['dragenter', 'dragover'].forEach(t => dropzone.addEventListener(t, e => { e.preventDefault(); dropzone.classList.add('over'); }));
['dragleave', 'drop'].forEach(t => dropzone.addEventListener(t, () => dropzone.classList.remove('over')));
dropzone.addEventListener('drop', async e => { e.preventDefault(); addFiles(await filesFromDrop(e.dataTransfer)); });
window.addEventListener('dragover', e => e.preventDefault()); // don't navigate away on a missed drop
window.addEventListener('drop', e => e.preventDefault());

$('#addPathBtn').onclick = () => addPath($('#pathInput').value);
$('#pathInput').addEventListener('keydown', e => { if (e.key === 'Enter') addPath(e.target.value); });
$('#browseBtn').onclick = async e => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
        const { path } = await api('/api/browse');
        if (path) await addPath(path);
    } catch (err) { toast(err.message, 'error'); }
    btn.disabled = false;
};
$('#sourceList').addEventListener('click', e => {
    const btn = e.target.closest('[data-src]');
    if (!btn) return;
    const [kind, i] = btn.dataset.src.split(':');
    state[kind === 'path' ? 'paths' : 'files'].splice(+i, 1);
    renderSources();
});
$('#clearSources').onclick = () => { state.files = []; state.paths = []; renderSources(); };

// --- Screening ---------------------------------------------------------------------------------------------------

function progress(fraction, text) {
    $('#progress').hidden = false;
    $('#progressFill').style.width = `${Math.round(fraction * 100)}%`;
    $('#progressText').textContent = text;
}

async function run() {
    if (!totalQueued()) { location.hash = '#setup'; return toast('Add at least one resume.', 'error'); }
    if (!jd.value.trim() && !skills.get().length && !keywords.get().length) {
        location.hash = '#setup';
        return toast('Add a job description, required skills or keywords.', 'error');
    }
    const body = new FormData();
    state.files.forEach(f => body.append('files', f, f.name));
    body.append('config', JSON.stringify({ jd: jd.value, skills: skills.get(), keywords: keywords.get(), paths: state.paths.map(p => p.path) }));
    const snapshot = criteria();

    location.hash = '#setup';
    state.running = true;
    renderChecklist();
    progress(0.02, state.files.length ? 'Uploading…' : 'Reading folders…');
    try {
        const res = await fetch('/api/screen', { method: 'POST', body });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Screening failed (${res.status})`);
        const reader = res.body.getReader(), decoder = new TextDecoder();
        let buffer = '';
        for (;;) {
            const { value, done } = await reader.read();
            buffer += decoder.decode(value, { stream: !done });
            let nl;
            while ((nl = buffer.indexOf('\n')) >= 0) {
                onEvent(JSON.parse(buffer.slice(0, nl)), snapshot);
                buffer = buffer.slice(nl + 1);
            }
            if (done) break;
        }
    } catch (e) {
        toast(e.message === 'Failed to fetch' ? 'Cannot reach the server. Is it still running?' : e.message, 'error');
    }
    state.running = false;
    renderChecklist();
    setTimeout(() => { $('#progress').hidden = true; }, 400);
}

function onEvent(ev, snapshot) {
    if (ev.type === 'progress') return progress((ev.done + 0.5) / ev.total, `Reading ${ev.done + 1} of ${ev.total}: ${ev.file}`);
    progress(1, 'Done');
    Object.assign(state, { results: ev.results, criteria: snapshot, open: null, finishedAt: new Date(), duplicates: ev.duplicates });
    state.filter = score(ev.results).some(r => r.short) ? 'short' : 'all';
    $('#search').value = '';
    renderResults();
    jobChanged();
    location.hash = '#results';
    window.scrollTo(0, 0);
    const unreadable = ev.results.filter(r => r.error).length;
    if (unreadable) toast(`${plural(unreadable, 'file')} had no readable text (scanned PDFs need OCR).`, 'warn');
}

$('#runBtn').onclick = run;
$('#rerunBtn').onclick = run;

// --- Results -----------------------------------------------------------------------------------------------------

const pct = t => { const n = t.matched.length + t.missing.length; return n ? Math.round(100 * t.matched.length / n) : null; };
const stem = name => name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
const initials = s => s.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
const avatar = (name, cls = '') => `<span class="avatar ${cls}">${esc(initials(name))}</span>`;
const fmtExp = r => r.experience_years == null ? '–' : `${r.experience_years} yrs`;
const tone = (value, th) => value >= th ? 'good' : value >= th - 15 ? 'mid' : 'low';

// Final score is computed client-side so weight/threshold changes re-rank without re-reading files.
function score(results) {
    const w = weights(), min = parseFloat(minExp.value) || 0, th = +threshold.value;
    const rows = results.map(r => {
        const sk = pct(r.skills), kw = pct(r.keywords);
        const exp = min > 0 ? Math.min(100, Math.round(100 * (r.experience_years || 0) / min)) : null;
        const parts = [[w.jd, r.jd_score], [w.skills, sk], [w.keywords, kw], [w.exp, exp]].filter(([, v]) => v != null);
        const total = parts.reduce((s, [x]) => s + x, 0);
        const overall = r.error || !total ? 0 : Math.round(parts.reduce((s, [x, v]) => s + x * v, 0) / total);
        return { ...r, sk, kw, exp, score: overall, short: !r.error && overall >= th, display: r.candidate || stem(r.name) };
    });
    rows.sort((a, b) => b.score - a.score || a.display.localeCompare(b.display)).forEach((r, i) => { r.rank = i + 1; });
    return rows;
}

const SORTS = {
    rank: r => r.rank, candidate: r => r.display.toLowerCase(), score: r => r.score, jd: r => r.jd_score,
    skills: r => r.sk, keywords: r => r.kw, exp: r => r.experience_years,
};

function ratio(t) {
    const n = t.matched.length + t.missing.length;
    return n ? `<span class="num">${t.matched.length}<span class="dim"> / ${n}</span></span>` : '<span class="dim">–</span>';
}

function rowHTML(r, th) {
    const status = r.error ? '<span class="badge warn">Unreadable</span>'
        : r.short ? '<span class="badge good">Shortlisted</span>' : '<span class="badge">Below threshold</span>';
    return `<tr data-id="${r.id}" tabindex="0">
        <td class="rank">${r.rank}</td>
        <td><div class="cand">${avatar(r.display)}<div><strong>${esc(r.display)}</strong><small>${esc(r.email || r.name)}</small></div></div></td>
        <td><div class="score ${tone(r.score, th)}"><b>${r.score}</b><span class="meter"><i style="width:${r.score}%"></i></span></div></td>
        <td class="num">${r.jd_score == null ? '<span class="dim">–</span>' : r.jd_score + '%'}</td>
        <td>${ratio(r.skills)}</td>
        <td>${ratio(r.keywords)}</td>
        <td class="num">${fmtExp(r)}</td>
        <td>${status}</td>
        <td class="actions"><a class="icon-btn" href="/api/files/${r.id}" target="_blank" rel="noopener" title="Open file">${icon('external')}</a><a class="icon-btn" href="/api/files/${r.id}?download=1" title="Download">${icon('download')}</a></td>
    </tr>`;
}

function renderResults() {
    const has = state.results.length > 0;
    $('#noResults').hidden = has;
    $('#resultsBody').hidden = !has;
    $('#resultActions').hidden = !has;
    if (!has) return;

    const th = +threshold.value;
    const rows = state.view = score(state.results);
    const short = rows.filter(r => r.short);
    const readable = rows.filter(r => !r.error);
    const time = state.finishedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    $('#runMeta').textContent = `${plural(rows.length, 'resume')} screened at ${time}` + (state.duplicates ? `, ${plural(state.duplicates, 'duplicate')} skipped` : '');
    $('#tabCount').hidden = false;
    $('#tabCount').textContent = short.length;
    $('#kTotal').textContent = rows.length;
    $('#kTotalSub').textContent = rows.length === readable.length ? 'all readable' : `${rows.length - readable.length} unreadable`;
    $('#kShort').textContent = short.length;
    $('#kShortSub').textContent = `score ${th} or higher`;
    $('#kAvg').textContent = readable.length ? Math.round(readable.reduce((s, r) => s + r.score, 0) / readable.length) : '–';
    $('#kTop').textContent = rows[0] ? rows[0].score : '–';
    $('#kTopSub').textContent = rows[0] ? rows[0].display : '';
    $('#cAll').textContent = rows.length;
    $('#cShort').textContent = short.length;
    $('#cRest').textContent = rows.length - short.length;
    $('#zipBtn').disabled = !short.length;
    $('#zipBtn span').textContent = `Download shortlisted (${short.length})`;
    $$('#filters button').forEach(b => b.classList.toggle('on', b.dataset.f === state.filter));

    const q = $('#search').value.trim().toLowerCase();
    const { key, dir } = state.sort;
    const list = rows
        .filter(r => state.filter === 'all' || (state.filter === 'short') === r.short)
        .filter(r => !q || [r.display, r.name, r.email, ...r.skills.matched, ...r.keywords.matched].join(' ').toLowerCase().includes(q))
        .sort((a, b) => {
            const x = SORTS[key](a), y = SORTS[key](b);
            if (x == null || y == null) return (x == null) - (y == null);
            return (x > y ? 1 : x < y ? -1 : 0) * dir;
        });
    $('#table tbody').innerHTML = list.map(r => rowHTML(r, th)).join('');
    $('#empty').hidden = list.length > 0;
    $$('#table th[data-sort]').forEach(h => {
        h.classList.toggle('sorted', h.dataset.sort === key);
        h.classList.toggle('asc', h.dataset.sort === key && dir === 1);
    });
    if (state.open) renderDrawer();
}

$('#filters').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    state.filter = b.dataset.f;
    renderResults();
});
$('#search').addEventListener('input', renderResults);
$$('#table th[data-sort]').forEach(h => h.addEventListener('click', () => {
    const key = h.dataset.sort;
    state.sort = state.sort.key === key ? { key, dir: -state.sort.dir } : { key, dir: key === 'rank' || key === 'candidate' ? 1 : -1 };
    renderResults();
}));
$('#table tbody').addEventListener('click', e => {
    const tr = e.target.closest('tr');
    if (tr && !e.target.closest('a')) openDrawer(tr.dataset.id);
});
$('#table tbody').addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.matches('tr')) openDrawer(e.target.dataset.id);
});

$('#csvBtn').onclick = () => {
    const cell = v => {
        let s = String(v ?? '');
        if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // CSV formula injection guard
        return `"${s.replace(/"/g, '""')}"`;
    };
    const head = ['Rank', 'Candidate', 'File', 'Score', 'Status', 'JD match %', 'Skills %', 'Keywords %', 'Experience (years)',
        'Email', 'Phone', 'LinkedIn', 'Matched skills', 'Missing skills', 'Matched keywords', 'Missing keywords'];
    const lines = state.view.map(r => [r.rank, r.display, r.name, r.score, r.error ? 'Unreadable' : r.short ? 'Shortlisted' : 'Below threshold',
        r.jd_score, r.sk, r.kw, r.experience_years, r.email, r.phone, r.linkedin,
        r.skills.matched.join('; '), r.skills.missing.join('; '), r.keywords.matched.join('; '), r.keywords.missing.join('; ')]);
    const csv = [head, ...lines].map(row => row.map(cell).join(',')).join('\r\n');
    saveFile(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), `screening-${new Date().toISOString().slice(0, 10)}.csv`);
};

$('#zipBtn').onclick = async e => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
        const ids = state.view.filter(r => r.short).map(r => r.id);
        const res = await fetch('/api/zip', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) });
        if (!res.ok) throw new Error('Could not build the zip. If the server was restarted, run the screening again.');
        saveFile(await res.blob(), 'shortlisted-resumes.zip');
    } catch (err) { toast(err.message, 'error'); }
    btn.disabled = false;
};

// --- Candidate drawer --------------------------------------------------------------------------------------------

const drawer = $('#drawer'), scrim = $('#scrim');

function highlight(text, terms) {
    const html = esc(text);
    if (!terms.length) return html;
    const alts = terms.map(t => esc(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')).join('|');
    return html.replace(new RegExp(`(?<![a-z0-9&])(?:${alts})(?:e?s)?(?![a-z0-9])`, 'gi'), '<mark>$&</mark>');
}

const bar = (label, v, th) => `<div class="bar ${v == null ? '' : tone(v, th)}"><div><span>${label}</span><b>${v == null ? '<span class="dim">n/a</span>' : v + '%'}</b></div>
    <span class="meter"><i style="width:${v || 0}%"></i></span></div>`;

function chips(title, t) {
    const n = t.matched.length + t.missing.length;
    if (!n) return '';
    return `<section><h4>${title} <span>${t.matched.length} of ${n}</span></h4><div class="chips">
        ${t.matched.map(s => `<span class="chip hit">${icon('check')}${esc(s)}</span>`).join('')}
        ${t.missing.map(s => `<span class="chip">${icon('x')}${esc(s)}</span>`).join('')}</div></section>`;
}

function renderDrawer() {
    const r = state.view.find(x => x.id === state.open);
    if (!r) return closeDrawer();
    const th = +threshold.value;
    const linkedin = r.linkedin && (/^https?:\/\//i.test(r.linkedin) ? r.linkedin : 'https://' + r.linkedin);
    const exp = r.experience_years == null ? 'Experience not found'
        : `${r.experience_years} years ${r.experience_source === 'stated' ? '(stated)' : '(from job dates)'}`;
    drawer.innerHTML = `
        <header class="d-head">${avatar(r.display, 'lg')}
            <div><h3>${esc(r.display)}</h3><p>${esc(r.name)} · ${esc(r.format)} · ${plural(r.words, 'word')}</p></div>
            <button class="icon-btn" id="dClose" aria-label="Close">${icon('x')}</button>
        </header>
        <div class="d-body">
            ${r.error ? `<div class="alert">${icon('alert')}${esc(r.error)}</div>` : ''}
            <div class="d-score">
                <div class="ring ${tone(r.score, th)}"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52"/><circle cx="60" cy="60" r="52" pathLength="100" stroke-dasharray="${r.score} 100"/></svg>
                    <div><b>${r.score}</b><span>Rank ${r.rank} of ${state.view.length}</span></div></div>
                <div class="d-bars">${bar('JD match', r.jd_score, th)}${bar('Required skills', r.sk, th)}${bar('Keywords', r.kw, th)}${bar('Experience vs. minimum', r.exp, th)}</div>
            </div>
            <div class="d-contact">
                ${r.email ? `<a href="mailto:${esc(r.email)}">${icon('mail')}${esc(r.email)}</a>` : ''}
                ${r.phone ? `<a href="tel:${esc(r.phone.replace(/[^\d+]/g, ''))}">${icon('phone')}${esc(r.phone)}</a>` : ''}
                ${linkedin ? `<a href="${esc(linkedin)}" target="_blank" rel="noopener">${icon('link')}LinkedIn</a>` : ''}
                <span>${icon('briefcase')}${exp}</span>
            </div>
            ${chips('Required skills', r.skills)}
            ${chips('Keywords', r.keywords)}
            ${r.jd_missing.length ? `<section><h4>JD terms not found</h4><div class="chips">${r.jd_missing.map(t => `<span class="chip">${esc(t)}</span>`).join('')}</div></section>` : ''}
            ${r.text ? `<section><h4>Resume text</h4><div class="resume-text">${highlight(r.text, [...r.skills.matched, ...r.keywords.matched])}</div></section>` : ''}
        </div>
        <footer class="d-foot">
            <a class="btn" href="/api/files/${r.id}" target="_blank" rel="noopener">${icon('external')} Open file</a>
            <a class="btn primary" href="/api/files/${r.id}?download=1">${icon('download')} Download</a>
        </footer>`;
    $('#dClose').onclick = closeDrawer;
}

function openDrawer(id) {
    const fresh = state.open !== id;
    state.open = id;
    renderDrawer();
    if (fresh) $('.d-body', drawer).scrollTop = 0;
    drawer.classList.add('open');
    scrim.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    $('#dClose').focus({ preventScroll: true });
}

function closeDrawer() {
    if (!state.open) return;
    const row = $(`tr[data-id="${state.open}"]`);
    state.open = null;
    drawer.classList.remove('open');
    scrim.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    row?.focus({ preventScroll: true });
}

scrim.onclick = closeDrawer;
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

// --- Init --------------------------------------------------------------------------------------------------------

const savedJob = store.get('job');
if (savedJob) applyJob(savedJob);
renderSources();
route();
