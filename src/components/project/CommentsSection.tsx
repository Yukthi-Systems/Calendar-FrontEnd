import { useState } from 'react';
import { Text, View } from 'react-native';
import { MessageSquare, Pencil, SmilePlus, Trash2 } from 'lucide-react-native';
import { useAtomValue } from 'jotai';
import { format } from 'date-fns';
import { currentUserIdAtom } from '../../atoms/members';
import { confirm, errorMessage, toast } from '../../atoms/feedback';
import { useActiveView } from '../../hooks/useViews';
import { useCommentMutations, useComments } from '../../hooks/useComments';
import { usePerson } from '../../hooks/useUsers';
import { useThemeColors } from '../../hooks/useThemeColors';
import { isServerTaskId } from '../../data/taskSync';
import { Button, Chip, IconButton, Input, Popover, Press } from '../ui';
import { Avatar } from './shared';
import type { CommentDbDto } from '../../services/types';

// A fixed, small set rather than a full emoji picker — this app doesn't have
// one, and a handful of reactions covers the "liked it" / "saw it" use case
// comments need without pulling in a whole picker library for it.
const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '👀', '🙁'];

// The server's /react just JSONB-merges whatever's sent under `emoji`, so the
// full new array (self added/removed) is computed here and sent as a patch.
const toggleReaction = (
  comment: CommentDbDto,
  emoji: string,
  me: string,
): Record<string, string[]> => {
  const current = comment.reactions[emoji] ?? [];
  const next = current.includes(me)
    ? current.filter(id => id !== me)
    : [...current, me];
  return { [emoji]: next };
};

// Comments and reactions on a task, backed by Tasks-Main-API's /comments routes
// (now live — see docs/BACKEND.md §8). Needs the task's own id (server-assigned;
// a task that hasn't synced yet has none) and the view it's being viewed through
// (comments are only visible when that view's show_comments is on).
export function CommentsSection({ taskId }: { taskId: string }) {
  const c = useThemeColors();
  const me = useAtomValue(currentUserIdAtom);
  const view = useActiveView();
  const canLoad = !!view && isServerTaskId(taskId);
  const viewId = view ? Number(view.id) : 0;
  const numericTaskId = Number(taskId);

  const { comments, isLoading } = useComments(viewId, numericTaskId, canLoad);
  const { addComment, editComment, deleteComment, react, isAdding } =
    useCommentMutations(viewId, numericTaskId);

  const [draft, setDraft] = useState('');

  const submit = async () => {
    const content = draft.trim();
    if (!content) {
      return;
    }
    try {
      await addComment(content);
      setDraft('');
    } catch (err) {
      toast.error('Couldn’t post your comment', {
        description: errorMessage(err, 'Please try again.'),
      });
    }
  };

  const header = (
    <View className="mb-3 flex-row items-center gap-2">
      <MessageSquare size={15} color={c.text} />
      <Text className="text-sm font-semibold text-text-heading">
        Comments{comments.length ? ` (${comments.length})` : ''}
      </Text>
    </View>
  );

  if (!view) {
    return (
      <View>
        {header}
        <Text className="text-sm text-text-main">
          Open this task from a view to see its comments.
        </Text>
      </View>
    );
  }

  if (!isServerTaskId(taskId)) {
    return (
      <View>
        {header}
        <Text className="text-sm text-text-main">
          Save this task before adding comments.
        </Text>
      </View>
    );
  }

  if (!view.showComments) {
    return (
      <View>
        {header}
        <View className="rounded-lg border border-dashed border-border-strong px-3 py-3">
          <Text className="text-sm text-text-main">
            Comments are turned off for this view.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View>
      {header}
      <View className="gap-3">
        {isLoading ? (
          <Text className="text-sm text-text-main">Loading comments…</Text>
        ) : comments.length === 0 ? (
          <Text className="text-sm text-text-main">No comments yet.</Text>
        ) : (
          comments.map(cm => (
            <CommentRow
              key={cm.comment_id}
              comment={cm}
              onEdit={content =>
                editComment({ commentId: cm.comment_id, content }).catch(err => {
                  toast.error('Couldn’t update the comment', {
                    description: errorMessage(err, 'Please try again.'),
                  });
                })
              }
              onDelete={async () => {
                const ok = await confirm({
                  title: 'Delete this comment?',
                  destructive: true,
                });
                if (!ok) {
                  return;
                }
                try {
                  await deleteComment(cm.comment_id);
                } catch (err) {
                  toast.error('Couldn’t delete the comment', {
                    description: errorMessage(err, 'Please try again.'),
                  });
                }
              }}
              onReact={emoji =>
                react({ commentId: cm.comment_id, patch: toggleReaction(cm, emoji, me) }).catch(err => {
                  toast.error('Couldn’t react to the comment', {
                    description: errorMessage(err, 'Please try again.'),
                  });
                })
              }
            />
          ))
        )}

        <View className="flex-row items-end gap-2">
          <View className="flex-1">
            <Input
              value={draft}
              onChangeText={setDraft}
              placeholder="Write a comment…"
              multiline
              minHeight={40}
            />
          </View>
          <Button
            variant="primary"
            onPress={submit}
            disabled={!draft.trim()}
            loading={isAdding}
          >
            Post
          </Button>
        </View>
      </View>
    </View>
  );
}

function CommentRow({
  comment,
  onEdit,
  onDelete,
  onReact,
}: {
  comment: CommentDbDto;
  onEdit: (content: string) => void;
  onDelete: () => void;
  onReact: (emoji: string) => void;
}) {
  const me = useAtomValue(currentUserIdAtom);
  const author = usePerson(comment.author_id);
  const isMine = comment.author_id === me;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.content);
  const [pickerOpen, setPickerOpen] = useState(false);

  const reactionEntries = Object.entries(comment.reactions).filter(
    ([, ids]) => ids.length > 0,
  );

  const save = () => {
    const content = draft.trim();
    if (content && content !== comment.content) {
      onEdit(content);
    }
    setEditing(false);
  };

  return (
    <View className="flex-row items-start gap-2">
      <Avatar id={comment.author_id} size={26} />
      <View className="flex-1">
        <View className="flex-row items-center gap-1.5">
          <Text className="text-sm font-semibold text-text-heading">
            {author?.name ?? 'Unknown'}
          </Text>
          <Text className="text-2xs text-text-subtle">
            {format(new Date(comment.created_at), 'MMM d, h:mm a')}
            {comment.updated_at !== comment.created_at ? ' · edited' : ''}
          </Text>
        </View>

        {editing ? (
          <View className="mt-1 gap-2">
            <Input value={draft} onChangeText={setDraft} multiline minHeight={40} autoFocus />
            <View className="flex-row gap-2">
              <Button size="sm" variant="primary" onPress={save}>
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onPress={() => {
                  setDraft(comment.content);
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
            </View>
          </View>
        ) : (
          <Text className="mt-0.5 text-sm text-text-main">{comment.content}</Text>
        )}

        <View className="mt-1.5 flex-row flex-wrap items-center gap-1.5">
          {reactionEntries.map(([emoji, ids]) => (
            <Chip
              key={emoji}
              label={`${emoji} ${ids.length}`}
              active={ids.includes(me)}
              onPress={() => onReact(emoji)}
            />
          ))}

          <Popover
            open={pickerOpen}
            onClose={() => setPickerOpen(false)}
            width={200}
            renderTrigger={ref => (
              <View ref={ref}>
                <IconButton
                  icon={SmilePlus}
                  label="Add reaction"
                  size="sm"
                  onPress={() => setPickerOpen(o => !o)}
                />
              </View>
            )}
          >
            <View className="flex-row flex-wrap gap-1 p-2">
              {QUICK_REACTIONS.map(emoji => (
                <Press
                  key={emoji}
                  accessibilityRole="button"
                  accessibilityLabel={`React with ${emoji}`}
                  onPress={() => {
                    onReact(emoji);
                    setPickerOpen(false);
                  }}
                  className="h-9 w-9 items-center justify-center rounded-lg hover:bg-hover"
                >
                  <Text className="text-lg">{emoji}</Text>
                </Press>
              ))}
            </View>
          </Popover>

          {isMine && !editing ? (
            <>
              <IconButton
                icon={Pencil}
                label="Edit comment"
                size="sm"
                onPress={() => setEditing(true)}
              />
              <IconButton icon={Trash2} label="Delete comment" size="sm" onPress={onDelete} />
            </>
          ) : null}
        </View>
      </View>
    </View>
  );
}
