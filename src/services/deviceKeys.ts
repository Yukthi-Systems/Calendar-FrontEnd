// Stored per user id. The one thing sign-out leaves on the device (clearDeviceData
// in runtime.*.ts): the tips must only ever show twice, so the count has to outlive
// a sign-out — see useOnboarding.ts.
export const TIPS_SHOWN_KEY_PREFIX = 'onboarding.tipsShown.';
