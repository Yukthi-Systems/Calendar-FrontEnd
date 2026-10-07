import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useAtom, useSetAtom } from 'jotai';
import { format, parseISO } from 'date-fns';
import {
  Bell,
  ChevronRight,
  ListTree,
  Plus,
  Repeat,
} from 'lucide-react-native';
import {
  commentsAtom,
  itemFormAtom,
  itemsAtom,
  selectedItemIdAtom,
} from '../../atoms/project';
import { PRIORITY_COLOR, STATUSES } from '../../data/constants';
import { CURRENT_USER_ID } from '../../data/mockData';
import { canDelete, canEditFields, roleFor } from '../../data/permissions';
import { RECURRENCE_LABEL } from '../../data/recurrence';
import {
  MAX_DEPTH,
  ancestorsOf,
  canAddSubtask,
  depthOf,
  descendantsOf,
  flattenTree,
  subtaskProgress,
} from '../../data/tree';
import { useThemeColors } from '../../hooks/useThemeColors';
import { CommentsSection } from './CommentsSection';
import { AssigneeAvatars, Pill, StatusDot, assigneeNames } from './shared';

// Detail sheet for any work item, opened from every view.
export function ItemModal() {
  const [selectedId, setSelectedId] = useAtom(selectedItemIdAtom);
  const [items, setItems] = useAtom(itemsAtom);
  const setComments = useSetAtom(commentsAtom);
  const setForm = useSetAtom(itemFormAtom);
  const { heading, text, accent } = useThemeColors();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const item = items.find(i => i.id === selectedId);
  const close = () => {
    setConfirmDelete(false);
    setSelectedId(null);
  };
  const open = (id: string) => {
    setConfirmDelete(false);
    setSelectedId(id);
  };

  const crumbs = item ? ancestorsOf(items, item) : [];
  const depth = item ? depthOf(items, item) : 1;
  const subtasks = item ? flattenTree(descendantsOf(items, item.id)) : [];
  const progress = item ? subtaskProgress(items, item.id) : null;
  const canAdd = item ? canAddSubtask(items, item) : false;
  // An assignee who isn't also the creator is limited to status, comments and
  // subtasks — Edit/Delete simply aren't offered to them.
  const role = item ? roleFor(item, CURRENT_USER_ID) : 'other';
  const editable = item ? canEditFields(item, CURRENT_USER_ID) : false;
  const deletable = item ? canDelete(item, CURRENT_USER_ID) : false;

  return (
    <Modal
      visible={!!item}
      transparent
      animationType="fade"
      onRequestClose={close}
    >
      <Pressable
        accessibilityLabel="Close"
        onPress={close}
        className="flex-1 items-center justify-end bg-black/50 sm:justify-center"
      >
        {item ? (
          // Inner Pressable swallows taps so only the backdrop closes the sheet.
          <Pressable
            onPress={() => {}}
            className="max-h-[90%] w-full max-w-xl rounded-t-3xl bg-bg-card p-5 sm:rounded-3xl"
          >
            <ScrollView showsVerticalScrollIndicator={false}>
              {crumbs.length > 0 ? (
                <View className="mb-2 flex-row flex-wrap items-center gap-1">
                  {crumbs.map(c => (
                    <View key={c.id} className="flex-row items-center gap-1">
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => open(c.id)}
                        className="active:opacity-70"
                      >
                        <Text className="text-xs text-accent">{c.id}</Text>
                      </Pressable>
                      <ChevronRight size={12} color={text} />
                    </View>
                  ))}
                </View>
              ) : null}
              <Text className="text-xs text-text-main">
                {item.id} · Level {depth} of {MAX_DEPTH}
              </Text>
              <Text className="mb-3 text-xl font-bold text-text-heading">
                {item.title}
              </Text>
              <Text className="mb-4 text-sm text-text-main">
                {item.description}
              </Text>

              {role === 'assignee' ? (
                <View className="mb-4 rounded-xl border border-border-main bg-bg-main px-3 py-2">
                  <Text className="text-xs text-text-main">
                    You're assigned to this task — you can comment, update its
                    status, and manage subtasks. Only the creator can edit its
                    other details or delete it.
                  </Text>
                </View>
              ) : null}

              <View className="mb-4 flex-row flex-wrap items-center gap-2">
                <Pill
                  text={`${item.priority} priority`}
                  color={PRIORITY_COLOR[item.priority]}
                />
                {item.labels.map(l => (
                  <Pill key={l} text={l} />
                ))}
              </View>

              <View className="mb-2 flex-row items-center gap-2">
                <AssigneeAvatars ids={item.assigneeIds} size={28} />
                <Text className="text-sm text-text-heading">
                  {assigneeNames(item.assigneeIds)}
                </Text>
              </View>
              <Text className="mb-1 text-sm text-text-main">
                {format(parseISO(item.start), 'MMM d')} –{' '}
                {format(parseISO(item.end), 'MMM d, yyyy')}
              </Text>

              {item.recurrence ? (
                <View className="mb-1 flex-row items-center gap-1.5">
                  <Repeat size={13} color={text} />
                  <Text className="text-xs text-text-main">
                    {RECURRENCE_LABEL[item.recurrence]}
                  </Text>
                </View>
              ) : null}
              {(item.reminders ?? []).length > 0 ? (
                <View className="mb-4 flex-row items-center gap-1.5">
                  <Bell size={13} color={text} />
                  <Text className="text-xs text-text-main">
                    {item.reminders
                      .map(
                        r =>
                          `${
                            r.offsetDays === 0
                              ? 'Due date'
                              : `${r.offsetDays}d before`
                          } at ${r.time}`,
                      )
                      .join(' · ')}
                  </Text>
                </View>
              ) : (
                <View className="mb-4" />
              )}

              <Text className="mb-2 text-xs font-semibold uppercase text-text-main">
                Status
              </Text>
              <View className="mb-5 flex-row flex-wrap gap-2">
                {STATUSES.map(s => {
                  const active = s.key === item.status;
                  return (
                    <Pressable
                      key={s.key}
                      accessibilityRole="button"
                      onPress={() =>
                        setItems(prev =>
                          prev.map(i =>
                            i.id === item.id ? { ...i, status: s.key } : i,
                          ),
                        )
                      }
                      style={active ? { backgroundColor: s.color } : undefined}
                      className="rounded-full border border-border-main px-3 py-1.5 active:opacity-70"
                    >
                      <Text
                        className={active ? 'text-white' : 'text-text-heading'}
                      >
                        {s.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View className="mb-2 flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <ListTree size={16} color={heading} />
                  <Text className="font-semibold text-text-heading">
                    Subtasks
                  </Text>
                  {progress && progress.total > 0 ? (
                    <Text className="text-xs text-text-main">
                      {progress.done}/{progress.total} done
                    </Text>
                  ) : null}
                </View>
                {canAdd ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setForm({ mode: 'new', parentId: item.id });
                      close();
                    }}
                    className="flex-row items-center gap-1 rounded-lg px-2 py-1 active:opacity-70"
                  >
                    <Plus size={16} color={accent} />
                    <Text className="text-sm font-medium text-accent">
                      Add subtask
                    </Text>
                  </Pressable>
                ) : (
                  <Text className="text-xs text-text-main">
                    Max depth ({MAX_DEPTH}) reached
                  </Text>
                )}
              </View>
              {progress && progress.total > 0 ? (
                <View className="mb-2 h-1.5 overflow-hidden rounded-full bg-border-main">
                  <View
                    style={{
                      width: `${(progress.done / progress.total) * 100}%`,
                    }}
                    className="h-1.5 rounded-full bg-[#10b981]"
                  />
                </View>
              ) : null}
              <View className="mb-5 gap-1">
                {subtasks.length === 0 ? (
                  <Text className="text-sm text-text-main">
                    No subtasks yet.
                  </Text>
                ) : (
                  subtasks.map(({ item: s, depth: d }) => (
                    <Pressable
                      key={s.id}
                      accessibilityRole="button"
                      onPress={() => open(s.id)}
                      style={{ marginLeft: (d - 1) * 16 }}
                      className="flex-row items-center gap-2 rounded-lg border border-border-main px-3 py-2 active:opacity-70"
                    >
                      <StatusDot status={s.status} />
                      <Text
                        numberOfLines={1}
                        className="flex-1 text-sm text-text-heading"
                      >
                        {s.title}
                      </Text>
                      <AssigneeAvatars ids={s.assigneeIds} size={20} />
                    </Pressable>
                  ))
                )}
              </View>

              <CommentsSection itemId={item.id} />

              <View className="flex-row gap-2">
                {deletable ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      if (!confirmDelete) {
                        setConfirmDelete(true);
                        return;
                      }
                      const gone = new Set([
                        item.id,
                        ...descendantsOf(items, item.id).map(d => d.id),
                      ]);
                      setItems(prev => prev.filter(i => !gone.has(i.id)));
                      setComments(prev =>
                        prev.filter(c => !gone.has(c.itemId)),
                      );
                      close();
                    }}
                    className="items-center rounded-2xl border border-destructive/40 px-4 py-3 active:opacity-70"
                  >
                    <Text className="font-semibold text-destructive">
                      {confirmDelete
                        ? progress && progress.total > 0
                          ? `Delete with ${progress.total} subtasks?`
                          : 'Tap again to delete'
                        : 'Delete'}
                    </Text>
                  </Pressable>
                ) : null}
                {editable ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setForm({ mode: 'edit', id: item.id });
                      close();
                    }}
                    className="flex-1 items-center rounded-2xl border border-border-main py-3 active:opacity-70"
                  >
                    <Text className="text-text-heading">Edit</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  onPress={close}
                  className="flex-1 items-center rounded-2xl bg-accent py-3 active:opacity-80"
                >
                  <Text className="font-semibold text-accent-foreground">Done</Text>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        ) : null}
      </Pressable>
    </Modal>
  );
}
