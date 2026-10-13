import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useAtomValue } from 'jotai';
import { endOfDay, format, parseISO, startOfDay } from 'date-fns';
import { AlertCircle, CalendarClock, ChevronRight, Plus, Search } from 'lucide-react-native';
import { itemsAtom } from '../../atoms/project';
import { profileAtom } from '../../atoms/profile';
import { VIEW_TYPES } from '../../data/constants';
import { occurrencesInRange } from '../../data/recurrence';
import type { ProjectView } from '../../data/types';
import { useThemeColors } from '../../hooks/useThemeColors';
import { Press } from '../ui';
import { InitialsAvatar } from './shared';

// Phone home screen: a greeting, today's numbers, and every view one tap away.
export function MobileHome({
  views,
  activeId,
  onOpenView,
  onNewView,
  onOpenProfile,
  onSearch,
}: {
  views: ProjectView[];
  activeId: string;
  onOpenView: (id: string) => void;
  onNewView: () => void;
  onOpenProfile: () => void;
  onSearch: () => void;
}) {
  // Top-level tasks only — subtasks load lazily (useTasksSync's header comment),
  // so counting whatever's loaded would make this summary depend on prior
  // navigation rather than being a stable "today at a glance" figure.
  const items = useAtomValue(itemsAtom).filter(i => !i.parentId);
  const profile = useAtomValue(profileAtom);
  const c = useThemeColors();

  const summary = useMemo(() => {
    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');
    const active = items.filter(
      i =>
        occurrencesInRange(
          parseISO(i.start),
          parseISO(i.end),
          i.recurrence,
          startOfDay(now),
          endOfDay(now),
        ).length > 0,
    ).length;
    const overdue = items.filter(
      i =>
        i.end < todayStr &&
        i.status !== 'completed' &&
        i.status !== 'rejected',
    ).length;
    return { active, overdue };
  }, [items]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = profile.name.split(' ')[0];

  return (
    <ScrollView contentContainerClassName="gap-6 px-4 pb-12 pt-4">
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-xs font-medium uppercase tracking-wider text-text-subtle">
            {format(new Date(), 'EEEE, MMM d')}
          </Text>
          <Text className="mt-0.5 text-2xl font-semibold text-text-heading">
            {greeting}
            {firstName ? `, ${firstName}` : ''}
          </Text>
        </View>
        <Press
          accessibilityRole="button"
          accessibilityLabel="Open profile"
          onPress={onOpenProfile}
          className="rounded-full"
        >
          <InitialsAvatar color={profile.color} initials={profile.initials} size={38} />
        </Press>
      </View>

      <Press
        feedback="subtle"
        accessibilityRole="button"
        accessibilityLabel="Search tasks"
        onPress={onSearch}
        className="h-11 flex-row items-center gap-2.5 rounded-xl border border-border-main bg-bg-card px-3.5"
      >
        <Search size={16} color={c.subtle} />
        <Text className="text-base text-text-subtle">Search tasks</Text>
      </Press>

      <View className="flex-row gap-3">
        <Stat
          icon={CalendarClock}
          label="Active today"
          value={summary.active}
          color={c.accent}
        />
        <Stat
          icon={AlertCircle}
          label="Overdue"
          value={summary.overdue}
          color={summary.overdue > 0 ? c.destructive : c.subtle}
          emphasize={summary.overdue > 0}
        />
      </View>

      <View>
        <Text className="mb-2 px-1 text-2xs font-semibold uppercase tracking-wider text-text-subtle">
          Views
        </Text>
        <View className="overflow-hidden rounded-xl border border-border-main bg-bg-card">
          {views.map((v, i) => {
            const type = VIEW_TYPES.find(t => t.key === v.type);
            const Icon = type?.icon;
            const isActive = v.id === activeId;
            return (
              <Press
                key={v.id}
                feedback="none"
                accessibilityRole="button"
                accessibilityLabel={`Open view ${v.name}`}
                onPress={() => onOpenView(v.id)}
                className={`flex-row items-center gap-3 px-3.5 py-3 active:bg-hover ${
                  i > 0 ? 'border-t border-border-main' : ''
                }`}
              >
                <View
                  className={`h-9 w-9 items-center justify-center rounded-lg ${
                    isActive ? 'bg-accent-soft' : 'bg-muted'
                  }`}
                >
                  {Icon ? <Icon size={18} color={isActive ? c.accent : c.text} /> : null}
                </View>
                <View className="flex-1">
                  <Text numberOfLines={1} className="text-base font-medium text-text-heading">
                    {v.name}
                  </Text>
                  <Text numberOfLines={1} className="text-xs text-text-main">
                    {v.description || type?.blurb}
                  </Text>
                </View>
                <ChevronRight size={16} color={c.subtle} />
              </Press>
            );
          })}
          <Press
            feedback="none"
            accessibilityRole="button"
            accessibilityLabel="New view"
            onPress={onNewView}
            className={`flex-row items-center gap-3 px-3.5 py-3 active:bg-hover ${
              views.length > 0 ? 'border-t border-border-main' : ''
            }`}
          >
            <View className="h-9 w-9 items-center justify-center rounded-lg border border-dashed border-border-strong">
              <Plus size={16} color={c.accent} />
            </View>
            <Text className="text-base font-medium text-accent">New view</Text>
          </Press>
        </View>
      </View>
    </ScrollView>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  color,
  emphasize = false,
}: {
  icon: typeof Plus;
  label: string;
  value: number;
  color: string;
  emphasize?: boolean;
}) {
  return (
    <View className="flex-1 rounded-xl border border-border-main bg-bg-card p-3.5">
      <View className="mb-3 flex-row items-center gap-1.5">
        <Icon size={14} color={color} />
        <Text className="text-xs font-medium text-text-main">{label}</Text>
      </View>
      <Text
        className={`text-3xl font-semibold ${emphasize ? 'text-destructive' : 'text-text-heading'}`}
      >
        {value}
      </Text>
    </View>
  );
}
