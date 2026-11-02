// Record & compare (BRIEF §5.7): record yourself, play it back, hear the model. Everything stays in memory:
// the recording is a Blob URL that is revoked as soon as it is replaced or the screen goes away. Nothing is saved.

export function recordingSupported() {
  return typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

/**
 * One recorder per widget.
 * @returns {{ start(): Promise<void>, stop(): Promise<string>, play(): Promise<void>, hasRecording(): boolean, dispose(): void }}
 */
export function createRecorder() {
  let stream = null;
  let rec = null;
  let chunks = [];
  let url = null;
  let audio = null;

  const releaseMic = () => {
    stream?.getTracks().forEach((t) => t.stop()); // switches the phone's recording indicator off
    stream = null;
  };
  const forget = () => {
    audio?.pause();
    audio = null;
    if (url) URL.revokeObjectURL(url);
    url = null;
  };

  return {
    /** Throws if the microphone is blocked. */
    async start() {
      forget();
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks = [];
      rec = new MediaRecorder(stream);
      rec.addEventListener('dataavailable', (e) => e.data.size && chunks.push(e.data));
      rec.start();
    },
    stop() {
      return new Promise((resolve, reject) => {
        if (!rec || rec.state === 'inactive') return reject(new Error('Not recording'));
        rec.addEventListener(
          'stop',
          () => {
            releaseMic();
            const type = rec.mimeType || chunks[0]?.type || 'audio/webm';
            url = URL.createObjectURL(new Blob(chunks, { type }));
            chunks = [];
            resolve(url);
          },
          { once: true },
        );
        rec.stop();
      });
    },
    play() {
      if (!url) return Promise.resolve();
      audio?.pause();
      audio = new Audio(url);
      return new Promise((resolve) => {
        audio.addEventListener('ended', () => resolve(), { once: true });
        audio.addEventListener('error', () => resolve(), { once: true });
        audio.play().catch(() => resolve());
      });
    },
    hasRecording: () => !!url,
    dispose() {
      if (rec && rec.state !== 'inactive') {
        try {
          rec.stop();
        } catch {
          /* already stopped */
        }
      }
      releaseMic();
      forget();
    },
  };
}
