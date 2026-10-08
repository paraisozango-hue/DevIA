let recorder = null;
let stream = null;
let stopHandler = null;
let audioContext = null;
let analyser = null;
let animationFrame = null;

export function isRecording() {
  return Boolean(recorder && recorder.state === 'recording');
}

function pickMimeType() {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

function stopVisualizer() {
  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = null;
  try { audioContext?.close(); } catch {}
  audioContext = null;
  analyser = null;
}

function startVisualizer(onLevel) {
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    const tick = () => {
      if (!analyser) return;
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const value of data) {
        const normalized = (value - 128) / 128;
        sum += normalized * normalized;
      }
      onLevel?.(Math.min(1, Math.sqrt(sum / data.length) * 3.5));
      animationFrame = requestAnimationFrame(tick);
    };
    tick();
  } catch {
    onLevel?.(0.08);
  }
}

export async function startAudioRecording({ onComplete, onLevel } = {}) {
  if (isRecording()) return;
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    throw new Error('Este navegador não suporta gravação de áudio.');
  }

  stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = pickMimeType();
  recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks = [];

  stopHandler = () => recorder?.stop();

  recorder.addEventListener('dataavailable', (event) => {
    if (event.data?.size) chunks.push(event.data);
  });

  recorder.addEventListener('stop', async () => {
    const blob = new Blob(chunks, { type: recorder?.mimeType || mimeType || 'audio/webm' });
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    stopVisualizer();
    recorder = null;
    stopHandler = null;
    if (blob.size) await onComplete?.(blob);
  }, { once: true });

  startVisualizer(onLevel);
  recorder.start();
}

export function stopAudioRecording() {
  stopHandler?.();
}

export function audioBlobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || '');
      resolve(value.includes(',') ? value.split(',')[1] : value);
    };
    reader.onerror = () => reject(new Error('Não foi possível preparar o áudio.'));
    reader.readAsDataURL(blob);
  });
}