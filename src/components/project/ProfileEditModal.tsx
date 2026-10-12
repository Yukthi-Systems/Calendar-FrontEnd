import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Mail, Phone } from 'lucide-react-native';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  profileAtom,
  profileEditOpenAtom,
  profileOpenAtom,
} from '../../atoms/profile';
import { userInfoAtom } from '../../atoms/userInfo';
import { useUpdateUserInfo } from '../../hooks/useUpdateUserInfo';
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
  const [attempted, setAttempted] = useState(false);

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
    setAttempted(false);
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
      setAttempted(true);
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
      ]).catch(err =>
        toast.error('Profile saved on this device only', {
          description: errorMessage(err, 'The server didn’t accept the update.'),
        }),
      );
    }
    toast.success('Profile updated');
    backToView();
  };

  return (
    <Sheet visible={open} onClose={backToView} size="sm">
      <SheetHeader title="Edit profile" onClose={backToView} />
      <SheetBody>
        <Field label="Name" required error={attempted ? errors.name : null}>
          <Input value={name} onChangeText={setName} placeholder="Your name" autoFocus />
        </Field>
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Field label="Role">
              <Input value={role} onChangeText={setRole} placeholder="e.g. Tech Lead" />
            </Field>
          </View>
          <View className="flex-1">
            <Field label="Organization">
              <Input
                value={organization}
                onChangeText={setOrganization}
                placeholder="e.g. Yukthi Systems"
              />
            </Field>
          </View>
        </View>
        <Field label="Email" required error={attempted ? errors.email : null}>
          <Input
            icon={Mail}
            value={email}
            onChangeText={setEmail}
            placeholder="you@company.com"
            keyboardType="email-address"
            autoCapitalize="none"
            invalid={attempted && !!errors.email}
          />
        </Field>
        <Field label="Phone" hint="Only you can see this." className="mb-1">
          <Input
            icon={Phone}
            value={phone}
            onChangeText={setPhone}
            placeholder="Optional"
            keyboardType="phone-pad"
          />
        </Field>
      </SheetBody>
      <SheetFooter>
        <Button variant="ghost" onPress={backToView}>
          Cancel
        </Button>
        <Button variant="primary" onPress={save} disabled={attempted && !valid}>
          Save
        </Button>
      </SheetFooter>
    </Sheet>
  );
}

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('');
