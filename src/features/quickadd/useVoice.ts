/** Native stub: speech input on Android/iOS arrives in M4 (expo-speech-recognition). */
export interface VoiceInput {
  supported: boolean;
  listening: boolean;
  error: string | null;
  start(onText: (text: string, final: boolean) => void): void;
  stop(): void;
}

export function useVoice(): VoiceInput {
  return { supported: false, listening: false, error: null, start() {}, stop() {} };
}
