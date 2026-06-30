import { useState, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { CameraView, type CameraType } from 'expo-camera';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';

interface QRScannerProps {
  onScan: (token: string) => void;
  onError: (error: Error) => void;
}

export function QRScanner({ onScan, onError }: QRScannerProps) {
  const { t } = useTranslation();
  const [torch, setTorch] = useState(false);
  const lastScanRef = useRef<string>('');
  const lastScanTimeRef = useRef<number>(0);

  const handleBarCodeScanned = useCallback(
    ({ data }: { data: string }) => {
      const now = Date.now();
      if (data === lastScanRef.current && now - lastScanTimeRef.current < 2000) {
        return;
      }
      lastScanRef.current = data;
      lastScanTimeRef.current = now;

      try {
        const url = new URL(data);
        const token = url.searchParams.get('token') || data;
        onScan(token);
      } catch {
        onScan(data);
      }
    },
    [onScan]
  );

  return (
    <View style={{ flex: 1, position: 'relative' }}>
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={handleBarCodeScanned}
      />

      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <View
          style={{
            width: 250,
            height: 250,
            borderWidth: 2,
            borderColor: '#208AEF',
            borderRadius: 16,
            backgroundColor: 'transparent',
          }}
        />
      </View>

      <TouchableOpacity
        onPress={() => setTorch((v) => !v)}
        style={{
          position: 'absolute',
          bottom: 40,
          alignSelf: 'center',
          backgroundColor: 'rgba(0,0,0,0.6)',
          paddingVertical: 12,
          paddingHorizontal: 24,
          borderRadius: 24,
        }}
        accessibilityRole="button"
        accessibilityLabel={torch ? 'إطفاء الضوء' : 'إضاءة'}
      >
        <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: '#FFFFFF' }}>
          {torch ? 'إطفاء الضوء' : 'إضاءة'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
