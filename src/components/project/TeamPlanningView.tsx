import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { ChevronLeft, ChevronRight, Users } from 'lucide-react-native';
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
import { useThemeColors } from '../../hooks/useThemeColors';
import { Button, EmptyState, IconButton } from '../ui';
import { InitialsAvatar, ItemRow, PAGE_STYLE } from './shared';

export function TeamPlanningView() {
  const items = useAtomValue(itemsAtom);
  const members = useAtomValue(membersAtom);
  const c = useThemeColors();
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
  const teamRatio = teamCapacity ? teamLoad / teamCapacity : 0;

  return (
    <View className="flex-1">
      <View style={PAGE_STYLE} className="px-4 lg:px-6">
        <View className="flex-row flex-wrap items-center gap-3 py-3">
          <View className="flex-row items-center gap-1">
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
          <View>
            <Text className="text-lg font-semibold text-text-heading">
              {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}
            </Text>
          </View>
          <View className="flex-1" />
          {teamCapacity > 0 ? (
            <View className="flex-row items-center gap-2">
              <Text className="text-xs text-text-main">
                Team load{' '}
                <Text className="font-semibold text-text-heading">
                  {teamLoad}/{teamCapacity}
                </Text>
              </Text>
              <LoadBar ratio={teamRatio} color={c.accent} width={80} />
            </View>
          ) : null}
          {!thisWeek ? (
            <Button
              size="sm"
              onPress={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            >
              This week
            </Button>
          ) : null}
        </View>
      </View>

      {members.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No teammates yet"
          description="Add people as assignees on a task and they'll show up here with their weekly load."
        />
      ) : (
        <ScrollView contentContainerClassName="pb-24">
          <View style={PAGE_STYLE} className="px-4 lg:px-6">
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
                  ? c.destructive
                  : ratio > 0.8
                  ? c.warning
                  : member?.color ?? c.subtle;
                return (
                  <View
                    key={member?.id ?? 'unassigned'}
                    style={{ flexGrow: 1, flexBasis: 400, minWidth: 300 }}
                    className="rounded-xl border border-border-main bg-bg-card p-4"
                  >
                    <View className="mb-3 flex-row items-center gap-3">
                      {member ? (
                        <InitialsAvatar color={member.color} initials={member.initials} size={34} />
                      ) : (
                        <View
                          style={{ borderStyle: 'dashed' }}
                          className="h-[34px] w-[34px] items-center justify-center rounded-full border-[1.5px] border-border-strong"
                        >
                          <Users size={15} color={c.subtle} />
                        </View>
                      )}
                      <View className="flex-1">
                        <Text numberOfLines={1} className="text-sm font-semibold text-text-heading">
                          {member?.name ?? 'Unassigned'}
                        </Text>
                        <Text numberOfLines={1} className="text-xs text-text-subtle">
                          {member ? member.role || 'Teammate' : 'Needs an owner'}
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text
                          className={`text-sm font-semibold ${
                            over ? 'text-destructive' : 'text-text-heading'
                          }`}
                        >
                          {member ? `${load}/${member.capacity}` : load}
                        </Text>
                        {member ? (
                          <Text
                            className={`text-2xs ${
                              over ? 'text-destructive' : 'text-text-subtle'
                            }`}
                          >
                            {over ? 'Over capacity' : `${Math.round(ratio * 100)}% booked`}
                          </Text>
                        ) : (
                          <Text className="text-2xs text-text-subtle">tasks</Text>
                        )}
                      </View>
                    </View>
                    {member ? (
                      <View className="mb-3">
                        <LoadBar ratio={ratio} color={barColor} />
                      </View>
                    ) : null}
                    <View className="gap-1.5">
                      {mine.length === 0 ? (
                        <Text className="py-2 text-sm text-text-subtle">
                          Nothing planned this week
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
      )}
    </View>
  );
}

function LoadBar({
  ratio,
  color,
  width,
}: {
  ratio: number;
  color: string;
  width?: number;
}) {
  return (
    <View
      style={width ? { width } : undefined}
      className="h-1.5 overflow-hidden rounded-full bg-muted"
    >
      <View
        style={{ width: `${Math.min(ratio, 1) * 100}%`, backgroundColor: color }}
        className="h-1.5 rounded-full"
      />
    </View>
  );
}
