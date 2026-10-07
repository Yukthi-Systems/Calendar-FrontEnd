import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useAtom, useAtomValue } from 'jotai';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { Pencil, Trash2 } from 'lucide-react-native';
import { commentsAtom } from '../../atoms/project';
import { profileAtom } from '../../atoms/profile';
import { CURRENT_USER_ID } from '../../data/mockData';
import { canDeleteComment, canEditComment } from '../../data/permissions';
import type { Comment } from '../../data/types';
import { useThemeColors } from '../../hooks/useThemeColors';
import { InitialsAvatar } from './shared';

// A comment thread for one task or subtask — filtered by `itemId`, so it works
// unchanged for both; each item's comments are its own, regardless of depth.
// Sorted oldest first; editing/deleting a comment is restricted to whoever
// posted it (src/data/permissions.ts).
export function CommentsSection({ itemId }: { itemId: string }) {
  const [comments, setComments] = useAtom(commentsAtom);
  const profile = useAtomValue(profileAtom);
  const { text: textColor } = useThemeColors();
  const [text, setText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const thread = comments
    .filter(c => c.itemId === itemId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const post = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    setComments(prev => [
      ...prev,
      {
        id: `c-${Date.now()}`,
        itemId,
        authorId: CURRENT_USER_ID,
        authorName: profile.name,
        authorInitials: profile.initials,
        authorColor: profile.color,
        text: trimmed,
        createdAt: new Date().toISOString(),
      },
    ]);
    setText('');
  };

  const startEdit = (c: Comment) => {
    setEditingId(c.id);
    setEditText(c.text);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };
  const saveEdit = () => {
    const trimmed = editText.trim();
    if (!trimmed || !editingId) {
      return;
    }
    setComments(prev =>
      prev.map(c =>
        c.id === editingId
          ? { ...c, text: trimmed, editedAt: new Date().toISOString() }
          : c,
      ),
    );
    cancelEdit();
  };
  const remove = (id: string) =>
    setComments(prev => prev.filter(c => c.id !== id));

  return (
    <View className="mb-5">
      <Text className="mb-2 text-xs font-semibold uppercase text-text-main">
        Comments{thread.length > 0 ? ` (${thread.length})` : ''}
      </Text>

      <View className="mb-3 gap-3">
        {thread.map(c => {
          const mine = canEditComment(c, CURRENT_USER_ID);
          const isEditing = editingId === c.id;
          return (
            <View key={c.id} className="flex-row gap-2.5">
              <InitialsAvatar
                color={c.authorColor}
                initials={c.authorInitials}
                size={28}
              />
              <View className="flex-1 rounded-xl border border-border-main bg-bg-main px-3 py-2">
                <View className="mb-0.5 flex-row items-center justify-between gap-2">
                  <View className="flex-1 flex-row items-center gap-1.5">
                    <Text className="text-xs font-semibold text-text-heading">
                      {c.authorName}
                    </Text>
                    <Text className="text-[11px] text-text-main">
                      {formatDistanceToNow(parseISO(c.createdAt), {
                        addSuffix: true,
                      })}
                      {c.editedAt ? ' · edited' : ''}
                    </Text>
                  </View>
                  {mine && !isEditing ? (
                    <View className="flex-row items-center gap-2">
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Edit comment"
                        onPress={() => startEdit(c)}
                        className="active:opacity-60"
                      >
                        <Pencil size={13} color={textColor} />
                      </Pressable>
                      {canDeleteComment(c, CURRENT_USER_ID) ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Delete comment"
                          onPress={() => remove(c.id)}
                          className="active:opacity-60"
                        >
                          <Trash2 size={13} color="#ef4444" />
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}
                </View>

                {isEditing ? (
                  <View>
                    <TextInput
                      value={editText}
                      onChangeText={setEditText}
                      multiline
                      textAlignVertical="top"
                      className="min-h-[40px] rounded-lg border border-border-main px-2 py-1.5 text-sm text-text-heading"
                    />
                    <View className="mt-1.5 flex-row justify-end gap-3">
                      <Pressable
                        accessibilityRole="button"
                        onPress={cancelEdit}
                        className="active:opacity-60"
                      >
                        <Text className="text-xs text-text-main">Cancel</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        disabled={!editText.trim()}
                        onPress={saveEdit}
                        className="active:opacity-60"
                      >
                        <Text
                          className={`text-xs font-semibold ${
                            editText.trim() ? 'text-accent' : 'text-text-main'
                          }`}
                        >
                          Save
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Text className="text-sm text-text-heading">{c.text}</Text>
                )}
              </View>
            </View>
          );
        })}
        {thread.length === 0 ? (
          <Text className="text-sm text-text-main">No comments yet.</Text>
        ) : null}
      </View>

      <View className="flex-row items-end gap-2">
        <InitialsAvatar
          color={profile.color}
          initials={profile.initials}
          size={28}
        />
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Add a comment…"
          placeholderTextColor="#9ca3af"
          multiline
          textAlignVertical="top"
          className="min-h-[40px] flex-1 rounded-xl border border-border-main px-3 py-2 text-text-heading"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Post comment"
          disabled={!text.trim()}
          onPress={post}
          className={`items-center justify-center rounded-xl bg-accent px-4 py-2.5 active:opacity-80 ${
            text.trim() ? '' : 'opacity-40'
          }`}
        >
          <Text className="font-semibold text-accent-foreground">Post</Text>
        </Pressable>
      </View>
    </View>
  );
}
