import { Modal, Pressable, Text } from 'react-native';
import { Pencil, Share2, Trash2, type LucideIcon } from 'lucide-react-native';
import { useThemeColors } from '../../hooks/useThemeColors';
import { isServerViewId } from '../../data/viewSync';
import type { ProjectView } from '../../data/types';

// The "⋯" action sheet on a view tab: Share / Edit / Delete, each doing its thing
// directly — no intermediate step through the full edit form. Tapping Edit still
// opens ViewModal (editing is a whole form, not a one-tap action); Share and
// Delete happen right from here.
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
  const { text } = useThemeColors();
  // A view made while signed out (or not yet pushed to the server) has no row to
  // share — sharing only makes sense once it's actually a server-backed view.
  const canShare = !!view && isServerViewId(view.id);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        accessibilityLabel="Close"
        onPress={onClose}
        className="flex-1 items-center justify-end bg-black/50 sm:justify-center"
      >
        {view ? (
          <Pressable
            onPress={() => {}}
            className="w-full max-w-sm rounded-t-3xl bg-bg-card p-2 pb-4 sm:rounded-3xl sm:p-2"
          >
            <Text
              numberOfLines={1}
              className="px-3 pb-2 pt-3 text-xs font-semibold uppercase text-text-main"
            >
              {view.name}
            </Text>

            {canShare ? (
              <Row
                icon={Share2}
                label="Share"
                color={text}
                onPress={() => onShare(view)}
              />
            ) : null}
            <Row
              icon={Pencil}
              label="Edit"
              color={text}
              onPress={() => onEdit(view)}
            />
            <Row
              icon={Trash2}
              label="Delete"
              color="#ef4444"
              destructive
              onPress={() => onDelete(view)}
            />
          </Pressable>
        ) : null}
      </Pressable>
    </Modal>
  );
}

function Row({
  icon: Icon,
  label,
  color,
  destructive,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  color: string;
  destructive?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-xl px-3 py-3 active:opacity-70"
    >
      <Icon size={18} color={color} />
      <Text
        className={`text-base ${
          destructive ? 'text-destructive' : 'text-text-heading'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
