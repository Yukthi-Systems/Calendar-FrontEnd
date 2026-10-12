import { useState } from 'react';
import { Text, View } from 'react-native';
import { useAtom, useAtomValue } from 'jotai';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { MessageSquare, Pencil, Trash2 } from 'lucide-react-native';
import { commentsAtom } from '../../atoms/project';
import { profileAtom } from '../../atoms/profile';
import { currentUserIdAtom } from '../../atoms/members';
import { toast } from '../../atoms/feedback';
import { canDeleteComment, canEditComment } from '../../data/permissions';
import type { Comment } from '../../data/types';
import { useThemeColors } from '../../hooks/useThemeColors';
import { Button, IconButton, Input } from '../ui';
import { InitialsAvatar } from './shared';

// Shown on row hover on web (web/web.css); always visible on touch.
const HOVER_REVEAL = 'reveal-on-hover';

// A comment thread for one task or subtask — filtered by `itemId`, so it works
// unchanged for both; each item's comments are its own, regardless of depth.
// Sorted oldest first; editing/deleting a comment is restricted to whoever
// posted it (src/data/permissions.ts).
export function CommentsSection({ itemId }: { itemId: string }) {
  const [comments, setComments] = useAtom(commentsAtom);
  const profile = useAtomValue(profileAtom);
  const CURRENT_USER_ID = useAtomValue(currentUserIdAtom);
  const c = useThemeColors();
  const [text, setText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const thread = comments
    .filter(x => x.itemId === itemId)
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

  const startEdit = (x: Comment) => {
    setEditingId(x.id);
    setEditText(x.text);
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
      prev.map(x =>
        x.id === editingId
          ? { ...x, text: trimmed, editedAt: new Date().toISOString() }
          : x,
      ),
    );
    cancelEdit();
  };
  const remove = (removed: Comment) => {
    setComments(prev => prev.filter(x => x.id !== removed.id));
    toast.info('Comment deleted', {
      action: {
        label: 'Undo',
        onPress: () =>
          setComments(prev =>
            prev.some(x => x.id === removed.id) ? prev : [...prev, removed],
          ),
      },
    });
  };

  return (
    <View>
      <View className="mb-3 flex-row items-center gap-2">
        <MessageSquare size={15} color={c.text} />
        <Text className="text-sm font-semibold text-text-heading">Comments</Text>
        {thread.length > 0 ? (
          <Text className="text-sm text-text-subtle">{thread.length}</Text>
        ) : null}
      </View>

      <View className="gap-4">
        {thread.map(x => {
          const mine = canEditComment(x, CURRENT_USER_ID);
          const isEditing = editingId === x.id;
          return (
            <View key={x.id} className="group flex-row gap-2.5">
              <InitialsAvatar color={x.authorColor} initials={x.authorInitials} size={26} />
              <View className="flex-1">
                <View className="min-h-[26px] flex-row items-center gap-2">
                  <Text className="text-sm font-medium text-text-heading">
                    {x.authorName}
                  </Text>
                  <Text className="flex-1 text-xs text-text-subtle">
                    {formatDistanceToNow(parseISO(x.createdAt), { addSuffix: true })}
                    {x.editedAt ? ' · edited' : ''}
                  </Text>
                  {mine && !isEditing ? (
                    <View className={`flex-row ${HOVER_REVEAL}`}>
                      <IconButton icon={Pencil} size="sm" label="Edit comment" onPress={() => startEdit(x)} />
                      {canDeleteComment(x, CURRENT_USER_ID) ? (
                        <IconButton
                          icon={Trash2}
                          size="sm"
                          label="Delete comment"
                          color={c.destructive}
                          onPress={() => remove(x)}
                        />
                      ) : null}
                    </View>
                  ) : null}
                </View>
                {isEditing ? (
                  <View className="mt-1 gap-2">
                    <Input value={editText} onChangeText={setEditText} multiline minHeight={38} autoFocus />
                    <View className="flex-row justify-end gap-2">
                      <Button size="sm" variant="ghost" onPress={cancelEdit}>
                        Cancel
                      </Button>
                      <Button size="sm" variant="primary" disabled={!editText.trim()} onPress={saveEdit}>
                        Save
                      </Button>
                    </View>
                  </View>
                ) : (
                  <Text className="text-sm text-text-heading">{x.text}</Text>
                )}
              </View>
            </View>
          );
        })}
      </View>

      <View className={`flex-row items-start gap-2.5 ${thread.length > 0 ? 'mt-5' : ''}`}>
        <InitialsAvatar color={profile.color} initials={profile.initials} size={26} />
        <View className="flex-1 gap-2">
          <Input
            value={text}
            onChangeText={setText}
            placeholder={thread.length ? 'Reply…' : 'Leave a comment…'}
            multiline
            minHeight={38}
          />
          {text.trim() ? (
            <View className="flex-row justify-end">
              <Button size="sm" variant="primary" onPress={post}>
                Comment
              </Button>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}
