import { useRef, useState, type RefObject } from 'react';
import {
  ScrollView,
  Text,
  useWindowDimensions,
  View,
  type ViewInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CalendarCheck2,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  CloudOff,
  Ellipsis,
  LayoutGrid,
  ListTodo,
  MessageSquareText,
  Plus,
  RefreshCw,
  Repeat,
  Search,
  Table2,
} from 'lucide-react-native';
import { useAtom, useSetAtom } from 'jotai';
import {
  activeViewIdAtom,
  contentModeAtom,
  itemFormAtom,
  recurringFormAtom,
  searchOpenAtom,
  type ContentMode,
} from '../../atoms/project';
import { profileOpenAtom } from '../../atoms/profile';
import { useMyProfile, usePerson } from '../../hooks/useUsers';
import { errorMessage, toast } from '../../atoms/feedback';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useViewUrlSync } from '../../hooks/useViewUrlSync';
import {
  useActiveView,
  useMyShare,
  useViewAccess,
  useViewList,
  useViewMutations,
  type ViewDraftFields,
} from '../../hooks/useViews';
import { useTasksSync } from '../../hooks/useTasksSync';
import { useRefresh } from '../../hooks/useRefresh';
import { useShortcuts } from '../../hooks/useShortcuts';
import { VIEW_TYPES } from '../../data/constants';
import type { ProjectView, ViewType } from '../../data/types';
import {
  Badge,
  Button,
  EmptyState,
  IconButton,
  Kbd,
  Popover,
  Press,
  SegmentedControl,
  Skeleton,
} from '../ui';
import { CalendarView } from './CalendarView';
import { ItemFormModal } from './ItemFormModal';
import { ItemModal } from './ItemModal';
import { KanbanView } from './KanbanView';
import { ProfileEditModal } from './ProfileEditModal';
import { ProfileModal } from './ProfileModal';
import { MobileHome } from './MobileHome';
import { RecurringTasksView } from './RecurringTasksView';
import { RoadmapView } from './RoadmapView';
import { SearchModal } from './SearchModal';
import { InitialsAvatar } from './shared';
import { TableView } from './TableView';
import { ViewModal } from './ViewModal';
import { ShareViewModal } from './ShareViewModal';
import { ViewMenuModal } from './ViewMenuModal';

const MODE_OPTIONS: { key: ContentMode; label: string; icon: typeof ListTodo }[] = [
  { key: 'tasks', label: 'Tasks', icon: ListTodo },
  { key: 'recurring', label: 'Recurring', icon: Repeat },
];

// Width at which the view tabs become a left rail.
const WIDE_BREAKPOINT = 1024;

const VIEW_COMPONENTS: Record<
  ViewType,
  (props: { view: ProjectView }) => React.JSX.Element
> = {
  table: TableView,
  kanban: KanbanView,
  roadmap: RoadmapView,
  calendar: CalendarView,
};

// GitHub-Projects-style workspace: a saved view per rail entry (desktop) or tab
// (phone), "+" to add one, and Share/Edit/Delete from each view's "⋯" menu.
export function ProjectScreen({ onSignOut }: { onSignOut?: () => void }) {
  const setItemForm = useSetAtom(itemFormAtom);
  const setRecurringForm = useSetAtom(recurringFormAtom);
  const setSearchOpen = useSetAtom(searchOpenAtom);
  const [mobileHome, setMobileHome] = useState(true);
  const setProfileOpen = useSetAtom(profileOpenAtom);
  const profile = useMyProfile();
  const { width } = useWindowDimensions();
  const c = useThemeColors();
  const { views, myViews, sharedViews, ready, isLoading, error, refetch } = useViewList();
  const setActiveId = useSetAtom(activeViewIdAtom);
  const { createView, updateView, deleteView } = useViewMutations();
  useViewUrlSync();
  // undefined = closed, null = creating, ProjectView = editing.
  const [modalView, setModalView] = useState<ProjectView | null | undefined>(
    undefined,
  );
  const [shareView, setShareView] = useState<ProjectView | null>(null);
  // Tasks (the view's own table/kanban/roadmap/calendar) or that view's library
  // of recurring templates (/recurring) — both scoped to whichever view the
  // switcher below has selected.
  const [contentMode, setContentMode] = useAtom(contentModeAtom);
  const [viewPickerOpen, setViewPickerOpen] = useState(false);
  // Which view's "⋯" action sheet (Share/Edit/Delete) is open, if any.
  const [menuView, setMenuView] = useState<ProjectView | null>(null);
  // The ⋯ button the menu drops down from; null (phone long-press) = bottom sheet.
  const [menuAnchor, setMenuAnchor] = useState<RefObject<ViewInstance | null> | null>(null);
  const openMenu = (v: ProjectView, anchor: RefObject<ViewInstance | null> | null = null) => {
    setMenuAnchor(anchor);
    setMenuView(v);
  };

  const active = useActiveView();
  const ActiveView = active ? VIEW_COMPONENTS[active.type] : null;
  useTasksSync(active);

  const wide = width >= WIDE_BREAKPOINT;
  // New task only where I may create (always in my own views; per share otherwise).
  const { canCreate } = useViewAccess(active);
  const newTask = () => setItemForm({ mode: 'new' });
  const openSearch = () => setSearchOpen(true);
  const { refresh, refreshing } = useRefresh();

  useShortcuts({
    n: () => contentMode === 'tasks' && ActiveView && canCreate && newTask(),
    r: refresh,
    '/': () => contentMode === 'tasks' && openSearch(),
    v: () => setModalView(null),
  });

  // Every write goes to the server; the list on screen is refetched from it.
  const create = async (draft: ViewDraftFields) => {
    try {
      const id = await createView(draft);
      if (id) {
        setActiveId(id);
      }
      toast.success(`Created “${draft.name}”`);
    } catch (err) {
      toast.error('Couldn’t create the view', {
        description: errorMessage(err, 'Please try again.'),
      });
    }
  };

  const save = async (draft: ViewDraftFields) => {
    const editing = modalView;
    setModalView(undefined);
    if (!editing) {
      await create(draft);
      return;
    }
    try {
      await updateView({ ...editing, ...draft });
      toast.success('View saved');
    } catch (err) {
      toast.error('Couldn’t save the view', {
        description: errorMessage(err, 'Please try again.'),
      });
    }
  };

  // Called from the ViewModal's own Delete button and the "⋯" menu alike. The API
  // has no restore — Undo recreates the view (it gets a new id).
  const remove = async (removed: ProjectView) => {
    setModalView(undefined);
    try {
      await deleteView(removed);
      const draft: ViewDraftFields = {
        name: removed.name,
        type: removed.type,
        description: removed.description,
        fields: removed.fields,
        statusFilter: removed.statusFilter,
        tagFilter: removed.tagFilter,
        showRecurring: removed.showRecurring,
        showComments: removed.showComments,
        showSubtasks: removed.showSubtasks,
        showAssigned: removed.showAssigned,
      };
      toast.info(`Deleted “${removed.name}”`, {
        action: { label: 'Undo', onPress: () => create(draft) },
      });
    } catch (err) {
      toast.error('Couldn’t delete the view', {
        description: errorMessage(err, 'Please try again.'),
      });
    }
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

  const railItem = (v: ProjectView) => {
    const isActive = v.id === active?.id;
    return (
      <View key={v.id} className="group flex-row items-center">
        <Press
          feedback="subtle"
          accessibilityRole="tab"
          accessibilityState={{ selected: isActive }}
          onPress={() => {
            setActiveId(v.id);
            setViewPickerOpen(false);
          }}
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
          {/* Same spot as the row's ⋯/check — they take turns (see web.css). */}
          {isActive ? (
            <Check size={14} color={c.accent} />
          ) : v.shared ? (
            <View className="hide-on-hover">
              <OwnerAvatar ownerId={v.ownerId} />
            </View>
          ) : null}
        </Press>
        <View className={`absolute right-1 ${isActive ? '' : 'reveal-on-hover'}`}>
          <MenuButton label={`Options for ${v.name}`} size="sm" onOpen={ref => openMenu(v, ref)} />
        </View>
      </View>
    );
  };

  // The view switcher's dropdown content — the list that used to be the whole
  // rail, now tucked behind the trigger button instead of always on screen.
  const viewPickerList = (
    <ScrollView className="max-h-[360px]" contentContainerClassName="gap-px p-1.5">
      {isLoading ? (
        <View className="gap-2 px-1.5 py-1">
          <Skeleton className="h-6 w-40 rounded-md" />
          <Skeleton className="h-6 w-32 rounded-md" />
        </View>
      ) : null}
      {myViews.map(v => railItem(v))}
      {sharedViews.length > 0 ? (
        <>
          <Text className="pb-1 pl-2 pt-4 text-2xs font-semibold uppercase tracking-wider text-text-subtle">
            Shared with me
          </Text>
          {sharedViews.map(v => railItem(v))}
        </>
      ) : null}
      <View className="mt-1 border-t border-border-main pt-1">
        <Press
          feedback="subtle"
          accessibilityRole="button"
          onPress={() => {
            setViewPickerOpen(false);
            setModalView(null);
          }}
          className="h-8 flex-row items-center gap-2.5 rounded-lg pl-2.5"
        >
          <Plus size={16} color={c.accent} />
          <Text className="text-sm font-medium text-accent">New view</Text>
          <View className="flex-1 items-end pr-2">
            <Kbd>V</Kbd>
          </View>
        </Press>
      </View>
    </ScrollView>
  );

  // ── Desktop: left rail ────────────────────────────────────────────────────
  const rail = (
    <View className="w-[248px] border-r border-border-main bg-bg-main">
      <View className="flex-row items-center gap-2.5 px-4 pb-3 pt-4">
        <View className="h-7 w-7 items-center justify-center rounded-lg bg-accent">
          <CalendarCheck2 size={16} color={c.accentForeground} strokeWidth={2.25} />
        </View>
        {/* The workspace is the organization's — its name, from the user's record
            (SSO session as a fallback); "YTC" only until that's known. */}
        <Text numberOfLines={1} className="flex-1 text-base font-semibold text-text-heading">
          {profile.organization || 'YTC'}
        </Text>
      </View>

      <View className="flex-row items-center gap-1.5 px-3 pb-4">
        <Popover
          open={viewPickerOpen}
          onClose={() => setViewPickerOpen(false)}
          width={248}
          variant="menu"
          renderTrigger={ref => (
            <View ref={ref} className="flex-1">
              <Press
                feedback="subtle"
                accessibilityRole="button"
                accessibilityLabel="Switch view"
                onPress={() => setViewPickerOpen(o => !o)}
                className="h-9 flex-row items-center gap-2 rounded-lg border border-border-main bg-bg-card px-2.5 hover:border-border-strong"
              >
                {active ? viewIcon(active.type, c.text) : null}
                <Text numberOfLines={1} className="flex-1 text-sm font-medium text-text-heading">
                  {active?.name ?? 'Select a view'}
                </Text>
                <ChevronDown size={14} color={c.subtle} />
              </Press>
            </View>
          )}
        >
          {viewPickerList}
        </Popover>
        <IconButton
          icon={Plus}
          label="New view"
          onPress={() => {
            setViewPickerOpen(false);
            setModalView(null);
          }}
        />
      </View>

      <View className="gap-0.5 px-3 pb-3">
        {MODE_OPTIONS.map(opt => {
          const isActive = contentMode === opt.key;
          return (
            <Press
              key={opt.key}
              feedback="subtle"
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              onPress={() => setContentMode(opt.key)}
              className={`h-8 flex-row items-center gap-2.5 rounded-lg pl-2.5 ${
                isActive ? 'bg-hover' : 'hover:bg-hover/70'
              }`}
            >
              <opt.icon size={16} color={isActive ? c.heading : c.text} strokeWidth={2} />
              <Text
                className={`text-sm ${
                  isActive ? 'font-medium text-text-heading' : 'text-text-main'
                }`}
              >
                {opt.label}
              </Text>
            </Press>
          );
        })}
      </View>

      <View className="flex-1" />

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
        {active.shared ? <SharedByBadge ownerId={active.ownerId} /> : null}
        {active.description ? (
          <Text numberOfLines={1} className="flex-1 text-sm text-text-subtle">
            {active.description}
          </Text>
        ) : null}
      </View>
      {contentMode === 'tasks' ? (
        <Press
          feedback="subtle"
          accessibilityRole="button"
          accessibilityLabel="Search tasks"
          onPress={openSearch}
          className="h-8 flex-row items-center gap-2 rounded-lg border border-border-main bg-bg-main px-2.5 hover:border-border-strong"
        >
          <Search size={14} color={c.subtle} />
          <Text className="text-sm text-text-subtle">Search tasks</Text>
          <Kbd>/</Kbd>
        </Press>
      ) : null}
      <IconButton
        icon={RefreshCw}
        label={refreshing ? 'Refreshing…' : 'Refresh (R)'}
        disabled={refreshing}
        onPress={refresh}
      />
      <MenuButton label="View options" onOpen={ref => openMenu(active, ref)} />
      {contentMode === 'tasks' && canCreate ? (
        <Button variant="primary" icon={Plus} onPress={newTask}>
          New task
        </Button>
      ) : null}
      {contentMode === 'recurring' && canCreate ? (
        <Button variant="primary" icon={Plus} onPress={() => setRecurringForm({ mode: 'new' })}>
          New template
        </Button>
      ) : null}
    </View>
  ) : null;

  const quickCreate = (type: 'table' | 'calendar') =>
    create({
      name: type === 'table' ? 'All tasks' : 'Calendar',
      type,
      showSubtasks: true,
    });

  const content =
    !ready ? (
      <View className="flex-1 gap-3 p-6">
        <Skeleton className="h-8 w-64 rounded-lg" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </View>
    ) : error ? (
      <EmptyState
        icon={CloudOff}
        title="Couldn’t load your views"
        description={errorMessage(error, 'The server didn’t respond.')}
        action={
          <Button variant="primary" onPress={() => refetch()}>
            Try again
          </Button>
        }
      />
    ) : !active ? (
      <EmptyState
        icon={LayoutGrid}
        title="Create your first view"
        description="Views are saved layouts of your tasks — a table, a calendar, a board. Tasks always live inside a view."
        action={
          <View className="flex-row flex-wrap justify-center gap-2">
            <Button variant="primary" icon={Table2} onPress={() => quickCreate('table')}>
              Task table
            </Button>
            <Button icon={CalendarDays} onPress={() => quickCreate('calendar')}>
              Calendar
            </Button>
            <Button variant="ghost" icon={Plus} onPress={() => setModalView(null)}>
              Custom…
            </Button>
          </View>
        }
      />
    ) : contentMode === 'recurring' ? (
      <RecurringTasksView view={active} />
    ) : ActiveView ? (
      <>
        {active.shared ? <SharedNote view={active} /> : null}
        <ActiveView key={active.id} view={active} />
      </>
    ) : null;

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
              onLongPress={() => openMenu(v)}
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
      {contentMode === 'tasks' ? (
        <IconButton icon={Search} label="Search" onPress={openSearch} size="lg" />
      ) : null}
      <IconButton
        icon={RefreshCw}
        label={refreshing ? 'Refreshing…' : 'Refresh'}
        disabled={refreshing}
        onPress={refresh}
        size="lg"
      />
      {active ? (
        <MenuButton label="View options" size="lg" onOpen={ref => openMenu(active, ref)} />
      ) : null}
    </View>
  );

  const modeToggle = active ? (
    <View className="border-b border-border-main bg-bg-card px-3 pb-2">
      <SegmentedControl size="sm" options={MODE_OPTIONS} value={contentMode} onChange={setContentMode} />
    </View>
  ) : null;

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
          {modeToggle}
          <View className="flex-1">{content}</View>
          {canCreate && ((contentMode === 'tasks' && ActiveView) || contentMode === 'recurring') ? (
            <View className="absolute bottom-6 right-5">
              <Press
                accessibilityRole="button"
                accessibilityLabel={contentMode === 'tasks' ? 'New task' : 'New template'}
                onPress={contentMode === 'tasks' ? newTask : () => setRecurringForm({ mode: 'new' })}
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
        anchorRef={menuAnchor}
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

// A ⋯ button that hands its own position to the view menu, so the menu can drop
// down from it. (IconButton doesn't forward refs; the wrapper is what's measured.)
function MenuButton({
  label,
  size,
  onOpen,
}: {
  label: string;
  size?: 'sm' | 'md' | 'lg';
  onOpen: (ref: RefObject<ViewInstance | null>) => void;
}) {
  const ref = useRef<ViewInstance | null>(null);
  return (
    <View ref={ref} collapsable={false}>
      <IconButton icon={Ellipsis} label={label} size={size} onPress={() => onOpen(ref)} />
    </View>
  );
}

// Small avatar of whoever shared a view with me, in the rail.
function OwnerAvatar({ ownerId }: { ownerId: string }) {
  const owner = usePerson(ownerId);
  return owner ? (
    <InitialsAvatar color={owner.color} initials={owner.initials} size={18} />
  ) : null;
}

// The note the owner wrote when sharing this view with me, above the view.
function SharedNote({ view }: { view: ProjectView }) {
  const c = useThemeColors();
  const owner = usePerson(view.ownerId);
  const { data: share } = useMyShare(view);
  const note = share?.share_notes?.trim();
  if (!note) {
    return null;
  }
  return (
    <View className="flex-row items-start gap-2 border-b border-border-main bg-muted px-6 py-2">
      <View className="pt-0.5">
        <MessageSquareText size={14} color={c.subtle} />
      </View>
      <Text numberOfLines={2} className="flex-1 text-sm text-text-main">
        <Text className="font-medium text-text-heading">{owner?.name ?? 'Owner'}: </Text>
        {note}
      </Text>
    </View>
  );
}

function SharedByBadge({ ownerId }: { ownerId: string }) {
  const owner = usePerson(ownerId);
  return <Badge label={`Shared by ${owner?.name ?? '…'}`} size="sm" />;
}
