// #/debug/voices — lists every speechSynthesis voice on this device so we can
// see what is really available (especially on iPhone) before deciding whether
// pre-generated audio is needed (PLAN D2). Reads nothing from storage.
import { h } from '../../ui/dom.js';
import { isUrduVoice, isHindiVoice, loadVoices, formatReport, speechSupported } from '../../audio/voices.js';
import { romanToDevanagari } from '../../lang/devanagari.js';

const SAMPLE = { ur: 'میں ٹھیک ہوں', roman: 'maiN Thiik huuN' };

export function render(container) {
  const summary = h('div', { class: 'card', role: 'status' }, 'Looking for voices…');
  const list = h('div', { class: 'voice-list' });
  const report = h('pre', { class: 'report', hidden: true });
  const copyBtn = h('button', { class: 'btn', onclick: copy, disabled: true }, 'Copy report');
  const rescanBtn = h('button', { class: 'btn btn-secondary', onclick: scan }, 'Scan again');
  let voices = [];
  let alive = true;

  // Hindi fallback test box (PLAN D13): type Roman Urdu, see the Devanagari, hear it.
  const input = h('textarea', { class: 'field', rows: '2', lang: 'ur-Latn', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false', 'aria-label': 'Roman Urdu' });
  input.value = SAMPLE.roman;
  const loanInput = h('input', { class: 'field', type: 'text', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false', 'aria-label': 'Loanwords', value: 'phone, bus, tv, doctor' });
  const converted = h('div', { class: 'card deva', lang: 'hi' });
  const hindiNote = h('p', { class: 'muted' });
  const hearBtn = h('button', { class: 'btn', onclick: hear }, 'Hear it (Hindi voice)');
  const loanwords = () => loanInput.value.split(/[,\s]+/).filter(Boolean);
  const convert = () => romanToDevanagari(input.value, { loanwords: loanwords() });
  const refreshConverted = () => {
    converted.textContent = convert() || '…';
  };
  input.addEventListener('input', refreshConverted);
  loanInput.addEventListener('input', refreshConverted);

  container.append(
    h(
      'main',
      { class: 'page' },
      h('a', { href: '#', class: 'back' }, '‹ Back'),
      h('h1', {}, 'Voice test'),
      h('p', { class: 'muted' }, 'Lists the text-to-speech voices on this device. The app prefers a voice whose language starts with “ur”, and falls back to a Hindi (“hi”) voice reading converted text.'),
      summary,
      h('div', { class: 'row' }, rescanBtn, copyBtn),
      list,
      h(
        'section',
        { class: 'stack' },
        h('h2', {}, 'Hindi fallback'),
        h('p', { class: 'muted' }, 'With no Urdu voice, the app converts the Roman Urdu to Devanagari and has a Hindi voice read it. Type Roman Urdu to judge the result.'),
        input,
        h('label', { class: 'muted' }, 'Loanwords (left as English): '),
        loanInput,
        converted,
        hindiNote,
        hearBtn,
      ),
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
      !supported || urdu.length ? null : h('p', {}, 'The app will use the Hindi fallback below if there is a Hindi voice.'),
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

    const hindi = voices.filter(isHindiVoice);
    hearBtn.disabled = !hindi.length;
    hindiNote.textContent = hindi.length ? `Will use: ${hindi[0].name} (${hindi[0].lang}).` : 'No Hindi voice on this device either, so there is nothing to read the text aloud.';

    report.textContent = formatReport(voices, { userAgent: navigator.userAgent, supported });
    report.hidden = false;
    copyBtn.disabled = false;
  }

  function hear() {
    if (!speechSupported()) return;
    const hindi = voices.filter(isHindiVoice);
    const voice = hindi.find((v) => v.localService) ?? hindi[0];
    if (!voice) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(convert());
    u.voice = voice;
    u.lang = voice.lang;
    synth.speak(u);
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

  refreshConverted();
  scan();
  return () => {
    alive = false;
    if (speechSupported()) window.speechSynthesis.cancel();
  };
}
