// ...existing code...
'use strict';

const statusEl = document.getElementById('status');
const contentEl = document.getElementById('lesson-content');
const titleEl = document.getElementById('lesson-title');
const previewEl = document.getElementById('lesson-preview');
const previewBtn = document.getElementById('preview-btn');
const speakBtn = document.getElementById('speak-btn');

const addQBtn = document.getElementById('add-question');
const questionsEl = document.getElementById('questions');
const exportBtn = document.getElementById('export-assign');
const downloadBtn = document.getElementById('download-assign');
const assignTitleEl = document.getElementById('assign-title');

const fileInput = document.getElementById('file-input');
const scanBtn = document.getElementById('scan-btn');
const scanResult = document.getElementById('scan-result');

let questions = [];

/* Sanitization & Preview */
previewBtn?.addEventListener('click', () => {
  const raw = contentEl.value || '';
  const clean = DOMPurify.sanitize(raw, {ALLOWED_TAGS: ['b','i','strong','em','p','ul','ol','li','a','h1','h2','h3','br','img'], ALLOWED_ATTR: ['href','src','alt','title']});
  previewEl.innerHTML = `<h2>${escapeHtml(titleEl.value || '')}</h2>${clean}`;
  statusEl.textContent = 'Preview updated (sanitized)';
});

/* Text-to-Speech (no personal data sent) */
speakBtn?.addEventListener('click', async () => {
  const text = (titleEl.value + '\n' + stripTags(contentEl.value || '')).trim();
  if (!text) { statusEl.textContent = 'Nothing to read'; return; }
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 1;
  speechSynthesis.cancel();
  speechSynthesis.speak(utter);
  statusEl.textContent = 'Reading lesson aloud';
});

/* Assignment builder */
addQBtn?.addEventListener('click', () => {
  const idx = questions.length;
  const q = { id: idx, text: '', points: 1 };
  questions.push(q);
  renderQuestions();
});

function renderQuestions(){
  questionsEl.innerHTML = '';
  questions.forEach(q => {
    const wrapper = document.createElement('div');
    wrapper.className = 'card';
    wrapper.innerHTML = `
      <label>Question</label>
      <input data-id="${q.id}" class="q-text" type="text" value="${escapeHtmlAttr(q.text)}" />
      <label>Points</label>
      <input data-id="${q.id}" class="q-points" type="number" min="0" value="${q.points}" />
      <div class="controls">
        <button data-action="remove" data-id="${q.id}">Remove</button>
      </div>
    `;
    questionsEl.appendChild(wrapper);
  });
  // bind
  document.querySelectorAll('.q-text').forEach(i => i.addEventListener('input', e => {
    const id = +e.target.dataset.id; questions[id].text = e.target.value;
  }));
  document.querySelectorAll('.q-points').forEach(i => i.addEventListener('input', e => {
    const id = +e.target.dataset.id; questions[id].points = Number(e.target.value) || 0;
  }));
  document.querySelectorAll('button[data-action="remove"]').forEach(b => b.addEventListener('click', e => {
    const id = +e.target.dataset.id;
    questions = questions.filter(q => q.id !== id);
    renderQuestions();
  }));
}

exportBtn?.addEventListener('click', () => {
  const payload = {
    title: assignTitleEl.value,
    createdAt: new Date().toISOString(),
    questions: questions.map(q => ({ text: q.text, points: q.points }))
  };
  // sanitized export (no HTML)
  const clean = JSON.stringify(payload);
  navigator.clipboard?.writeText(clean).then(() => statusEl.textContent = 'Assignment JSON copied to clipboard');
});

downloadBtn?.addEventListener('click', () => {
  const payload = {
    title: assignTitleEl.value,
    createdAt: new Date().toISOString(),
    questions: questions.map(q => ({ text: q.text, points: q.points }))
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${(assignTitleEl.value||'assignment').replace(/\s+/g,'_')}.json`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  statusEl.textContent = 'Assignment downloaded';
});

/* File scan: compute SHA-256 locally and send to server for real scanning */
scanBtn?.addEventListener('click', async () => {
  const file = fileInput.files?.[0];
  if (!file) { scanResult.textContent = 'No file selected'; return; }
  scanResult.textContent = 'Computing hash...';
  const hash = await fileSha256(file);
  scanResult.textContent = `SHA-256: ${hash} — sending to server for scan...`;
  try {
    // server endpoint must perform actual virus scanning; this client posts the file or its hash
    const form = new FormData();
    form.append('file', file);
    const resp = await fetch('/api/scan', { method: 'POST', body: form });
    const json = await resp.json();
    scanResult.textContent = json.result || 'Scan complete';
    statusEl.textContent = 'Scan finished';
  } catch (err) {
    scanResult.textContent = 'Scan failed — server unavailable. Implement server-side AV (ClamAV/VirusTotal).';
  }
});

/* Utilities */
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c])); }
function escapeHtmlAttr(s){ return (s||'').replace(/"/g,'&quot;'); }
function stripTags(s){ return s.replace(/<\/?[^>]+(>|$)/g, ""); }

async function fileSha256(file){
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('');
}

/* Prevent risky browser APIs from running unexpectedly */
if (window.eval) { try { window.eval = undefined; } catch(e){} }

statusEl.textContent = 'Ready (client-side security: sanitization, no-eval).';
// ...existing code...