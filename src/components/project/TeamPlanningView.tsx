import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useAtomValue } from 'jotai';
import {
  addWeeks,
  endOfWeek,
  format,
  isSameWeek,
  parseISO,
  startOfWeek,
} from 'date-fns';
import { itemsAtom } from '../../atoms/project';
import { membersAtom } from '../../atoms/members';
import type { Member } from '../../data/types';
import { IconButton, ItemRow, PAGE_STYLE } from './shared';

export function TeamPlanningView() {
  const items = useAtomValue(itemsAtom);
  const members = useAtomValue(membersAtom);
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 }),
  );
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const thisWeek = isSameWeek(weekStart, new Date(), { weekStartsOn: 1 });

  const weekItems = items.filter(
    i => parseISO(i.start) <= weekEnd && parseISO(i.end) >= weekStart,
  );

  const rows: (Member | null)[] = [...members, null];
  // Counted per assignee, so a shared item adds one to each of its assignees' load.
  const teamLoad = weekItems.reduce((s, i) => s + i.assigneeIds.length, 0);
  const teamCapacity = members.reduce((s, m) => s + m.capacity, 0);

  return (
    <View className="flex-1">
      <View style={PAGE_STYLE} className="px-4">
        <View className="flex-row items-center justify-between py-4">
          <View>
            <Text className="text-lg font-bold text-text-heading">
              {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}
            </Text>
            <Text className="text-xs text-text-main">
              Team load {teamLoad} / {teamCapacity} items
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            {!thisWeek ? (
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))
                }
                className="rounded-lg border border-border-main px-3 py-2 active:opacity-70"
              >
                <Text className="text-xs text-text-heading">This week</Text>
              </Pressable>
            ) : null}
            <IconButton
              icon={ChevronLeft}
              label="Previous week"
              onPress={() => setWeekStart(w => addWeeks(w, -1))}
            />
            <IconButton
              icon={ChevronRight}
              label="Next week"
              onPress={() => setWeekStart(w => addWeeks(w, 1))}
            />
          </View>
        </View>
      </View>

      <ScrollView contentContainerClassName="pb-24">
        <View style={PAGE_STYLE} className="px-4">
          <View className="flex-row flex-wrap gap-3">
            {rows.map(member => {
              const mine = weekItems.filter(i =>
                member
                  ? i.assigneeIds.includes(member.id)
                  : i.assigneeIds.length === 0,
              );
              if (!member && mine.length === 0) {
                return null;
              }
              const load = mine.length;
              const ratio = member ? load / member.capacity : 0;
              const over = ratio > 1;
              const barColor = over
                ? '#ef4444'
                : ratio > 0.8
                ? '#f59e0b'
                : member?.color ?? '#9ca3af';
              return (
                <View
                  key={member?.id ?? 'unassigned'}
                  style={{ flexGrow: 1, flexBasis: 420, minWidth: 300 }}
                  className="rounded-2xl border border-border-main bg-bg-card p-4"
                >
                  <View className="mb-3 flex-row items-center gap-3">
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 19,
                        backgroundColor: member?.color ?? '#9ca3af',
                      }}
                      className="items-center justify-center"
                    >
                      <Text className="text-sm font-bold text-white">
                        {member?.initials ?? '?'}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className="font-semibold text-text-heading">
                        {member?.name ?? 'Unassigned'}
                      </Text>
                      <Text className="text-xs text-text-main">
                        {member ? member.role : 'Needs an owner'}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text
                        className={`text-sm font-semibold ${
                          over ? 'text-destructive' : 'text-text-heading'
                        }`}
                      >
                        {member ? `${load} / ${member.capacity}` : load} items
                      </Text>
                      {member ? (
                        <Text
                          className={`text-[11px] ${
                            over ? 'text-destructive' : 'text-text-main'
                          }`}
                        >
                          {over
                            ? 'Over capacity'
                            : `${Math.round(ratio * 100)}% booked`}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  {member ? (
                    <View className="mb-3 h-2 overflow-hidden rounded-full bg-border-main">
                      <View
                        style={{
                          width: `${Math.min(ratio, 1) * 100}%`,
                          backgroundColor: barColor,
                        }}
                        className="h-2 rounded-full"
                      />
                    </View>
                  ) : null}
                  <View className="gap-2">
                    {mine.length === 0 ? (
                      <Text className="text-xs text-text-main">
                        Nothing planned.
                      </Text>
                    ) : (
                      mine.map(i => (
                        <ItemRow key={i.id} item={i} showAssignee={false} />
                      ))
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
