import { useState } from 'react';
import { View } from 'react-native';

import { useData } from '@/data/store';
import { useSync } from '@/sync/service';
import { Button, Field, Txt } from '@/ui/primitives';

/** Account + sync status. Sign-in is by one-time code sent to the email (no password to store). */
export function AccountPanel() {
  const vi = useData((s) => s.settings.locale) === 'vi';
  const { status, email: signedEmail, lastSyncAt, error, configured } = useSync();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!configured) {
    return (
      <Txt size="sm" color="textMuted">
        {vi ? 'Chưa cấu hình máy chủ đồng bộ.' : 'Sync server is not configured.'}
      </Txt>
    );
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (status !== 'signedOut') {
    const label =
      status === 'syncing'
        ? vi ? 'Đang đồng bộ…' : 'Syncing…'
        : status === 'error'
          ? error === 'offline'
            ? vi ? 'Đang offline — sẽ tự đồng bộ khi có mạng' : 'Offline — will sync when back online'
            : `${vi ? 'Lỗi đồng bộ' : 'Sync error'}: ${error}`
          : lastSyncAt
            ? `${vi ? 'Đã đồng bộ lúc' : 'Synced at'} ${new Date(lastSyncAt).toLocaleTimeString(vi ? 'vi-VN' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}`
            : vi ? 'Chưa đồng bộ' : 'Not synced yet';
    return (
      <View style={{ gap: 10 }}>
        <Txt weight="medium">{signedEmail}</Txt>
        <Txt size="sm" color={status === 'error' && error !== 'offline' ? 'danger' : 'textMuted'}>
          {label}
        </Txt>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Button size="sm" label={vi ? 'Đồng bộ ngay' : 'Sync now'} disabled={status === 'syncing'} onPress={() => void useSync.getState().syncNow()} />
          <Button size="sm" label={vi ? 'Đăng xuất' : 'Sign out'} onPress={() => void useSync.getState().signOut()} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ gap: 10, maxWidth: 360 }}>
      <Txt size="sm" color="textMuted">
        {vi
          ? 'Đăng nhập để đồng bộ giữa máy tính và điện thoại. Mã xác nhận gửi qua email, không cần mật khẩu.'
          : 'Sign in to sync between devices. A one-time code is sent by email; no password.'}
      </Txt>
      <Field
        placeholder="email@example.com"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        editable={!sent}
      />
      {sent ? (
        <Field
          placeholder={vi ? 'Mã trong email' : 'Code from email'}
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          onSubmitEditing={() => void run(() => useSync.getState().verifyCode(email.trim(), code.trim()))}
        />
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {sent ? (
          <>
            <Button
              size="sm"
              variant="primary"
              label={vi ? 'Xác nhận' : 'Verify'}
              disabled={busy || code.trim().length < 6}
              onPress={() => void run(() => useSync.getState().verifyCode(email.trim(), code.trim()))}
            />
            <Button size="sm" label={vi ? 'Đổi email' : 'Change email'} onPress={() => { setSent(false); setCode(''); }} />
          </>
        ) : (
          <Button
            size="sm"
            variant="primary"
            label={vi ? 'Gửi mã' : 'Send code'}
            disabled={busy || !email.includes('@')}
            onPress={() => void run(async () => { await useSync.getState().sendCode(email.trim()); setSent(true); })}
          />
        )}
      </View>
      {msg ? <Txt size="sm" color="danger">{msg}</Txt> : null}
    </View>
  );
}
