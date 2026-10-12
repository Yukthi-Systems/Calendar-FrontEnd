import { Text, View } from 'react-native';
import { Pencil, Share2, Trash2 } from 'lucide-react-native';
import { isServerViewId } from '../../data/viewSync';
import { VIEW_TYPES } from '../../data/constants';
import type { ProjectView } from '../../data/types';
import { useThemeColors } from '../../hooks/useThemeColors';
import { MenuItem, MenuSeparator, Sheet } from '../ui';

// The "⋯" action sheet on a view: Share / Edit / Delete, each doing its thing
// directly — no intermediate step through the full edit form. Tapping Edit still
// opens ViewModal (editing is a whole form, not a one-tap action); Share and
// Delete happen right from here (Delete is undoable from the toast).
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
  // A view made while signed out (or not yet pushed to the server) has no row to
  // share — sharing only makes sense once it's actually a server-backed view.
  const canShare = !!view && isServerViewId(view.id);
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
              <Text className="text-xs text-text-subtle">{type?.label} view</Text>
            </View>
          </View>
          <MenuSeparator />
          {canShare ? (
            <MenuItem icon={Share2} label="Share" onPress={() => onShare(view)} />
          ) : null}
          <MenuItem icon={Pencil} label="Edit view" onPress={() => onEdit(view)} />
          <MenuSeparator />
          <MenuItem
            icon={Trash2}
            label="Delete view"
            destructive
            onPress={() => onDelete(view)}
          />
        </View>
      ) : null}
    </Sheet>
  );
}
