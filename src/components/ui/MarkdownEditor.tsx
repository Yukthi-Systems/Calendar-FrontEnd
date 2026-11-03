import { useEffect, useRef, useState } from 'react';
import {
  Platform,
  Text,
  TextInput,
  View,
  type TextInputInstance,
  type TextInputSelectionChangeEvent,
  type ViewInstance,
} from 'react-native';
import { useSetAtom } from 'jotai';
import CodeIcon from 'lucide-react-native/icons/code';
import BoldIcon from 'lucide-react-native/icons/bold';
import ItalicIcon from 'lucide-react-native/icons/italic';
import StrikethroughIcon from 'lucide-react-native/icons/strikethrough';
import HeadingIcon from 'lucide-react-native/icons/heading-1';
import LinkIcon from 'lucide-react-native/icons/link';
import QuoteIcon from 'lucide-react-native/icons/quote';
import ListIcon from 'lucide-react-native/icons/list';
import ListOrderedIcon from 'lucide-react-native/icons/list-ordered';
import type { LucideIcon } from 'lucide-react-native';
import { mentionCacheAtom } from '../../atoms/mentions';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useUserSearch, type Person } from '../../hooks/useUsers';
import { Press } from './Press';
import { SuggestPortal } from './SuggestPortal';

type FormatAction = {
  key: string;
  icon: LucideIcon;
  label: string;
  prefix: string;
  suffix: string;
};

// Same toolbar + "wrap the current selection in markdown syntax" pattern as
// this org's YCT-WebUI chat composer (MessageInput.tsx's formattingActions /
// applyFormatting) — a plain text field, not a WYSIWYG editor. The content
// this writes is plain markdown text (see RichText.tsx for the matching
// reader, based on that same project's MessageContent.tsx).
const FORMAT_ACTIONS: FormatAction[] = [
  { key: 'code', icon: CodeIcon, label: 'Code', prefix: '`', suffix: '`' },
  { key: 'bold', icon: BoldIcon, label: 'Bold', prefix: '**', suffix: '**' },
  {
    key: 'italic',
    icon: ItalicIcon,
    label: 'Italic',
    prefix: '_',
    suffix: '_',
  },
  {
    key: 'strike',
    icon: StrikethroughIcon,
    label: 'Strikethrough',
    prefix: '~~',
    suffix: '~~',
  },
  {
    key: 'heading',
    icon: HeadingIcon,
    label: 'Heading',
    prefix: '# ',
    suffix: '',
  },
  {
    key: 'link',
    icon: LinkIcon,
    label: 'Link',
    prefix: '[',
    suffix: '](url)',
  },
  { key: 'quote', icon: QuoteIcon, label: 'Quote', prefix: '> ', suffix: '' },
  {
    key: 'bulletList',
    icon: ListIcon,
    label: 'Bulleted list',
    prefix: '- ',
    suffix: '',
  },
  {
    key: 'orderedList',
    icon: ListOrderedIcon,
    label: 'Numbered list',
    prefix: '1. ',
    suffix: '',
  },
];

// Matches a mention still being typed, right before the cursor — same regex
// YCT-WebUI's handleInputChange uses: an "@" at the start of the text or
// right after whitespace, followed by word characters only (no space yet).
const MENTION_RE = /(?:^|\s)@(\w*)$/;
const MIN_MENTION_QUERY = 2;

export function MarkdownEditor({
  value,
  onChangeText,
  placeholder,
  minHeight = 84,
  autoFocus = false,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  minHeight?: number;
  autoFocus?: boolean;
}) {
  const c = useThemeColors();
  const inputRef = useRef<TextInputInstance>(null);
  // The live selection, tracked on every change so a toolbar press always
  // wraps whatever was last selected — reading it from our own state rather
  // than the DOM at click time means losing focus to the button (which
  // clicking it does) can't lose or corrupt the selection, unlike a real
  // rich-text editor whose selection lives inside its own document model.
  const selectionRef = useRef({ start: 0, end: 0 });
  const [focused, setFocused] = useState(false);
  // Only set while forcing the cursor to a specific spot right after a
  // toolbar press or a mention pick — RN's `selection` prop fights normal
  // typing if left controlled all the time, so it's released back to
  // `undefined` the next time the field reports a selection change
  // (immediately, once React applies the forced one).
  const [forcedSelection, setForcedSelection] = useState<
    { start: number; end: number } | undefined
  >(undefined);

  // ---- @mention autocomplete ----
  const [mentioning, setMentioning] = useState<{
    start: number;
    query: string;
  } | null>(null);
  const { people: mentionHits, isSearching } = useUserSearch(
    mentioning?.query ?? '',
  );
  const setMentionCache = useSetAtom(mentionCacheAtom);
  const showMentionPanel =
    !!mentioning && mentioning.query.length >= MIN_MENTION_QUERY;
  const boxRef = useRef<ViewInstance | null>(null);
  const panelRef = useRef<ViewInstance | null>(null);
  const [anchor, setAnchor] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  useEffect(() => {
    if (!showMentionPanel) {
      return;
    }
    boxRef.current?.measureInWindow((x, y, width, height) =>
      setAnchor({ x, y, width, height }),
    );
  }, [showMentionPanel]);
  useEffect(() => {
    if (!showMentionPanel || Platform.OS !== 'web') {
      return;
    }
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      const box = boxRef.current as unknown as HTMLElement | null;
      const panel = panelRef.current as unknown as HTMLElement | null;
      if (!box?.contains(target) && !panel?.contains(target)) {
        setMentioning(null);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [showMentionPanel]);

  const onSelectionChange = (e: TextInputSelectionChangeEvent) => {
    selectionRef.current = e.nativeEvent.selection;
    if (forcedSelection) {
      setForcedSelection(undefined);
    }
  };

  const applyFormatting = (prefix: string, suffix: string) => {
    const { start, end } = selectionRef.current;
    const selected = value.slice(start, end);
    const nextText =
      value.slice(0, start) + prefix + selected + suffix + value.slice(end);
    onChangeText(nextText);
    const cursor = start + prefix.length + selected.length + suffix.length;
    selectionRef.current = { start: cursor, end: cursor };
    setForcedSelection({ start: cursor, end: cursor });
    inputRef.current?.focus();
  };

  const handleChangeText = (nextValue: string) => {
    onChangeText(nextValue);
    // The cursor's new position isn't handed to us here — only the text is
    // — so it's estimated from where it was before this change plus how
    // much the text grew/shrank. Exact for ordinary typing (insert/delete
    // at a collapsed cursor, the overwhelming common case); a replaced
    // selection can land this a little off, which only means the mention
    // detector below misses a beat, not that anything gets corrupted.
    const prevSel = selectionRef.current;
    const cursor = Math.max(
      0,
      Math.min(
        nextValue.length,
        prevSel.start + (nextValue.length - value.length),
      ),
    );
    const match = nextValue.slice(0, cursor).match(MENTION_RE);
    if (match) {
      setMentioning({
        start: cursor - match[0].length + match[0].indexOf('@'),
        query: match[1],
      });
    } else {
      setMentioning(null);
    }
  };

  const selectMention = (person: Person) => {
    if (!mentioning) {
      return;
    }
    const handle = person.email.split('@')[0];
    const pre = value.slice(0, mentioning.start);
    const post = value.slice(mentioning.start + 1 + mentioning.query.length);
    const nextText = `${pre}@${handle} ${post}`;
    onChangeText(nextText);
    setMentionCache(prev => ({ ...prev, [handle.toLowerCase()]: person }));
    const cursor = pre.length + handle.length + 2; // '@' + handle + trailing space
    selectionRef.current = { start: cursor, end: cursor };
    setForcedSelection({ start: cursor, end: cursor });
    setMentioning(null);
    inputRef.current?.focus();
  };

  return (
    <View
      ref={boxRef}
      className={`rounded-lg border bg-bg-card ${
        focused ? 'border-accent' : 'border-border-main hover:border-border-strong'
      }`}
    >
      <View className="flex-row flex-wrap items-center gap-0.5 border-b border-border-main px-1.5 py-1">
        {FORMAT_ACTIONS.map(a => (
          <Press
            key={a.key}
            accessibilityRole="button"
            accessibilityLabel={a.label}
            onPress={() => applyFormatting(a.prefix, a.suffix)}
            className="h-6 w-6 items-center justify-center rounded hover:bg-hover"
            // Clicking a toolbar button blurs the field first — harmless
            // here (the selection is read from our own ref, not the DOM),
            // but blocking the mousedown's default still avoids a visible
            // focus-flicker before `inputRef.current?.focus()` below.
            {...({
              onMouseDown: (e: { preventDefault: () => void }) =>
                e.preventDefault(),
            } as object)}
          >
            <a.icon size={14} color={c.text} />
          </Press>
        ))}
      </View>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChangeText}
        selection={forcedSelection}
        onSelectionChange={onSelectionChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        placeholderTextColor={c.subtle}
        multiline
        autoFocus={autoFocus}
        textAlignVertical="top"
        style={[{ outlineStyle: 'none' } as object, { minHeight }]}
        className="px-3 py-2 text-base text-text-heading"
      />
      {showMentionPanel && (Platform.OS !== 'web' || !!anchor) ? (
        <SuggestPortal>
          <View
            ref={panelRef}
            style={[
              Platform.OS === 'web'
                ? ({
                    position: 'fixed',
                    left: anchor?.x ?? 0,
                    top: (anchor?.y ?? 0) + (anchor?.height ?? 0) + 4,
                    width: Math.max(anchor?.width ?? 0, 220),
                    zIndex: 9999,
                  } as object)
                : {
                    position: 'absolute' as const,
                    left: 0,
                    right: 0,
                    top: '100%',
                    marginTop: 4,
                    zIndex: 50,
                    elevation: 12,
                  },
              {
                backgroundColor: c.card,
                borderColor: c.border,
                borderWidth: 1,
                borderRadius: 12,
                overflow: 'hidden',
                padding: 6,
              },
              Platform.OS === 'web'
                ? ({
                    boxShadow: c.dark
                      ? '0 16px 40px -8px rgba(0,0,0,0.7)'
                      : '0 16px 40px -12px rgba(20,20,40,0.28), 0 2px 6px rgba(20,20,40,0.06)',
                  } as object)
                : null,
            ]}
          >
            {isSearching ? (
              <Text className="px-2 py-1.5 text-sm text-text-subtle">
                Searching…
              </Text>
            ) : mentionHits.length > 0 ? (
              <View className="gap-0.5">
                {mentionHits.map(p => (
                  <Press
                    key={p.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Mention ${p.name} (${p.email})`}
                    onPress={() => selectMention(p)}
                    className="flex-row items-center gap-2 rounded-md px-2 py-1.5 hover:bg-hover"
                  >
                    <View
                      style={{ backgroundColor: p.color }}
                      className="h-6 w-6 items-center justify-center rounded-full"
                    >
                      <Text className="text-2xs font-semibold text-white">
                        {p.initials}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text
                        numberOfLines={1}
                        className="text-sm text-text-heading"
                      >
                        {p.name}
                      </Text>
                      <Text
                        numberOfLines={1}
                        className="text-2xs text-text-subtle"
                      >
                        {p.email}
                      </Text>
                    </View>
                  </Press>
                ))}
              </View>
            ) : (
              <Text className="px-2 py-1.5 text-sm text-text-subtle">
                No matches
              </Text>
            )}
          </View>
        </SuggestPortal>
      ) : null}
    </View>
  );
}
