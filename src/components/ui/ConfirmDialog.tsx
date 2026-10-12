import { useAtom } from 'jotai';
import { Text } from 'react-native';
import { confirmAtom } from '../../atoms/feedback';
import { Button } from './Button';
import { Sheet, SheetBody, SheetFooter, SheetHeader } from './Sheet';

// Renders the request made through `confirm()` (atoms/feedback.ts). Mounted once in
// App.tsx.
export function ConfirmHost() {
  const [req, setReq] = useAtom(confirmAtom);
  const answer = (ok: boolean) => {
    req?.resolve(ok);
    setReq(null);
  };
  return (
    <Sheet visible={!!req} onClose={() => answer(false)} size="sm">
      <SheetHeader title={req?.title ?? ''} />
      {req?.message ? (
        <SheetBody scroll={false}>
          <Text className="text-sm text-text-main">{req.message}</Text>
        </SheetBody>
      ) : null}
      <SheetFooter>
        <Button onPress={() => answer(false)}>{req?.cancelLabel ?? 'Cancel'}</Button>
        <Button
          variant={req?.destructive ? 'destructive' : 'primary'}
          onPress={() => answer(true)}
        >
          {req?.confirmLabel ?? 'Confirm'}
        </Button>
      </SheetFooter>
    </Sheet>
  );
}
