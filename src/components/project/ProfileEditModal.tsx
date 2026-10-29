import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Building2 from 'lucide-react-native/icons/building-complex';
import Mail from 'lucide-react-native/icons/mail';
import Phone from 'lucide-react-native/icons/phone';
import { useAtom, useSetAtom } from 'jotai';
import { profileEditOpenAtom, profileOpenAtom } from '../../atoms/profile';
import { useMyProfile, useUpdateMyInfo } from '../../hooks/useUsers';
import { useThemeColors } from '../../hooks/useThemeColors';
import { errorMessage, toast } from '../../atoms/feedback';
import {
  Button,
  Field,
  Input,
  Sheet,
  SheetBody,
  SheetFooter,
  SheetHeader,
} from '../ui';

// Edit form for the account profile, opened from ProfileModal's "Edit profile".
// Saves straight to the server — name and role into public_info (visible to the
// organization), phone into private_info — and only closes once that succeeded.
// Email and organization come from SSO and can't be changed here.
export function ProfileEditModal() {
  const [open, setOpen] = useAtom(profileEditOpenAtom);
  const setProfileOpen = useSetAtom(profileOpenAtom);
  const profile = useMyProfile();
  const update = useUpdateMyInfo();
  const c = useThemeColors();

  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [phone, setPhone] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reset the fields from the server profile each time the form opens.
  useEffect(() => {
    if (!open) {
      return;
    }
    setName(profile.name);
    setRole(profile.role);
    setPhone(profile.phone);
    setAttempted(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const nameError = name.trim() ? null : 'Name is required';

  const backToView = () => {
    setOpen(false);
    setProfileOpen(true);
  };

  const save = async () => {
    if (nameError) {
      setAttempted(true);
      return;
    }
    setSaving(true);
    try {
      await update.mutateAsync({
        isPublic: true,
        patch: { name: name.trim(), role: role.trim() },
      });
      await update.mutateAsync({
        isPublic: false,
        patch: { phone: phone.trim() },
      });
      toast.success('Profile updated');
      backToView();
    } catch (err) {
      toast.error('Couldn’t save your profile', {
        description: errorMessage(err, 'Please try again.'),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={open} onClose={backToView} size="sm" dismissable={!saving}>
      <SheetHeader title="Edit profile" onClose={backToView} />
      <SheetBody>
        <Field label="Name" required error={attempted ? nameError : null}>
          <Input
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            invalid={attempted && !!nameError}
            autoFocus
          />
        </Field>
        <Field label="Role" hint="Shown to people in your organization.">
          <Input
            value={role}
            onChangeText={setRole}
            placeholder="e.g. Tech Lead"
          />
        </Field>
        <Field label="Phone" hint="Only you can see this.">
          <Input
            icon={Phone}
            value={phone}
            onChangeText={setPhone}
            placeholder="Optional"
            keyboardType="phone-pad"
          />
        </Field>
        <View className="gap-2 rounded-lg border border-border-main bg-muted/50 px-3 py-2.5">
          <View className="flex-row items-center gap-2">
            <Mail size={14} color={c.subtle} />
            <Text numberOfLines={1} className="flex-1 text-sm text-text-main">
              {profile.email || '—'}
            </Text>
          </View>
          {profile.organization ? (
            <View className="flex-row items-center gap-2">
              <Building2 size={14} color={c.subtle} />
              <Text numberOfLines={1} className="flex-1 text-sm text-text-main">
                {profile.organization}
              </Text>
            </View>
          ) : null}
          <Text className="text-xs text-text-subtle">
            Managed by your organization’s sign-on.
          </Text>
        </View>
      </SheetBody>
      <SheetFooter>
        <Button variant="ghost" onPress={backToView} disabled={saving}>
          Cancel
        </Button>
        <Button variant="primary" onPress={save} loading={saving}>
          Save
        </Button>
      </SheetFooter>
    </Sheet>
  );
}
