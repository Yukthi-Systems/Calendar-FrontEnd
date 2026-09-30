import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MoreHorizontal, Plus } from 'lucide-react-native';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { activeViewIdAtom, itemFormAtom, viewsAtom } from '../../atoms/project';
import { profileAtom, profileOpenAtom } from '../../atoms/profile';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useViewUrlSync } from '../../hooks/useViewUrlSync';
import { VIEW_TYPES } from '../../data/constants';
import type { ProjectView, ViewType } from '../../data/types';
import { CalendarView } from './CalendarView';
import { ItemFormModal } from './ItemFormModal';
import { ItemModal } from './ItemModal';
import { KanbanView } from './KanbanView';
import { ProfileEditModal } from './ProfileEditModal';
import { ProfileModal } from './ProfileModal';
import { RoadmapView } from './RoadmapView';
import { InitialsAvatar } from './shared';
import { TableView } from './TableView';
import { TeamPlanningView } from './TeamPlanningView';
import { UndoToast } from './UndoToast';
import { ViewModal } from './ViewModal';

// Width at which the view tabs become a left rail.
const WIDE_BREAKPOINT = 1024;

const VIEW_COMPONENTS: Record<ViewType, () => React.JSX.Element> = {
  table: TableView,
  team: TeamPlanningView,
  kanban: KanbanView,
  roadmap: RoadmapView,
  calendar: CalendarView,
};

// GitHub-Projects-style workspace: a tab per saved view, "+ New view" to add one,
// and edit/delete on the active tab.
export function ProjectScreen({ onSignOut }: { onSignOut?: () => void }) {
  const setItemForm = useSetAtom(itemFormAtom);
  const setProfileOpen = useSetAtom(profileOpenAtom);
  const profile = useAtomValue(profileAtom);
  const { width } = useWindowDimensions();
  const { heading, text, accent } = useThemeColors();
  const [views, setViews] = useAtom(viewsAtom);
  const [activeId, setActiveId] = useAtom(activeViewIdAtom);
  useViewUrlSync();
  // undefined = closed, null = creating, ProjectView = editing.
  const [modalView, setModalView] = useState<ProjectView | null | undefined>(
    undefined,
  );

  const [undo, setUndo] = useState<{ view: ProjectView; index: number } | null>(
    null,
  );
  const undoTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(undoTimer.current), []);

  const active = views.find(v => v.id === activeId) ?? views[0];
  const ActiveView = active ? VIEW_COMPONENTS[active.type] : null;

  const save = (name: string, type: ViewType) => {
    if (modalView) {
      setViews(prev =>
        prev.map(v => (v.id === modalView.id ? { ...v, name, type } : v)),
      );
    } else {
      const id = `v-${Date.now()}`;
      setViews(prev => [...prev, { id, name, type }]);
      setActiveId(id);
    }
    setModalView(undefined);
  };

  const remove = () => {
    if (!modalView) {
      return;
    }
    const rest = views.filter(v => v.id !== modalView.id);
    setUndo({ view: modalView, index: views.indexOf(modalView) });
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), 6000);
    setViews(rest);
    if (activeId === modalView.id) {
      setActiveId(rest[0]?.id ?? '');
    }
    setModalView(undefined);
  };

  const restore = () => {
    if (!undo) {
      return;
    }
    clearTimeout(undoTimer.current);
    setViews(prev => {
      const next = [...prev];
      next.splice(Math.min(undo.index, next.length), 0, undo.view);
      return next;
    });
    setActiveId(undo.view.id);
    setUndo(null);
  };

  const wide = width >= WIDE_BREAKPOINT;

  const header = (
    <View className="flex-row items-center justify-between px-4 pb-1 pt-3">
      <View>
        <Text className="text-xl font-bold text-text-heading">YTC</Text>
        <Text className="text-xs text-text-main">Team project</Text>
      </View>
      {wide ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New task"
          onPress={() => setItemForm({ mode: 'new' })}
          className="h-9 w-9 items-center justify-center rounded-lg border border-border-main active:opacity-70"
        >
          <Plus size={18} color={heading} />
        </Pressable>
      ) : (
        // Narrow screens have no rail to pin the profile row to (see
        // profileRow below), so it lives in the header here instead.
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open profile"
          onPress={() => setProfileOpen(true)}
          className="active:opacity-70"
        >
          <InitialsAvatar
            color={profile.color}
            initials={profile.initials}
            size={32}
          />
        </Pressable>
      )}
    </View>
  );

  // Pinned at the foot of the left rail (Notion/Slack-style account row) —
  // avatar, name and role, opening the same profile sheet the header used to.
  const profileRow = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open profile"
      onPress={() => setProfileOpen(true)}
      className="flex-row items-center gap-2.5 border-t border-border-main px-4 py-3 active:opacity-70"
    >
      <InitialsAvatar
        color={profile.color}
        initials={profile.initials}
        size={32}
      />
      <View className="flex-1">
        <Text
          numberOfLines={1}
          className="text-sm font-semibold text-text-heading"
        >
          {profile.name}
        </Text>
        <Text numberOfLines={1} className="text-xs text-text-main">
          {profile.role}
        </Text>
      </View>
    </Pressable>
  );

  const newViewButton = (
    <Pressable
      accessibilityRole="button"
      onPress={() => setModalView(null)}
      className="rounded-lg px-2.5 py-1.5 active:opacity-70"
    >
      <View className="flex-row items-center gap-1">
        <Plus size={16} color={accent} />
        <Text className="font-medium text-accent">New view</Text>
      </View>
    </Pressable>
  );

  const editButton = (v: ProjectView) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Edit ${v.name}`}
      onPress={() => setModalView(v)}
      className="rounded-md px-1.5 py-1 active:opacity-70"
    >
      <MoreHorizontal size={18} color={text} />
    </Pressable>
  );

  // `fill`: true in the left rail, where the row is stretched to the rail's
  // width by its parent, so flex-1 has something to grow against. In the
  // horizontal tab strip the row sizes to its content instead — flex-1 there
  // has no width to grow against and every tab collapses to nothing.
  const viewButton = (v: ProjectView, isActive: boolean, fill: boolean) => (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      onPress={() => setActiveId(v.id)}
      className={`flex-row items-center gap-1.5 py-2.5 pl-2 pr-1.5 active:opacity-70 ${
        fill ? 'flex-1' : ''
      }`}
    >
      <TabIcon type={v.type} color={isActive ? heading : text} />
      <Text
        numberOfLines={1}
        className={
          isActive ? 'font-semibold text-text-heading' : 'text-text-main'
        }
      >
        {v.name}
      </Text>
    </Pressable>
  );

  const content = (
    <View className="flex-1">
      {ActiveView ? (
        <ActiveView />
      ) : (
        <View className="flex-1 items-center justify-center gap-3 px-6">
          <Text className="text-text-main">No views yet.</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setModalView(null)}
            className="rounded-2xl bg-accent px-5 py-3 active:opacity-80"
          >
            <Text className="font-semibold text-white">Create a view</Text>
          </Pressable>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-bg-main">
      {wide ? (
        // Desktop: views live in a left rail, content gets the rest. The
        // profile row is a sibling of the scrolling view list (not inside
        // it), so it stays pinned to the rail's bottom edge regardless of
        // how many views there are to scroll through.
        <View className="flex-1 flex-row">
          <View className="w-64 flex-col border-r border-border-main">
            {header}
            <ScrollView
              className="flex-1"
              contentContainerClassName="gap-0.5 p-2"
            >
              {views.map(v => {
                const isActive = v.id === active?.id;
                return (
                  <View
                    key={v.id}
                    className={`flex-row items-center rounded-lg pl-1 pr-1 ${
                      isActive ? 'bg-accent/10' : ''
                    }`}
                  >
                    {viewButton(v, isActive, true)}
                    {isActive ? editButton(v) : null}
                  </View>
                );
              })}
              <View className="mt-2 items-start">{newViewButton}</View>
            </ScrollView>
            {profileRow}
          </View>
          <View className="flex-1">{content}</View>
        </View>
      ) : (
        <>
          {header}
          <View className="border-b border-border-main">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="items-center gap-1 px-3"
            >
              {views.map(v => {
                const isActive = v.id === active?.id;
                return (
                  <View
                    key={v.id}
                    className={`flex-row items-center border-b-2 ${
                      isActive ? 'border-accent' : 'border-transparent'
                    }`}
                  >
                    {viewButton(v, isActive, false)}
                    {isActive ? editButton(v) : <View className="w-2" />}
                  </View>
                );
              })}
              {newViewButton}
            </ScrollView>
          </View>
          {content}
        </>
      )}

      {undo ? (
        <UndoToast message={`Deleted "${undo.view.name}"`} onUndo={restore} />
      ) : null}
      {ActiveView ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New item"
          onPress={() => setItemForm({ mode: 'new' })}
          className="absolute bottom-6 right-6 h-14 w-14 items-center justify-center rounded-full bg-accent shadow-lg active:opacity-80"
        >
          <Plus size={26} color="#ffffff" />
        </Pressable>
      ) : null}
      <ItemModal />
      <ItemFormModal />
      <ViewModal
        visible={modalView !== undefined}
        view={modalView ?? null}
        onClose={() => setModalView(undefined)}
        onSave={save}
        onDelete={remove}
      />
      <ProfileModal onSignOut={onSignOut} />
      <ProfileEditModal />
    </SafeAreaView>
  );
}

function TabIcon({ type, color }: { type: ViewType; color: string }) {
  const Icon = VIEW_TYPES.find(t => t.key === type)?.icon;
  return Icon ? <Icon size={16} color={color} /> : null;
}
