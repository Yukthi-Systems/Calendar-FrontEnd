import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useAtomValue } from 'jotai';
import { endOfDay, format, parseISO, startOfDay } from 'date-fns';
import { Plus } from 'lucide-react-native';
import { itemsAtom } from '../../atoms/project';
import { profileAtom } from '../../atoms/profile';
import { VIEW_TYPES } from '../../data/constants';
import { occurrencesInRange } from '../../data/recurrence';
import type { ProjectView } from '../../data/types';
import { useThemeColors } from '../../hooks/useThemeColors';
import { InitialsAvatar } from './shared';

// Phone home screen: a summary widget plus one widget per view (saved and
// default alike), so each view is one tap from the front page.
export function MobileHome({
  views,
  activeId,
  onOpenView,
  onNewView,
  onOpenProfile,
}: {
  views: ProjectView[];
  activeId: string;
  onOpenView: (id: string) => void;
  onNewView: () => void;
  onOpenProfile: () => void;
}) {
  const items = useAtomValue(itemsAtom);
  const profile = useAtomValue(profileAtom);
  const { heading, accent } = useThemeColors();

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

  return (
    <ScrollView contentContainerClassName="gap-5 px-4 pb-10 pt-3">
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-xl font-bold text-text-heading">
            Hi {profile.name.split(' ')[0]}
          </Text>
          <Text className="text-xs text-text-main">
            {format(new Date(), 'EEEE, MMM d')}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open profile"
          onPress={onOpenProfile}
          className="active:opacity-70"
        >
          <InitialsAvatar
            color={profile.color}
            initials={profile.initials}
            size={36}
          />
        </Pressable>
      </View>

      <View className="flex-row gap-3">
        <View className="flex-1 gap-1 rounded-2xl border border-border-main bg-bg-card p-4">
          <Text className="text-xs font-semibold uppercase text-text-main">
            Active today
          </Text>
          <Text className="text-3xl font-bold text-text-heading">
            {summary.active}
          </Text>
        </View>
        <View className="flex-1 gap-1 rounded-2xl border border-border-main bg-bg-card p-4">
          <Text className="text-xs font-semibold uppercase text-text-main">
            Overdue
          </Text>
          <Text
            className={`text-3xl font-bold ${
              summary.overdue > 0 ? 'text-destructive' : 'text-text-heading'
            }`}
          >
            {summary.overdue}
          </Text>
        </View>
      </View>

      <View className="gap-2">
        <Text className="text-xs font-semibold uppercase text-text-main">
          Views
        </Text>
        <View className="flex-row flex-wrap gap-3">
          {views.map(v => {
            const isActive = v.id === activeId;
            const Icon = VIEW_TYPES.find(t => t.key === v.type)?.icon;
            return (
              <Pressable
                key={v.id}
                accessibilityRole="button"
                accessibilityLabel={`Open view ${v.name}`}
                onPress={() => onOpenView(v.id)}
                className={`h-36 w-[47%] justify-between rounded-2xl border bg-bg-card p-3 active:opacity-70 ${
                  isActive ? 'border-accent' : 'border-border-main'
                }`}
              >
                <View className="gap-1">
                  {Icon ? <Icon size={20} color={isActive ? accent : heading} /> : null}
                  <Text numberOfLines={1} className="font-semibold text-text-heading">
                    {v.name}
                  </Text>
                </View>
                <Text numberOfLines={2} className="text-xs text-text-main">
                  {v.description ||
                    VIEW_TYPES.find(t => t.key === v.type)?.blurb}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add view widget"
            onPress={onNewView}
            className="h-36 w-[47%] items-center justify-center gap-1 rounded-2xl border border-dashed border-border-main active:opacity-70"
          >
            <Plus size={22} color={accent} />
            <Text className="text-sm font-medium text-text-main">
              Add widget
            </Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}
