import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  profileAtom,
  profileEditOpenAtom,
  profileOpenAtom,
} from '../../atoms/profile';
import { userInfoAtom } from '../../atoms/userInfo';
import { useUpdateUserInfo } from '../../hooks/useUpdateUserInfo';
import { Field, FormInput } from './shared';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Edit form for the account profile, opened from ProfileModal's "Edit
// profile" button. On save/cancel it returns to that read-only sheet.
export function ProfileEditModal() {
  const [open, setOpen] = useAtom(profileEditOpenAtom);
  const [profile, setProfile] = useAtom(profileAtom);
  const setProfileOpen = useSetAtom(profileOpenAtom);
  const userInfo = useAtomValue(userInfoAtom);
  const updateUserInfo = useUpdateUserInfo();

  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [organization, setOrganization] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Reset the fields from the current profile each time the form opens.
  useEffect(() => {
    if (!open) {
      return;
    }
    setName(profile.name);
    setRole(profile.role);
    setOrganization(profile.organization);
    setEmail(profile.email);
    setPhone(profile.phone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const errors = {
    name: name.trim() ? null : 'Name is required',
    email: EMAIL_RE.test(email.trim()) ? null : 'Enter a valid email',
  };
  const valid = !Object.values(errors).some(Boolean);

  const backToView = () => {
    setOpen(false);
    setProfileOpen(true);
  };

  const save = () => {
    if (!valid) {
      return;
    }
    setProfile(prev => ({
      ...prev,
      name: name.trim(),
      role: role.trim(),
      organization: organization.trim(),
      email: email.trim(),
      phone: phone.trim(),
      // Initials follow the name, same rule as a new team member would get.
      initials: initialsOf(name.trim()) || prev.initials,
    }));
    // Role is visible to colleagues (public); phone stays private. The API replaces
    // each whole object, so merge onto what's already stored. useUpdateUserInfo's
    // own onSuccess keeps userInfoAtom (and its query cache) in step.
    if (userInfo) {
      const publicInfo = { ...userInfo.public_info, role: role.trim() };
      const privateInfo = { ...userInfo.private_info, phone: phone.trim() };
      Promise.all([
        updateUserInfo.mutateAsync({ isPublic: true, info: publicInfo }),
        updateUserInfo.mutateAsync({ isPublic: false, info: privateInfo }),
      ]).catch(err => console.warn('Could not save profile to server:', err));
    }
    backToView();
  };

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={backToView}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <Pressable
          accessibilityLabel="Close"
          onPress={backToView}
          className="flex-1 items-center justify-end bg-black/50 sm:justify-center"
        >
          <Pressable
            onPress={() => {}}
            className="max-h-[92%] w-full max-w-md rounded-t-3xl bg-bg-card p-5 sm:rounded-3xl"
          >
            <Text className="mb-3 text-lg font-bold text-text-heading">
              Edit profile
            </Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Field label="Name" error={errors.name}>
                <FormInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Your name"
                />
              </Field>
              <Field label="Role">
                <FormInput
                  value={role}
                  onChangeText={setRole}
                  placeholder="e.g. Tech Lead"
                />
              </Field>
              <Field label="Organization">
                <FormInput
                  value={organization}
                  onChangeText={setOrganization}
                  placeholder="e.g. Yukthi Systems"
                />
              </Field>
              <Field label="Email" error={errors.email}>
                <FormInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@company.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </Field>
              <Field label="Phone">
                <FormInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Optional"
                  keyboardType="phone-pad"
                />
              </Field>
            </ScrollView>

            <View className="mt-3 flex-row gap-2">
              <Pressable
                accessibilityRole="button"
                onPress={backToView}
                className="flex-1 items-center rounded-2xl border border-border-main py-3 active:opacity-70"
              >
                <Text className="text-text-heading">Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: !valid }}
                disabled={!valid}
                onPress={save}
                className={`flex-1 items-center rounded-2xl bg-accent py-3 active:opacity-80 ${
                  valid ? '' : 'opacity-40'
                }`}
              >
                <Text className="font-semibold text-accent-foreground">Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('');
