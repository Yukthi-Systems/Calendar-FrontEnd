import { Text, View } from 'react-native';
import Check from 'lucide-react-native/icons/check';
import Monitor from 'lucide-react-native/icons/monitor';
import Moon from 'lucide-react-native/icons/moon';
import Sun from 'lucide-react-native/icons/sun';
import type { ThemeMode } from '../../atoms/theme';
import { useSetTheme, useTheme } from '../../hooks/useUsers';
import { PALETTES, type Palette } from '../../data/palettes';
import { useResolvedTheme } from '../../hooks/useResolvedTheme';
import { useThemeColors } from '../../hooks/useThemeColors';
import {
  Button,
  Press,
  SegmentedControl,
  Sheet,
  SheetBody,
  SheetFooter,
  SheetHeader,
} from '../ui';

const MODES: { key: ThemeMode; label: string; icon: typeof Sun }[] = [
  { key: 'light', label: 'Light', icon: Sun },
  { key: 'dark', label: 'Dark', icon: Moon },
  { key: 'system', label: 'System', icon: Monitor },
];

// Appearance (light/dark/system) + palette picker — mirrors the ThemeModal /
// PaletteModal pair in YSPL APPS/YCT/YCT-Mobile-App, combined into one sheet
// since this app only needs the one settings surface. Changes apply live.
export function ThemeModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const settings = useTheme();
  const setTheme = useSetTheme();
  const { dark } = useResolvedTheme();

  return (
    <Sheet visible={visible} onClose={onClose} size="md">
      <SheetHeader
        title="Appearance"
        description="Changes apply instantly and sync across your devices."
        onClose={onClose}
      />
      <SheetBody>
        <Text className="mb-2 text-xs font-medium text-text-heading">
          Theme
        </Text>
        <View className="mb-5 self-start">
          <SegmentedControl
            options={MODES}
            value={settings.mode}
            onChange={mode => setTheme({ ...settings, mode })}
          />
        </View>

        <Text className="mb-2 text-xs font-medium text-text-heading">
          Palette
        </Text>
        <View className="flex-row flex-wrap gap-2.5">
          {PALETTES.map(p => (
            <PaletteCard
              key={p.key}
              palette={p}
              dark={dark}
              active={settings.paletteKey === p.key}
              onPress={() => setTheme({ ...settings, paletteKey: p.key })}
            />
          ))}
        </View>
      </SheetBody>
      <SheetFooter>
        <Button variant="primary" onPress={onClose}>
          Done
        </Button>
      </SheetFooter>
    </Sheet>
  );
}

// A tiny mock of the app in that palette: background, a card, an accent bar.
function PaletteCard({
  palette,
  dark,
  active,
  onPress,
}: {
  palette: Palette;
  dark: boolean;
  active: boolean;
  onPress: () => void;
}) {
  const c = useThemeColors();
  const p = dark ? palette.dark : palette.light;
  return (
    <Press
      feedback="scale"
      accessibilityRole="radio"
      accessibilityState={{ selected: active, checked: active }}
      accessibilityLabel={`${palette.label} palette`}
      onPress={onPress}
      style={{ flexBasis: 140, flexGrow: 1 }}
      className={`rounded-xl border-2 p-1 ${
        active
          ? 'border-accent'
          : 'border-transparent hover:border-border-strong'
      }`}
    >
      <View
        style={{ backgroundColor: p.background, borderColor: p.border }}
        className="h-16 overflow-hidden rounded-lg border p-2"
      >
        <View
          style={{ backgroundColor: p.card, borderColor: p.border }}
          className="flex-1 rounded-md border p-1.5"
        >
          <View
            style={{ backgroundColor: p.foreground, opacity: 0.85 }}
            className="mb-1 h-1.5 w-10 rounded-full"
          />
          <View
            style={{ backgroundColor: p.mutedForeground, opacity: 0.5 }}
            className="mb-1.5 h-1.5 w-14 rounded-full"
          />
          <View
            style={{ backgroundColor: p.primary }}
            className="h-2 w-8 rounded-full"
          />
        </View>
      </View>
      <View className="flex-row items-center justify-between px-1 pb-0.5 pt-1.5">
        <Text className="text-xs font-medium text-text-heading">
          {palette.label}
        </Text>
        {active ? <Check size={13} color={c.accent} strokeWidth={2.5} /> : null}
      </View>
    </Press>
  );
}
