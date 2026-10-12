import { useState } from 'react';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CalendarCheck2,
  ChevronLeft,
  Ellipsis,
  LayoutGrid,
  Plus,
  Search,
} from 'lucide-react-native';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  activeViewIdAtom,
  itemFormAtom,
  searchOpenAtom,
  viewsAtom,
} from '../../atoms/project';
import { profileAtom, profileOpenAtom } from '../../atoms/profile';
import { toast } from '../../atoms/feedback';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useViewUrlSync } from '../../hooks/useViewUrlSync';
import { useViewsSync } from '../../hooks/useViewsSync';
import { useTasksSync } from '../../hooks/useTasksSync';
import { useShortcuts } from '../../hooks/useShortcuts';
import { VIEW_TYPES } from '../../data/constants';
import type { ProjectView, ViewType } from '../../data/types';
import { Button, EmptyState, IconButton, Kbd, Press } from '../ui';
import { CalendarView } from './CalendarView';
import { ItemFormModal } from './ItemFormModal';
import { ItemModal } from './ItemModal';
import { KanbanView } from './KanbanView';
import { ProfileEditModal } from './ProfileEditModal';
import { ProfileModal } from './ProfileModal';
import { MobileHome } from './MobileHome';
import { RoadmapView } from './RoadmapView';
import { SearchModal } from './SearchModal';
import { InitialsAvatar } from './shared';
import { TableView } from './TableView';
import { TeamPlanningView } from './TeamPlanningView';
import { ViewModal, type ViewDraft } from './ViewModal';
import { ShareViewModal } from './ShareViewModal';
import { ViewMenuModal } from './ViewMenuModal';

// Width at which the view tabs become a left rail.
const WIDE_BREAKPOINT = 1024;

const VIEW_COMPONENTS: Record<
  ViewType,
  (props: { view: ProjectView }) => React.JSX.Element
> = {
  table: TableView,
  team: TeamPlanningView,
  kanban: KanbanView,
  roadmap: RoadmapView,
  calendar: CalendarView,
};

// GitHub-Projects-style workspace: a saved view per rail entry (desktop) or tab
// (phone), "+" to add one, and Share/Edit/Delete from each view's "⋯" menu.
export function ProjectScreen({ onSignOut }: { onSignOut?: () => void }) {
  const setItemForm = useSetAtom(itemFormAtom);
  const setSearchOpen = useSetAtom(searchOpenAtom);
  const [mobileHome, setMobileHome] = useState(true);
  const setProfileOpen = useSetAtom(profileOpenAtom);
  const profile = useAtomValue(profileAtom);
  const { width } = useWindowDimensions();
  const c = useThemeColors();
  const [views, setViews] = useAtom(viewsAtom);
  const [activeId, setActiveId] = useAtom(activeViewIdAtom);
  const { addView, editView, removeView, restoreView } = useViewsSync();
  useViewUrlSync();
  // undefined = closed, null = creating, ProjectView = editing.
  const [modalView, setModalView] = useState<ProjectView | null | undefined>(
    undefined,
  );
  const [shareView, setShareView] = useState<ProjectView | null>(null);
  // Which view's "⋯" action sheet (Share/Edit/Delete) is open, if any.
  const [menuView, setMenuView] = useState<ProjectView | null>(null);

  const active = views.find(v => v.id === activeId) ?? views[0];
  const ActiveView = active ? VIEW_COMPONENTS[active.type] : null;
  useTasksSync(active);

  const wide = width >= WIDE_BREAKPOINT;
  const newTask = () => setItemForm({ mode: 'new' });
  const openSearch = () => setSearchOpen(true);

  useShortcuts({
    n: () => ActiveView && newTask(),
    '/': openSearch,
    v: () => setModalView(null),
  });

  const save = async (draft: ViewDraft) => {
    setModalView(undefined);
    if (modalView) {
      await editView({ ...modalView, ...draft });
      toast.success('View saved');
    } else {
      const id = await addView(draft);
      setActiveId(id);
      toast.success(`Created “${draft.name}”`);
    }
  };

  const restore = async (view: ProjectView, index: number) => {
    // The API has no restore — this recreates the view, so it gets a new id and
    // (server-side) lands at the end rather than back at its original slot.
    const id = await restoreView(view);
    setViews(prev => {
      if (prev.some(v => v.id === id)) {
        return prev;
      }
      const next = [...prev];
      next.splice(Math.min(index, next.length), 0, { ...view, id });
      return next;
    });
    setActiveId(id);
  };

  // Takes the view explicitly — called from the ViewModal's own Delete button
  // (editing that view) and from the "⋯" action sheet's Delete row (no modal
  // open at all) alike.
  const remove = async (removed: ProjectView) => {
    const index = views.indexOf(removed);
    const rest = views.filter(v => v.id !== removed.id);
    setViews(rest);
    if (activeId === removed.id) {
      setActiveId(rest[0]?.id ?? '');
    }
    setModalView(undefined);
    toast.info(`Deleted “${removed.name}”`, {
      action: { label: 'Undo', onPress: () => restore(removed, index) },
    });
    await removeView(removed);
  };

  const onShareView = (v: ProjectView) => {
    setModalView(undefined);
    setMenuView(null);
    setShareView(v);
  };

  const viewIcon = (type: ViewType, color: string, size = 16) => {
    const Icon = VIEW_TYPES.find(t => t.key === type)?.icon;
    return Icon ? <Icon size={size} color={color} strokeWidth={2} /> : null;
  };

  // ── Desktop: left rail ────────────────────────────────────────────────────
  const rail = (
    <View className="w-[248px] border-r border-border-main bg-bg-main">
      <View className="flex-row items-center gap-2.5 px-4 pb-3 pt-4">
        <View className="h-7 w-7 items-center justify-center rounded-lg bg-accent">
          <CalendarCheck2 size={16} color={c.accentForeground} strokeWidth={2.25} />
        </View>
        <Text className="flex-1 text-base font-semibold text-text-heading">YTC</Text>
        <IconButton icon={Plus} label="New task (N)" onPress={newTask} variant="outline" />
      </View>

      <View className="px-3 pb-2">
        <Press
          feedback="subtle"
          accessibilityRole="button"
          accessibilityLabel="Search tasks"
          onPress={openSearch}
          className="h-8 flex-row items-center gap-2 rounded-lg border border-border-main bg-bg-card px-2.5 hover:border-border-strong"
        >
          <Search size={14} color={c.subtle} />
          <Text className="flex-1 text-sm text-text-subtle">Search tasks</Text>
          <Kbd>/</Kbd>
        </Press>
      </View>

      <View className="flex-row items-center justify-between pb-1 pl-5 pr-3 pt-3">
        <Text className="text-2xs font-semibold uppercase tracking-wider text-text-subtle">
          Views
        </Text>
        <IconButton icon={Plus} label="New view (V)" size="sm" onPress={() => setModalView(null)} />
      </View>

      <ScrollView className="flex-1" contentContainerClassName="gap-px px-3 pb-3">
        {views.map(v => {
          const isActive = v.id === active?.id;
          return (
            <View key={v.id} className="group flex-row items-center">
              <Press
                feedback="subtle"
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                onPress={() => setActiveId(v.id)}
                className={`h-8 flex-1 flex-row items-center gap-2.5 rounded-lg pl-2.5 pr-8 ${
                  isActive ? 'bg-hover' : 'hover:bg-hover/70'
                }`}
              >
                {viewIcon(v.type, isActive ? c.heading : c.text)}
                <Text
                  numberOfLines={1}
                  className={`flex-1 text-sm ${
                    isActive ? 'font-medium text-text-heading' : 'text-text-main'
                  }`}
                >
                  {v.name}
                </Text>
              </Press>
              <View
                className={`absolute right-1 ${isActive ? '' : 'reveal-on-hover'}`}
              >
                <IconButton
                  icon={Ellipsis}
                  label={`Options for ${v.name}`}
                  size="sm"
                  onPress={() => setMenuView(v)}
                />
              </View>
            </View>
          );
        })}
      </ScrollView>

      <Press
        feedback="subtle"
        accessibilityRole="button"
        accessibilityLabel="Open profile"
        onPress={() => setProfileOpen(true)}
        className="m-2 flex-row items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-hover"
      >
        <InitialsAvatar color={profile.color} initials={profile.initials} size={28} />
        <View className="flex-1">
          <Text numberOfLines={1} className="text-sm font-medium text-text-heading">
            {profile.name || 'Account'}
          </Text>
          {profile.email || profile.role ? (
            <Text numberOfLines={1} className="text-xs text-text-subtle">
              {profile.role || profile.email}
            </Text>
          ) : null}
        </View>
      </Press>
    </View>
  );

  // ── Content area header (desktop) ─────────────────────────────────────────
  const viewHeader = active ? (
    <View className="h-14 flex-row items-center gap-3 border-b border-border-main bg-bg-card px-6">
      {viewIcon(active.type, c.text, 18)}
      <View className="flex-1 flex-row items-baseline gap-3">
        <Text numberOfLines={1} className="text-base font-semibold text-text-heading">
          {active.name}
        </Text>
        {active.description ? (
          <Text numberOfLines={1} className="flex-1 text-sm text-text-subtle">
            {active.description}
          </Text>
        ) : null}
      </View>
      <IconButton
        icon={Ellipsis}
        label="View options"
        onPress={() => setMenuView(active)}
      />
      <Button variant="primary" icon={Plus} onPress={newTask}>
        New task
      </Button>
    </View>
  ) : null;

  const content =
    ActiveView && active ? (
      <ActiveView key={active.id} view={active} />
    ) : (
      <EmptyState
        icon={LayoutGrid}
        title="No views yet"
        description="Views are saved layouts of your tasks — a board, a calendar, a table. Create one to get started."
        action={
          <Button variant="primary" icon={Plus} onPress={() => setModalView(null)}>
            Create a view
          </Button>
        }
      />
    );

  // ── Phone: header + tab strip ─────────────────────────────────────────────
  const phoneHeader = (
    <View className="flex-row items-center gap-1 border-b border-border-main bg-bg-card px-2 pb-1 pt-2">
      <IconButton icon={ChevronLeft} label="Back to home" onPress={() => setMobileHome(true)} size="lg" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="items-center gap-1 pr-2"
        className="flex-1"
      >
        {views.map(v => {
          const isActive = v.id === active?.id;
          return (
            <Press
              key={v.id}
              feedback="subtle"
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              onPress={() => setActiveId(v.id)}
              onLongPress={() => setMenuView(v)}
              className={`h-9 flex-row items-center gap-1.5 rounded-lg px-3 ${
                isActive ? 'bg-hover' : ''
              }`}
            >
              {viewIcon(v.type, isActive ? c.heading : c.text, 15)}
              <Text
                numberOfLines={1}
                className={`text-sm ${
                  isActive ? 'font-semibold text-text-heading' : 'text-text-main'
                }`}
              >
                {v.name}
              </Text>
            </Press>
          );
        })}
      </ScrollView>
      <IconButton icon={Search} label="Search" onPress={openSearch} size="lg" />
      {active ? (
        <IconButton icon={Ellipsis} label="View options" onPress={() => setMenuView(active)} size="lg" />
      ) : null}
    </View>
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-bg-main">
      {wide ? (
        <View className="flex-1 flex-row">
          {rail}
          <View className="flex-1">
            {viewHeader}
            <View className="flex-1">{content}</View>
          </View>
        </View>
      ) : mobileHome ? (
        <MobileHome
          views={views}
          activeId={active?.id ?? ''}
          onOpenView={id => {
            setActiveId(id);
            setMobileHome(false);
          }}
          onNewView={() => setModalView(null)}
          onOpenProfile={() => setProfileOpen(true)}
          onSearch={openSearch}
        />
      ) : (
        <>
          {phoneHeader}
          <View className="flex-1">{content}</View>
          {ActiveView ? (
            <View className="absolute bottom-6 right-5">
              <Press
                accessibilityRole="button"
                accessibilityLabel="New task"
                onPress={newTask}
                style={{ elevation: 6, boxShadow: '0 8px 24px -6px rgba(0,0,0,0.35)' } as object}
                className="h-14 w-14 items-center justify-center rounded-2xl bg-accent"
              >
                <Plus size={24} color={c.accentForeground} strokeWidth={2.25} />
              </Press>
            </View>
          ) : null}
        </>
      )}

      <ItemModal />
      <ItemFormModal />
      <SearchModal />
      <ViewModal
        visible={modalView !== undefined}
        view={modalView ?? null}
        onClose={() => setModalView(undefined)}
        onSave={save}
        onDelete={() => modalView && remove(modalView)}
        onShare={onShareView}
      />
      <ShareViewModal
        visible={!!shareView}
        view={shareView}
        onClose={() => setShareView(null)}
      />
      <ViewMenuModal
        visible={!!menuView}
        view={menuView}
        onClose={() => setMenuView(null)}
        onShare={v => onShareView(v)}
        onEdit={v => {
          setMenuView(null);
          setModalView(v);
        }}
        onDelete={v => {
          setMenuView(null);
          remove(v);
        }}
      />
      <ProfileModal onSignOut={onSignOut} />
      <ProfileEditModal />
    </SafeAreaView>
  );
}
