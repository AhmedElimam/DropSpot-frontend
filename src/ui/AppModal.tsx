import { Modal, View, StyleSheet, type ModalProps } from 'react-native';
import { NestedDialogHost } from './NestedDialogHost';
import { useModalPresence } from './popupSlot';

/**
 * The app's native Modal: React Native's, plus a nested popup host inside it, so an
 * `Alert.alert` raised while it is open shows over it at once instead of after it closes
 * (src/ui/dialog.tsx explains why), and its presence reported to the popup slot
 * (src/ui/popupSlot.ts). Same props as RN's Modal; import it as `Modal`.
 */
export function AppModal({ children, ...props }: ModalProps) {
  // Reported to the popup slot: an app-wide popup never presents while this one is up.
  useModalPresence(props.visible !== false);
  return (
    <Modal {...props}>
      {children}
      {props.visible !== false ? (
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          <NestedDialogHost />
        </View>
      ) : null}
    </Modal>
  );
}
