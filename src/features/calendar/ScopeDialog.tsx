/** "This event / this and following / all events" for recurring series. */
import { View } from 'react-native';

import type { EditScope } from '@/core/recurrence/edit';
import { useT } from '@/i18n';
import { Button, Dialog } from '@/ui/primitives';

import { applyScope } from './actions';
import { useUi } from './ui-store';

export function ScopeDialog() {
  const T = useT();
  const prompt = useUi((s) => s.scopePrompt);
  if (!prompt) return null;
  const close = () => useUi.getState().setScopePrompt(null);
  const options: [EditScope, string][] = [
    ['this', T('scopeThis')],
    ['following', T('scopeFollowing')],
    ['all', T('scopeAll')],
  ];
  return (
    <Dialog
      visible
      onClose={close}
      title={prompt.kind === 'edit' ? T('scopeTitleEdit') : T('scopeTitleDelete')}
      width={380}
      footer={<Button label={T('cancel')} onPress={close} />}
    >
      <View style={{ gap: 8 }}>
        {options.map(([scope, label], i) => (
          <Button
            key={scope}
            label={label}
            variant={i === 0 ? 'primary' : prompt.kind === 'delete' && scope === 'all' ? 'danger' : 'secondary'}
            onPress={() => applyScope(scope)}
            style={{ justifyContent: 'flex-start', paddingHorizontal: 14 }}
          />
        ))}
      </View>
    </Dialog>
  );
}
