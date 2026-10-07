import { useAtom } from 'jotai';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Check, Laptop, Moon, Sun } from 'lucide-react-native';
import { themeAtom, type ThemeMode } from '../../atoms/theme';
import { PALETTES } from '../../data/palettes';
import { useThemeColors } from '../../hooks/useThemeColors';

const MODES: { key: ThemeMode; label: string; icon: typeof Sun }[] = [
  { key: 'light', label: 'Light', icon: Sun },
  { key: 'dark', label: 'Dark', icon: Moon },
  { key: 'system', label: 'System', icon: Laptop },
];

// Appearance (light/dark/system) + palette picker — mirrors the ThemeModal /
// PaletteModal pair in YSPL APPS/YCT/YCT-Mobile-App, combined into one sheet
// since this app only needs the one settings surface.
export function ThemeModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [settings, setSettings] = useAtom(themeAtom);
  const { heading, text, accent } = useThemeColors();

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
        <Pressable
          onPress={() => {}}
          className="max-h-[85%] w-full max-w-md rounded-t-3xl bg-bg-card p-5 sm:rounded-3xl"
        >
          <Text className="mb-4 text-lg font-bold text-text-heading">
            Appearance
          </Text>

          <View className="mb-5 flex-row gap-2">
            {MODES.map(m => {
              const active = settings.mode === m.key;
              return (
                <Pressable
                  key={m.key}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  onPress={() => setSettings(s => ({ ...s, mode: m.key }))}
                  className={`flex-1 items-center gap-1.5 rounded-xl border py-3 active:opacity-70 ${
                    active ? 'border-accent bg-accent/10' : 'border-border-main'
                  }`}
                >
                  <m.icon size={18} color={active ? accent : text} />
                  <Text
                    className={
                      active
                        ? 'text-xs font-semibold text-accent'
                        : 'text-xs text-text-main'
                    }
                  >
                    {m.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text className="mb-2 text-xs font-semibold uppercase text-text-main">
            Color palette
          </Text>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View className="gap-2 pb-2">
              {PALETTES.map(p => {
                const active = settings.paletteKey === p.key;
                return (
                  <Pressable
                    key={p.key}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    onPress={() =>
                      setSettings(s => ({ ...s, paletteKey: p.key }))
                    }
                    className={`flex-row items-center gap-3 rounded-xl border px-3 py-2.5 active:opacity-70 ${
                      active ? 'border-accent bg-accent/10' : 'border-border-main'
                    }`}
                  >
                    <View className="flex-row">
                      <View
                        style={{ backgroundColor: p.previewPrimary }}
                        className="h-6 w-6 rounded-full border-2 border-bg-card"
                      />
                      <View
                        style={{
                          backgroundColor: p.previewAccent,
                          marginLeft: -8,
                        }}
                        className="h-6 w-6 rounded-full border-2 border-bg-card"
                      />
                    </View>
                    <Text className="flex-1 font-medium text-text-heading">
                      {p.label}
                    </Text>
                    {active ? <Check size={18} color={heading} /> : null}
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            className="mt-3 items-center rounded-2xl bg-accent py-3 active:opacity-80"
          >
            <Text className="font-semibold text-accent-foreground">Done</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
