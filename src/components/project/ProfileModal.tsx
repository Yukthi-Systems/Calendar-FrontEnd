import { useState } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { Text, View } from 'react-native';
import {
  Building2,
  LogOut,
  Mail,
  Palette,
  Pencil,
  Phone,
  type LucideIcon,
} from 'lucide-react-native';
import { profileEditOpenAtom, profileOpenAtom } from '../../atoms/profile';
import { useMyProfile } from '../../hooks/useUsers';
import { useThemeColors } from '../../hooks/useThemeColors';
import { MenuItem, MenuSeparator, Sheet, SheetHeader } from '../ui';
import { InitialsAvatar } from './shared';
import { ThemeModal } from './ThemeModal';

// Account sheet, opened from the rail/header avatar. "Edit profile" hands off to
// ProfileEditModal; "Sign out" only appears once SSO is wired in (see
// ProjectScreen, which is the one place that knows whether it's enabled).
export function ProfileModal({ onSignOut }: { onSignOut?: () => void }) {
  const [open, setOpen] = useAtom(profileOpenAtom);
  const setEditOpen = useSetAtom(profileEditOpenAtom);
  const profile = useMyProfile();
  const [themeOpen, setThemeOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <Sheet visible={open} onClose={close} size="sm">
        <SheetHeader title="Account" onClose={close} />
        <View className="px-5 pb-4">
          <View className="flex-row items-center gap-3.5">
            <InitialsAvatar color={profile.color} initials={profile.initials} size={52} />
            <View className="flex-1">
              <Text numberOfLines={1} className="text-lg font-semibold text-text-heading">
                {profile.name || 'Your account'}
              </Text>
              {profile.role || profile.organization ? (
                <Text numberOfLines={1} className="text-sm text-text-main">
                  {[profile.role, profile.organization].filter(Boolean).join(' · ')}
                </Text>
              ) : null}
            </View>
          </View>

          <View className="mt-4 gap-2.5 rounded-xl border border-border-main bg-muted/50 px-3.5 py-3">
            <InfoRow icon={Mail} label={profile.email || '—'} />
            {profile.phone ? <InfoRow icon={Phone} label={profile.phone} /> : null}
            {profile.organization ? (
              <InfoRow icon={Building2} label={profile.organization} />
            ) : null}
          </View>
        </View>
        <View className="border-t border-border-main p-2">
          <MenuItem
            icon={Pencil}
            label="Edit profile"
            chevron
            onPress={() => {
              close();
              setEditOpen(true);
            }}
          />
          <MenuItem
            icon={Palette}
            label="Appearance"
            description="Theme and colour palette"
            chevron
            onPress={() => {
              close();
              setThemeOpen(true);
            }}
          />
          {onSignOut ? (
            <>
              <MenuSeparator />
              <MenuItem
                icon={LogOut}
                label="Sign out"
                destructive
                onPress={() => {
                  close();
                  onSignOut();
                }}
              />
            </>
          ) : null}
        </View>
      </Sheet>
      <ThemeModal visible={themeOpen} onClose={() => setThemeOpen(false)} />
    </>
  );
}

function InfoRow({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  const c = useThemeColors();
  return (
    <View className="flex-row items-center gap-2.5">
      <Icon size={15} color={c.subtle} />
      <Text numberOfLines={1} className="flex-1 text-sm text-text-heading">
        {label}
      </Text>
    </View>
  );
}
