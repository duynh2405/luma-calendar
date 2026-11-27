import { router } from 'expo-router';
import { ArrowLeftRight, Check, MoreHorizontal, Plus, Search, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { Calendar } from '@/core/model/types';
import { useData } from '@/data/store';
import { useT } from '@/i18n';
import { CalendarIcon } from '@/ui/icons';
import { Button, Divider, HoverPressable, IconButton, Txt } from '@/ui/primitives';
import { radius, space, useTheme } from '@/ui/theme';

import { createEventNow, goTo, navItems, type Section } from '../shell/nav';
import { DualMini } from './DualMini';
import { webProps } from './shared';
import { useUi } from './ui-store';

export function Sidebar({ active: section, onNavigate }: { active: Section; onNavigate?: () => void }) {
  const t = useTheme();
  const T = useT();
  const cursor = useUi((s) => s.cursor);
  const calendars = useData((s) => s.calendars);
  const [showArchived, setShowArchived] = useState(false);
  const all = Object.values(calendars)
    .filter((c) => !c.deletedAt)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const active = all.filter((c) => !c.archivedAt);
  const archived = all.filter((c) => c.archivedAt);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: space.md, gap: space.lg }}>
      <Button
        label={T('create')}
        icon={Plus}
        variant="primary"
        style={{ alignSelf: 'flex-start', paddingHorizontal: 16 }}
        onPress={() => {
          createEventNow();
          onNavigate?.();
        }}
      />
      <View style={{ gap: 2 }}>
        {navItems(T)
          .filter((n) => n.key !== 'settings')
          .map(({ key, label, icon: Icon }) => {
            const on = key === section;
            return (
              <HoverPressable
                key={key}
                accessibilityRole="link"
                accessibilityState={{ selected: on }}
                onPress={() => {
                  onNavigate?.();
                  goTo(key);
                }}
                style={({ hovered }) => [styles.calRow, (hovered || on) && { backgroundColor: on ? t.accentSoft : t.surfaceAlt }]}
              >
                <Icon size={16} color={on ? t.accent : t.textMuted} strokeWidth={on ? 2.25 : 1.75} />
                <Txt size="sm" weight={on ? 'semibold' : 'regular'} color={on ? 'accent' : 'text'}>
                  {label}
                </Txt>
              </HoverPressable>
            );
          })}
        <NavRow icon={Search} label={`${T('search')}  ·  Ctrl+K`} onPress={() => useUi.getState().setSearch(true)} />
      </View>
      {cursor ? (
        <DualMini
          selected={cursor}
          onSelect={(d) => {
            useUi.getState().setCursor(d);
            onNavigate?.();
            if (section !== 'calendar') {
              useUi.getState().setView('day');
              goTo('calendar');
            }
          }}
        />
      ) : null}

      <View style={{ gap: 2 }}>
        <View style={styles.sectionHeader}>
          <Txt size="sm" weight="semibold" color="textMuted" style={{ flex: 1 }}>
            {T('calendars')}
          </Txt>
          <IconButton icon={Plus} size="sm" title={T('newCalendar')} onPress={() => useUi.getState().setCalendarDialog({ mode: 'create' })} />
        </View>
        {active.length === 0 ? (
          <Txt size="sm" color="textMuted">
            {T('emptyCalendars')}
          </Txt>
        ) : null}
        {active.map((c) => (
          <CalendarRow key={c.id} cal={c} />
        ))}
        {archived.length ? (
          <Pressable onPress={() => setShowArchived((v) => !v)} style={styles.archivedToggle}>
            <Txt size="sm" color="textMuted">
              {T('archived')} ({archived.length})
            </Txt>
          </Pressable>
        ) : null}
        {showArchived ? archived.map((c) => <CalendarRow key={c.id} cal={c} archived />) : null}
      </View>

      <Divider />
      <View style={{ gap: 2 }}>
        <NavRow icon={ArrowLeftRight} label={T('converter')} onPress={() => useUi.getState().setConverter(true)} />
        <NavRow
          icon={Trash2}
          label={T('trash')}
          onPress={() => {
            onNavigate?.();
            router.push('/trash');
          }}
        />
        <NavRow
          icon={navItems(T)[3].icon}
          label={T('settings')}
          onPress={() => {
            onNavigate?.();
            router.push('/settings');
          }}
        />
      </View>
    </ScrollView>
  );
}

function CalendarRow({ cal, archived }: { cal: Calendar; archived?: boolean }) {
  const t = useTheme();
  const T = useT();
  const toggle = () => useData.getState().updateCalendar(cal.id, { visible: !cal.visible });
  return (
    <HoverPressable
      onPress={archived ? undefined : toggle}
      onLongPress={() => useData.getState().showOnlyCalendar(cal.id)}
      {...webProps({
        title: T('showOnlyHint'),
        onContextMenu: (e: unknown) => {
          (e as { preventDefault: () => void }).preventDefault();
          useUi.getState().setCalendarDialog({ mode: 'edit', id: cal.id });
        },
      })}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: cal.visible }}
      accessibilityLabel={cal.name}
      style={({ hovered }: { hovered?: boolean }) => [styles.calRow, hovered && { backgroundColor: t.surfaceAlt }]}
    >
      <View
        style={[
          styles.check,
          { borderColor: cal.color, backgroundColor: cal.visible && !archived ? cal.color : 'transparent' },
        ]}
      >
        {cal.visible && !archived ? <Check size={12} color="#fff" strokeWidth={3} /> : null}
      </View>
      <CalendarIcon name={cal.icon} size={15} color={archived ? t.textFaint : t.textMuted} />
      <Txt size="sm" numberOfLines={1} color={archived ? 'textFaint' : 'text'} style={{ flex: 1 }}>
        {cal.name}
      </Txt>
      <IconButton
        icon={MoreHorizontal}
        size="sm"
        title={T('editCalendar')}
        onPress={() => useUi.getState().setCalendarDialog({ mode: 'edit', id: cal.id })}
      />
    </HoverPressable>
  );
}

function NavRow({ icon: Icon, label, onPress }: { icon: typeof Plus; label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <HoverPressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ hovered }: { hovered?: boolean }) => [styles.calRow, hovered && { backgroundColor: t.surfaceAlt }]}
    >
      <Icon size={16} color={t.textMuted} strokeWidth={1.75} />
      <Txt size="sm">{label}</Txt>
    </HoverPressable>
  );
}

const styles = StyleSheet.create({
  sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingLeft: 6 },
  calRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 32,
    paddingLeft: 6,
    borderRadius: radius.md,
  },
  check: { width: 16, height: 16, borderRadius: 4, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  archivedToggle: { paddingVertical: 6, paddingLeft: 6 },
});
