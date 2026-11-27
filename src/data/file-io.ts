/** Native file export/import — implemented with expo-sharing / document picker in M6. */
export async function saveTextFile(_filename: string, _text: string): Promise<void> {
  throw new Error('not-supported-yet');
}

export async function pickTextFile(): Promise<string | null> {
  throw new Error('not-supported-yet');
}
