import { useState } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Building2, Mail, Palette, Phone, Pencil } from 'lucide-react-native';
import {
  profileAtom,
  profileEditOpenAtom,
  profileOpenAtom,
} from '../../atoms/profile';
import { useThemeColors } from '../../hooks/useThemeColors';
import { InitialsAvatar } from './shared';
import { ThemeModal } from './ThemeModal';

// Read-only account sheet, opened from the header avatar. "Edit profile" hands
// off to ProfileEditModal; "Sign out" only appears once SSO is wired in (see
// ProjectScreen, which is the one place that knows whether it's enabled).
export function ProfileModal({ onSignOut }: { onSignOut?: () => void }) {
  const [open, setOpen] = useAtom(profileOpenAtom);
  const setEditOpen = useSetAtom(profileEditOpenAtom);
  const [profile] = useAtom(profileAtom);
  const { text } = useThemeColors();
  const [themeOpen, setThemeOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={close}
    >
      <Pressable
        accessibilityLabel="Close"
        onPress={close}
        className="flex-1 items-center justify-end bg-black/50 sm:justify-center"
      >
        <Pressable
          onPress={() => {}}
          className="w-full max-w-md rounded-t-3xl bg-bg-card p-5 sm:rounded-3xl"
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            <View className="mb-5 items-center">
              <InitialsAvatar
                color={profile.color}
                initials={profile.initials}
                size={72}
              />
              <Text className="mt-3 text-xl font-bold text-text-heading">
                {profile.name}
              </Text>
              <Text className="text-sm text-text-main">
                {profile.role}
                {profile.organization ? ` · ${profile.organization}` : ''}
              </Text>
            </View>

            <View className="mb-5 gap-3 rounded-2xl border border-border-main p-4">
              <InfoRow icon={Mail} label={profile.email} color={text} />
              {profile.phone ? (
                <InfoRow icon={Phone} label={profile.phone} color={text} />
              ) : null}
              {profile.organization ? (
                <InfoRow
                  icon={Building2}
                  label={profile.organization}
                  color={text}
                />
              ) : null}
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                close();
                setEditOpen(true);
              }}
              className="mb-3 flex-row items-center justify-center gap-2 rounded-2xl border border-border-main py-3 active:opacity-70"
            >
              <Pencil size={16} color={text} />
              <Text className="font-medium text-text-heading">
                Edit profile
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => setThemeOpen(true)}
              className="mb-3 flex-row items-center justify-center gap-2 rounded-2xl border border-border-main py-3 active:opacity-70"
            >
              <Palette size={16} color={text} />
              <Text className="font-medium text-text-heading">
                Appearance
              </Text>
            </Pressable>

            {onSignOut ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  close();
                  onSignOut();
                }}
                className="mb-3 items-center rounded-2xl border border-destructive/40 py-3 active:opacity-70"
              >
                <Text className="font-semibold text-destructive">Sign out</Text>
              </Pressable>
            ) : null}

            <Pressable
              accessibilityRole="button"
              onPress={close}
              className="items-center rounded-2xl bg-accent py-3 active:opacity-80"
            >
              <Text className="font-semibold text-accent-foreground">
                Done
              </Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
      <ThemeModal visible={themeOpen} onClose={() => setThemeOpen(false)} />
    </Modal>
  );
}

function InfoRow({
  icon: Icon,
  label,
  color,
}: {
  icon: typeof Mail;
  label: string;
  color: string;
}) {
  return (
    <View className="flex-row items-center gap-2.5">
      <Icon size={16} color={color} />
      <Text numberOfLines={1} className="flex-1 text-sm text-text-heading">
        {label}
      </Text>
    </View>
  );
}
