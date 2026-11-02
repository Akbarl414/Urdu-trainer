// #/debug/voices — lists every speechSynthesis voice on this device so we can
// see what is really available (especially on iPhone) before deciding whether
// pre-generated audio is needed (PLAN D2). Reads nothing from storage.
import { h } from '../../ui/dom.js';
import { isUrduVoice, loadVoices, formatReport, speechSupported } from '../../audio/voices.js';

const SAMPLE = { ur: 'میں ٹھیک ہوں', roman: 'maiN Thiik huuN' };

export function render(container) {
  const summary = h('div', { class: 'card', role: 'status' }, 'Looking for voices…');
  const list = h('div', { class: 'voice-list' });
  const report = h('pre', { class: 'report', hidden: true });
  const copyBtn = h('button', { class: 'btn', onclick: copy, disabled: true }, 'Copy report');
  const rescanBtn = h('button', { class: 'btn btn-secondary', onclick: scan }, 'Scan again');
  let voices = [];
  let alive = true;

  container.append(
    h(
      'main',
      { class: 'page' },
      h('a', { href: '#', class: 'back' }, '‹ Back'),
      h('h1', {}, 'Voice test'),
      h('p', { class: 'muted' }, 'Lists the text-to-speech voices on this device. The app only uses voices whose language starts with “ur” (ur, ur-PK, ur-IN).'),
      summary,
      h('div', { class: 'row' }, rescanBtn, copyBtn),
      list,
      report,
    ),
  );

  async function scan() {
    summary.textContent = 'Looking for voices…';
    list.replaceChildren();
    voices = await loadVoices();
    if (!alive) return;
    draw();
  }

  function draw() {
    const supported = speechSupported();
    const urdu = voices.filter(isUrduVoice);
    summary.className = `card ${urdu.length ? 'ok' : 'warn'}`;
    summary.replaceChildren(
      h('strong', {}, !supported ? 'This browser has no speech synthesis.' : urdu.length ? `Found ${urdu.length} Urdu voice${urdu.length === 1 ? '' : 's'} (of ${voices.length} total).` : `No Urdu voice found (${voices.length} voices in total).`),
      !supported || urdu.length ? null : h('p', {}, 'The app would hide its audio buttons on this device. Tell Claude what the list below shows.'),
    );

    list.replaceChildren(
      ...[...voices]
        .sort((a, b) => Number(isUrduVoice(b)) - Number(isUrduVoice(a)) || a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name))
        .map((v) =>
          h(
            'div',
            { class: `voice ${isUrduVoice(v) ? 'voice-ur' : ''}` },
            h('div', {}, h('strong', {}, v.name), ' ', h('span', { class: 'muted' }, v.lang)),
            h('div', { class: 'muted' }, `${v.localService ? 'on-device' : 'online'}${v.default ? ' · default' : ''}`),
            isUrduVoice(v) ? h('button', { class: 'btn btn-small', onclick: () => speak(v) }, `Speak “${SAMPLE.roman}”`) : null,
          ),
        ),
    );

    report.textContent = formatReport(voices, { userAgent: navigator.userAgent, supported });
    report.hidden = false;
    copyBtn.disabled = false;
  }

  function speak(voice) {
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(SAMPLE.ur);
    u.voice = voice;
    u.lang = voice.lang;
    synth.speak(u);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(report.textContent);
      copyBtn.textContent = 'Copied';
    } catch {
      copyBtn.textContent = 'Copy failed: select the text below instead';
    }
    setTimeout(() => (copyBtn.textContent = 'Copy report'), 2500);
  }

  scan();
  return () => {
    alive = false;
    if (speechSupported()) window.speechSynthesis.cancel();
  };
}
