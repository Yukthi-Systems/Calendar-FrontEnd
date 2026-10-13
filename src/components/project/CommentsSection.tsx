import { Text, View } from 'react-native';
import { MessageSquare } from 'lucide-react-native';
import { useThemeColors } from '../../hooks/useThemeColors';

// Task comments. Tasks-Main-API has a task_comments table but its /comments routes
// are still commented out (docs/BACKEND.md §8), so there is nowhere to read or
// save a comment yet. Comments used to be kept on this device only — invisible to
// everyone else and lost on another device — which is worse than not having them,
// so this says so plainly instead. Rebuild the thread on TanStack Query (like
// src/hooks/useViews.ts) once the backend enables the routes.
export function CommentsSection() {
  const c = useThemeColors();
  return (
    <View>
      <View className="mb-3 flex-row items-center gap-2">
        <MessageSquare size={15} color={c.text} />
        <Text className="text-sm font-semibold text-text-heading">Comments</Text>
      </View>
      <View className="rounded-lg border border-dashed border-border-strong px-3 py-3">
        <Text className="text-sm text-text-main">
          Comments are coming soon .
        </Text>
      </View>
    </View>
  );
}
