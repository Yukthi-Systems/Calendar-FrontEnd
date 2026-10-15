import { Text, View, type ViewInstance } from 'react-native';
import { Check, Pencil, Trash2, Users, X } from 'lucide-react-native';
import { STATUSES, TAGS, VIEW_TYPES } from '../../data/constants';
import type { ProjectView } from '../../data/types';
import { usePerson } from '../../hooks/useUsers';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useMyShare } from '../../hooks/useViews';
import { errorMessage } from '../../atoms/feedback';
import { MenuItem, MenuLabel, MenuSeparator, Popover, Skeleton } from '../ui';

// The "⋯" menu on a view — a dropdown under the button that opened it
// (`anchorRef`), a bottom sheet on phones. My views: Share & access / Edit / Delete.
// Views shared with me: who shared it — only the owner can change or share it
// (the server refuses everything else), so no actions are offered.
export function ViewMenuModal({
  visible,
  view,
  anchorRef,
  onClose,
  onShare,
  onEdit,
  onDelete,
}: {
  visible: boolean;
  view: ProjectView | null;
  anchorRef?: React.RefObject<ViewInstance | null> | null;
  onClose: () => void;
  onShare: (view: ProjectView) => void;
  onEdit: (view: ProjectView) => void;
  onDelete: (view: ProjectView) => void;
}) {
  const c = useThemeColors();
  const owner = usePerson(view?.shared ? view.ownerId : null);
  const type = VIEW_TYPES.find(t => t.key === view?.type);
  const Icon = type?.icon;

  return (
    <Popover open={visible} onClose={onClose} anchorRef={anchorRef} width={264} variant="menu">
      {view ? (
        <View>
          <View className="flex-row items-center gap-3 px-2.5 pb-2 pt-2">
            <View className="h-8 w-8 items-center justify-center rounded-lg bg-muted">
              {Icon ? <Icon size={16} color={c.text} /> : null}
            </View>
            <View className="flex-1">
              <Text numberOfLines={1} className="text-sm font-semibold text-text-heading">
                {view.name}
              </Text>
              <Text className="text-xs text-text-subtle">
                {type?.label} view
                {view.shared && owner ? ` · shared by ${owner.name}` : ''}
              </Text>
            </View>
          </View>
          <MenuSeparator />
          {view.shared ? (
            <>
              <MyAccess view={view} />
              <MenuSeparator />
              <Text className="px-2.5 py-2 text-xs text-text-subtle">
                Only {owner?.name ?? 'the owner'} can change access, or edit, delete or share
                this view.
              </Text>
            </>
          ) : (
            <>
              <MenuItem
                icon={Users}
                label="Share & access"
                description="Who can see this view"
                onPress={() => onShare(view)}
              />
              <MenuItem icon={Pencil} label="Edit view" onPress={() => onEdit(view)} />
              <MenuSeparator />
              <MenuItem
                icon={Trash2}
                label="Delete view"
                destructive
                onPress={() => onDelete(view)}
              />
            </>
          )}
        </View>
      ) : null}
    </Popover>
  );
}

// What a view shared with me lets me do: the owner's grant (from the server), plus
// the view's own limits that apply to everyone — subtasks and status/tag filters.
function MyAccess({ view }: { view: ProjectView }) {
  const { data: share, isLoading, error } = useMyShare(view, true);
  const statuses = view.statusFilter?.length
    ? STATUSES.filter(s => view.statusFilter!.includes(s.key)).map(s => s.label)
    : null;
  const tags = view.tagFilter?.length
    ? TAGS.filter(t => view.tagFilter!.includes(t.key)).map(t => t.label)
    : null;

  return (
    <View className="pb-1">
      <MenuLabel>Your access</MenuLabel>
      {isLoading ? (
        <View className="gap-2 px-2.5 py-1.5">
          <Skeleton className="h-4 w-40 rounded-md" />
          <Skeleton className="h-4 w-36 rounded-md" />
          <Skeleton className="h-4 w-32 rounded-md" />
        </View>
      ) : error || !share ? (
        <Text className="px-2.5 py-1.5 text-sm text-destructive">
          {errorMessage(error, 'Couldn’t load your access.')}
        </Text>
      ) : (
        <View className="gap-1 px-2.5 py-1">
          <Perm allowed label="See tasks" />
          <Perm allowed={share.can_create} label="Create tasks" />
          <Perm allowed={share.can_edit} label="Edit tasks" />
          <Perm allowed={share.can_delete} label="Delete tasks" />
          <Perm allowed={view.showSubtasks !== false} label="Subtasks" />
        </View>
      )}
      {statuses || tags ? (
        <Text className="px-2.5 pt-2 text-xs text-text-subtle">
          Limited to{statuses ? ` ${statuses.join(', ')}` : ''}
          {statuses && tags ? ' ·' : ''}
          {tags ? ` ${tags.join(', ')}` : ''}
        </Text>
      ) : null}
      {share?.share_notes ? (
        <Text className="px-2.5 pt-2 text-xs italic text-text-main">“{share.share_notes}”</Text>
      ) : null}
    </View>
  );
}

function Perm({ allowed, label }: { allowed: boolean; label: string }) {
  const c = useThemeColors();
  const Icon = allowed ? Check : X;
  return (
    <View className="flex-row items-center gap-2 py-0.5">
      <Icon size={14} color={allowed ? c.success : c.subtle} />
      <Text className={`text-sm ${allowed ? 'text-text-heading' : 'text-text-subtle'}`}>
        {label}
      </Text>
      {allowed ? null : <Text className="text-2xs text-text-subtle">· not allowed</Text>}
    </View>
  );
}
