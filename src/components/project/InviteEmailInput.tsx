import { useEffect, useRef, useState } from 'react';
import { Platform, Text, View, type ViewInstance } from 'react-native';
import Plus from 'lucide-react-native/icons/plus';
import { useUserSearch } from '../../hooks/useUsers';
import { useThemeColors } from '../../hooks/useThemeColors';
import { Button, Input, Press } from '../ui';
import { Avatar } from './shared';
import { SuggestPortal } from '../ui/SuggestPortal';

// Deliberately stricter than bare RFC 5322 (which technically allows local
// parts like "user#name" and TLDs like "com2" — the `email-validator`
// package this used to use let both through): local part limited to the
// characters real mail addresses actually use, and the final domain label
// must be letters-only (a real TLD never contains a digit).
const EMAIL_RE =
  /^[a-zA-Z0-9](?:[a-zA-Z0-9._%+-]*[a-zA-Z0-9])?@(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
export const isValidEmail = (value: string) => EMAIL_RE.test(value);

// Below this many characters, a search is too unspecific to be worth a
// round-trip (and would just flash a noisy "no matches" dropdown).
const SEARCH_MIN_CHARS = 3;

// The e-mail box invitees are added through, with suggestions from the org's
// members: on a saved task (EventInviteesSection) and on the new-event form
// (ItemFormModal). `onAdd` gets the typed text, or a picked member's e-mail.
export function InviteEmailInput({
  value,
  onChangeText,
  onAdd,
  exclude,
  loading = false,
  addLabel,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onAdd: (email?: string) => void;
  // Lowercased e-mails not worth suggesting (already invited).
  exclude: Set<string>;
  loading?: boolean;
  addLabel: string;
}) {
  const c = useThemeColors();
  const [suggestOpen, setSuggestOpen] = useState(false);
  const trimmedEmail = value.trim();
  const searchQuery =
    trimmedEmail.length >= SEARCH_MIN_CHARS ? trimmedEmail : '';
  const { people: searchHits, isSearching } = useUserSearch(searchQuery);
  // Inline dropdown, portaled to document.body on web (not a Popover/Modal —
  // react-native-web's Modal traps focus, which was stealing it right out of
  // the input the moment a suggestion appeared, making the field look
  // uneditable; and rendering it nested in place, even with a high z-index,
  // could still lose to a later, unrelated sibling subtree — see
  // SuggestPortal's comment). Closed by a plain outside-click listener,
  // scoped to this field's own container plus the portaled panel itself.
  const suggestBoxRef = useRef<ViewInstance | null>(null);
  const suggestPanelRef = useRef<ViewInstance | null>(null);
  const [anchor, setAnchor] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  useEffect(() => {
    if (!suggestOpen) {
      return;
    }
    suggestBoxRef.current?.measureInWindow((x, y, width, height) =>
      setAnchor({ x, y, width, height }),
    );
  }, [suggestOpen]);
  useEffect(() => {
    if (!suggestOpen || Platform.OS !== 'web') {
      return;
    }
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      const box = suggestBoxRef.current as unknown as HTMLElement | null;
      const panel = suggestPanelRef.current as unknown as HTMLElement | null;
      if (!box?.contains(target) && !panel?.contains(target)) {
        setSuggestOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [suggestOpen]);

  const add = (email?: string) => {
    setSuggestOpen(false);
    onAdd(email);
  };

  const suggestions = searchHits.filter(
    p => !exclude.has(p.email.toLowerCase()),
  );
  const showSuggestions =
    suggestOpen &&
    searchQuery.length > 0 &&
    (Platform.OS !== 'web' || !!anchor);

  return (
    <View className="flex-row items-end gap-2">
      <View ref={suggestBoxRef} style={{ position: 'relative', flex: 1 }}>
        <Input
          value={value}
          onChangeText={text => {
            onChangeText(text);
            setSuggestOpen(text.trim().length >= SEARCH_MIN_CHARS);
          }}
          onFocus={() =>
            setSuggestOpen(trimmedEmail.length >= SEARCH_MIN_CHARS)
          }
          onSubmitEditing={() => {
            if (trimmedEmail) {
              add();
            }
          }}
          placeholder="person@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          returnKeyType="done"
        />
        {showSuggestions ? (
          <SuggestPortal>
            {/* Positioning/background/border/stacking are all inline
                (not Tailwind classes) for the same reason this is
                portaled at all: it has to float reliably above
                whatever's behind it, with no ambiguity about whether a
                class resolved or which stacking context it landed in. */}
            <View
              ref={suggestPanelRef}
              style={[
                Platform.OS === 'web'
                  ? {
                      position: 'fixed' as const,
                      left: anchor?.x ?? 0,
                      top: (anchor?.y ?? 0) + (anchor?.height ?? 0) + 4,
                      width: anchor?.width,
                      zIndex: 9999,
                    }
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
              ) : suggestions.length > 0 ? (
                <View className="gap-0.5">
                  {suggestions.map(p => (
                    <Press
                      key={p.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Invite ${p.name} (${p.email})`}
                      onPress={() => add(p.email)}
                      className="flex-row items-center gap-2 rounded-md px-2 py-1.5 hover:bg-hover"
                    >
                      <Avatar id={p.id} size={22} />
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
                  No matching members — press {addLabel} to add “{trimmedEmail}”
                  by e-mail anyway.
                </Text>
              )}
            </View>
          </SuggestPortal>
        ) : null}
      </View>
      <Button
        variant="primary"
        icon={Plus}
        onPress={() => add()}
        loading={loading}
        disabled={!trimmedEmail}
      >
        {addLabel}
      </Button>
    </View>
  );
}
