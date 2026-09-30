import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useAtom, useAtomValue } from 'jotai';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { commentsAtom } from '../../atoms/project';
import { profileAtom } from '../../atoms/profile';
import { InitialsAvatar } from './shared';

// A comment thread for one task or subtask — filtered by `itemId`, so it works
// unchanged for both; each item's comments are its own, regardless of depth.
export function CommentsSection({ itemId }: { itemId: string }) {
  const [comments, setComments] = useAtom(commentsAtom);
  const profile = useAtomValue(profileAtom);
  const [text, setText] = useState('');

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
        authorName: profile.name,
        authorInitials: profile.initials,
        authorColor: profile.color,
        text: trimmed,
        createdAt: new Date().toISOString(),
      },
    ]);
    setText('');
  };

  return (
    <View className="mb-5">
      <Text className="mb-2 text-xs font-semibold uppercase text-text-main">
        Comments{thread.length > 0 ? ` (${thread.length})` : ''}
      </Text>

      <View className="mb-3 gap-3">
        {thread.map(c => (
          <View key={c.id} className="flex-row gap-2.5">
            <InitialsAvatar
              color={c.authorColor}
              initials={c.authorInitials}
              size={28}
            />
            <View className="flex-1 rounded-xl border border-border-main bg-bg-main px-3 py-2">
              <View className="mb-0.5 flex-row items-center justify-between gap-2">
                <Text className="text-xs font-semibold text-text-heading">
                  {c.authorName}
                </Text>
                <Text className="text-[11px] text-text-main">
                  {formatDistanceToNow(parseISO(c.createdAt), {
                    addSuffix: true,
                  })}
                </Text>
              </View>
              <Text className="text-sm text-text-heading">{c.text}</Text>
            </View>
          </View>
        ))}
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
          <Text className="font-semibold text-white">Post</Text>
        </Pressable>
      </View>
    </View>
  );
}
