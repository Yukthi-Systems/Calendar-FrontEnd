import { Text, View } from 'react-native';
import { Pencil, Trash2, Users } from 'lucide-react-native';
import { VIEW_TYPES } from '../../data/constants';
import type { ProjectView } from '../../data/types';
import { usePerson } from '../../hooks/useUsers';
import { useThemeColors } from '../../hooks/useThemeColors';
import { MenuItem, MenuSeparator, Sheet } from '../ui';

// The "⋯" action sheet on a view. My views: Share & access / Edit / Delete.
// Views shared with me: who shared it — only the owner can change or share it
// (the server refuses everything else), so no actions are offered.
export function ViewMenuModal({
  visible,
  view,
  onClose,
  onShare,
  onEdit,
  onDelete,
}: {
  visible: boolean;
  view: ProjectView | null;
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
    <Sheet visible={visible} onClose={onClose} size="sm">
      {view ? (
        <View className="p-2">
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
            <Text className="px-2.5 py-2 text-sm text-text-main">
              Only {owner?.name ?? 'the owner'} can edit, delete or share this view.
            </Text>
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
    </Sheet>
  );
}
