/** Web speech input via the browser's SpeechRecognition (Chrome/Edge/Safari), Vietnamese. */
import { useRef, useState } from 'react';

import type { VoiceInput } from './useVoice';

interface Rec {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

function ctor(): (new () => Rec) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useVoice(): VoiceInput {
  const Ctor = ctor();
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Rec | null>(null);

  return {
    supported: !!Ctor,
    listening,
    error,
    start(onText) {
      if (!Ctor) return;
      setError(null);
      const r = new Ctor();
      r.lang = 'vi-VN';
      r.interimResults = true;
      r.continuous = false;
      r.onresult = (e) => {
        let text = '';
        let final = false;
        for (let i = 0; i < e.results.length; i++) {
          text += e.results[i][0].transcript;
          final = e.results[i].isFinal;
        }
        onText(text.trim(), final);
      };
      r.onerror = (e) => setError(e.error);
      r.onend = () => setListening(false);
      rec.current = r;
      setListening(true);
      try {
        r.start();
      } catch {
        setListening(false);
      }
    },
    stop() {
      rec.current?.stop();
    },
  };
}
