import { useMemo } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { Linking, Platform, Text, View } from 'react-native';
import { itemsAtom, selectedItemIdAtom } from '../../atoms/project';
import { mentionCacheAtom } from '../../atoms/mentions';
import { useThemeColors } from '../../hooks/useThemeColors';
import type { Person } from '../../hooks/useUsers';

// RN's `fontFamily` takes one native font name, not a CSS font-stack — the
// web-only 'ui-monospace, monospace' syntax just silently fails to match any
// font on iOS/Android, falling back to the default system font instead of a
// monospace one.
const MONOSPACE_FONT = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'ui-monospace, monospace',
});

// Renders the plain markdown text MarkdownEditor's toolbar writes (see that
// file) — same block/inline conventions as this org's YCT-WebUI chat
// renderer (MessageContent.tsx's block parser + formatText), reimplemented
// against RN View/Text instead of DOM since there's no HTML involved on
// either side here, just markdown-flavored plain text in and nested Text
// spans out.

// ---- inline (bold/italic/strike/code/links) ----

// The mention branch captures its own leading boundary (start-of-string or
// one whitespace char) in its own group rather than a lookbehind — matches
// how YCT-WebUI's own formatText does it (its comment notes a lookbehind
// can't tell "start of string" from "preceded by a word char" the way a
// capture group can), and sidesteps relying on variable-width lookbehind
// support across both JS engines this app runs on (V8 on web, Hermes on
// native).
const INLINE_RE =
  /`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*|(?<!\w)_([^_]+)_(?!\w)|~~([^~]+)~~|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s]+|www\.[^\s]+)|#(\d+)\b|(^|\s)@([a-zA-Z0-9._%+-]+)/g;

const TRAILING_PUNCT_RE = /[.,!?;:)'"]+$/;

function splitTrailingPunctuation(raw: string): [string, string] {
  const m = raw.match(TRAILING_PUNCT_RE);
  if (!m) {
    return [raw, ''];
  }
  return [raw.slice(0, raw.length - m[0].length), m[0]];
}

type InlineToken =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'italic'; text: string }
  | { kind: 'strike'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'link'; text: string; href: string }
  | { kind: 'taskRef'; taskId: string }
  | { kind: 'mention'; handle: string };

function tokenizeInline(input: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let lastIndex = 0;
  INLINE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = INLINE_RE.exec(input))) {
    if (match.index > lastIndex) {
      tokens.push({ kind: 'text', text: input.slice(lastIndex, match.index) });
    }
    const [
      ,
      code,
      bold2,
      bold1,
      italic,
      strike,
      linkLabel,
      linkUrl,
      bareUrl,
      taskRef,
      mentionBoundary,
      mentionHandle,
    ] = match;
    if (code !== undefined) {
      tokens.push({ kind: 'code', text: code });
    } else if (bold2 !== undefined) {
      tokens.push({ kind: 'bold', text: bold2 });
    } else if (bold1 !== undefined) {
      tokens.push({ kind: 'bold', text: bold1 });
    } else if (italic !== undefined) {
      tokens.push({ kind: 'italic', text: italic });
    } else if (strike !== undefined) {
      tokens.push({ kind: 'strike', text: strike });
    } else if (linkLabel !== undefined) {
      tokens.push({ kind: 'link', text: linkLabel, href: linkUrl });
    } else if (bareUrl !== undefined) {
      const [url, trail] = splitTrailingPunctuation(bareUrl);
      tokens.push({
        kind: 'link',
        text: url,
        href: url.startsWith('www.') ? `https://${url}` : url,
      });
      if (trail) {
        tokens.push({ kind: 'text', text: trail });
      }
    } else if (taskRef !== undefined) {
      tokens.push({ kind: 'taskRef', taskId: taskRef });
    } else if (mentionHandle !== undefined) {
      if (mentionBoundary) {
        tokens.push({ kind: 'text', text: mentionBoundary });
      }
      tokens.push({ kind: 'mention', handle: mentionHandle });
    }
    lastIndex = INLINE_RE.lastIndex;
  }
  if (lastIndex < input.length) {
    tokens.push({ kind: 'text', text: input.slice(lastIndex) });
  }
  return tokens;
}

const openLink = (href: string) => {
  Linking.openURL(href).catch(() => undefined);
};

function InlineText({
  text,
  codeBg,
  linkColor,
  mentionBg,
  knownTaskIds,
  onOpenTask,
  mentionCache,
}: {
  text: string;
  codeBg: string;
  linkColor: string;
  mentionBg: string;
  knownTaskIds: Set<string>;
  onOpenTask: (taskId: string) => void;
  mentionCache: Record<string, Person>;
}) {
  return (
    <Text>
      {tokenizeInline(text).map((t, i) => {
        switch (t.kind) {
          case 'mention': {
            // Only a handle someone in this session has actually picked
            // from the @mention autocomplete gets the highlight — see
            // atoms/mentions.ts. Anything else (someone else's mention of
            // a person nobody here has looked up, or just an email address
            // that happens to contain "@word") stays plain text rather
            // than guessing.
            const person = mentionCache[t.handle.toLowerCase()];
            if (!person) {
              return <Text key={i}>@{t.handle}</Text>;
            }
            return (
              <Text
                key={i}
                style={{ backgroundColor: mentionBg, color: linkColor }}
                className="rounded px-0.5 font-medium"
              >
                @{t.handle}
              </Text>
            );
          }
          case 'taskRef':
            // Only a real, already-loaded task gets the link treatment —
            // same limit AlertsScreen's own "Task #<id>" already lives
            // with (see its header comment): there's no cross-view fetch
            // here, just whatever's in itemsAtom from the view that's
            // currently open, so a reference to a task from a view the
            // reader can't currently see stays plain, unclickable text
            // instead of looking like a live link that goes nowhere.
            if (!knownTaskIds.has(t.taskId)) {
              return <Text key={i}>#{t.taskId}</Text>;
            }
            return (
              <Text
                key={i}
                style={{ color: linkColor }}
                className="underline"
                accessibilityRole="link"
                accessibilityLabel={`Open task #${t.taskId}`}
                onPress={() => onOpenTask(t.taskId)}
              >
                #{t.taskId}
              </Text>
            );
          case 'bold':
            return (
              <Text key={i} className="font-semibold">
                {t.text}
              </Text>
            );
          case 'italic':
            return (
              <Text key={i} className="italic">
                {t.text}
              </Text>
            );
          case 'strike':
            return (
              <Text key={i} style={{ textDecorationLine: 'line-through' }}>
                {t.text}
              </Text>
            );
          case 'code':
            return (
              <Text
                key={i}
                style={{ backgroundColor: codeBg, fontFamily: MONOSPACE_FONT }}
                className="rounded text-[0.9em]"
              >
                {' '}
                {t.text}{' '}
              </Text>
            );
          case 'link':
            return (
              <Text
                key={i}
                style={{ color: linkColor }}
                className="underline"
                accessibilityRole="link"
                onPress={() => openLink(t.href)}
              >
                {t.text}
              </Text>
            );
          default:
            return <Text key={i}>{t.text}</Text>;
        }
      })}
    </Text>
  );
}

// ---- block (headings / quotes / lists / fenced code / paragraphs) ----

type Block =
  | { kind: 'paragraph'; text: string }
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'quote'; text: string }
  | { kind: 'bulletList'; items: string[] }
  | { kind: 'orderedList'; items: string[] }
  | { kind: 'code'; text: string }
  | { kind: 'hr' };

const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const QUOTE_RE = /^>\s?(.*)$/;
const BULLET_RE = /^[-*]\s+(.*)$/;
const ORDERED_RE = /^\d+\.\s+(.*)$/;
const HR_RE = /^(-{3,}|\*{3,}|_{3,})\s*$/;

function parseBlocks(text: string): Block[] {
  const lines = text.split('\n');
  const blocks: Block[] = [];
  let i = 0;
  let paragraphBuf: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuf.length > 0) {
      blocks.push({ kind: 'paragraph', text: paragraphBuf.join('\n') });
      paragraphBuf = [];
    }
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      flushParagraph();
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && lines[i].trim() !== '```') {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1; // skip closing fence (or EOF)
      blocks.push({ kind: 'code', text: codeLines.join('\n') });
      continue;
    }

    if (HR_RE.test(trimmed)) {
      flushParagraph();
      blocks.push({ kind: 'hr' });
      i += 1;
      continue;
    }

    const heading = trimmed.match(HEADING_RE);
    if (heading) {
      flushParagraph();
      blocks.push({ kind: 'heading', level: heading[1].length, text: heading[2] });
      i += 1;
      continue;
    }

    if (QUOTE_RE.test(line)) {
      flushParagraph();
      const quoteLines: string[] = [];
      while (i < lines.length && QUOTE_RE.test(lines[i])) {
        quoteLines.push(lines[i].match(QUOTE_RE)![1]);
        i += 1;
      }
      blocks.push({ kind: 'quote', text: quoteLines.join('\n') });
      continue;
    }

    if (BULLET_RE.test(line)) {
      flushParagraph();
      const items: string[] = [];
      while (i < lines.length && BULLET_RE.test(lines[i])) {
        items.push(lines[i].match(BULLET_RE)![1]);
        i += 1;
      }
      blocks.push({ kind: 'bulletList', items });
      continue;
    }

    if (ORDERED_RE.test(line)) {
      flushParagraph();
      const items: string[] = [];
      while (i < lines.length && ORDERED_RE.test(lines[i])) {
        items.push(lines[i].match(ORDERED_RE)![1]);
        i += 1;
      }
      blocks.push({ kind: 'orderedList', items });
      continue;
    }

    if (trimmed === '') {
      flushParagraph();
      i += 1;
      continue;
    }

    paragraphBuf.push(line);
    i += 1;
  }
  flushParagraph();
  return blocks;
}

const FONT_BY_SIZE = {
  base: { fontSize: 14, lineHeight: 20 },
  sm: { fontSize: 13, lineHeight: 18 },
};

export function RichText({
  children,
  className,
  size = 'base',
}: {
  children: string;
  className?: string;
  size?: 'base' | 'sm';
}) {
  const c = useThemeColors();
  const font = FONT_BY_SIZE[size];
  const blocks = parseBlocks(children);
  const items = useAtomValue(itemsAtom);
  const selectItem = useSetAtom(selectedItemIdAtom);
  const mentionCache = useAtomValue(mentionCacheAtom);
  const knownTaskIds = useMemo(
    () => new Set(items.map(it => it.id)),
    [items],
  );
  const inline = (text: string) => (
    <InlineText
      text={text}
      codeBg={c.hover}
      linkColor={c.accent}
      mentionBg={c.accentSoft}
      knownTaskIds={knownTaskIds}
      onOpenTask={selectItem}
      mentionCache={mentionCache}
    />
  );

  return (
    <View className={className}>
      {blocks.map((b, i) => {
        switch (b.kind) {
          case 'heading':
            return (
              <Text
                key={i}
                style={{
                  color: c.heading,
                  fontSize: font.fontSize + Math.max(0, 6 - b.level * 2),
                  lineHeight: font.lineHeight + Math.max(0, 6 - b.level * 2),
                  marginBottom: 6,
                }}
                className="font-semibold"
              >
                {inline(b.text)}
              </Text>
            );
          case 'quote':
            return (
              <View
                key={i}
                style={{ borderLeftWidth: 3, borderLeftColor: c.borderStrong }}
                className="mb-1.5 pl-2.5"
              >
                <Text style={{ ...font, color: c.subtle }}>
                  {inline(b.text)}
                </Text>
              </View>
            );
          case 'bulletList':
            return (
              <View key={i} className="mb-1.5 gap-0.5">
                {b.items.map((item, j) => (
                  <View key={j} className="flex-row gap-1.5 pl-1">
                    <Text style={{ ...font, color: c.text }}>•</Text>
                    <Text style={{ ...font, color: c.text, flex: 1 }}>
                      {inline(item)}
                    </Text>
                  </View>
                ))}
              </View>
            );
          case 'orderedList':
            return (
              <View key={i} className="mb-1.5 gap-0.5">
                {b.items.map((item, j) => (
                  <View key={j} className="flex-row gap-1.5 pl-1">
                    <Text style={{ ...font, color: c.text }}>{j + 1}.</Text>
                    <Text style={{ ...font, color: c.text, flex: 1 }}>
                      {inline(item)}
                    </Text>
                  </View>
                ))}
              </View>
            );
          case 'code':
            return (
              <View
                key={i}
                style={{ backgroundColor: c.hover }}
                className="mb-1.5 rounded-md p-2"
              >
                <Text
                  style={{ fontFamily: MONOSPACE_FONT, fontSize: font.fontSize, color: c.text }}
                >
                  {b.text}
                </Text>
              </View>
            );
          case 'hr':
            return (
              <View
                key={i}
                style={{ backgroundColor: c.border }}
                className="mb-1.5 h-px"
              />
            );
          default:
            return (
              <Text key={i} style={{ ...font, color: c.text }} className="mb-1.5">
                {inline(b.text)}
              </Text>
            );
        }
      })}
    </View>
  );
}

