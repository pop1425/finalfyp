// src/hooks/useBiometrics.js
import { useState, useEffect } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';

export function useBiometrics() {
  const [isFingerprintAvailable, setIsFingerprintAvailable] = useState(false);
  const [enrolledTypes, setEnrolledTypes] = useState([]);

  useEffect(() => {
    async function checkHardware() {
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        if (!hasHardware) {
          setIsFingerprintAvailable(false);
          return;
        }

        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        setEnrolledTypes(types);

        // AuthenticationType.FINGERPRINT is 1
        const hasFingerprint = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
        
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        setIsFingerprintAvailable(hasFingerprint && isEnrolled);
      } catch (e) {
        console.error('Error checking biometric hardware:', e);
        setIsFingerprintAvailable(false);
      }
    }

    checkHardware();
  }, []);

  const authenticate = async (onSuccess, onFailure) => {
    try {
      // Trigger native local authentication
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Confirm with Fingerprint',
        cancelLabel: 'Cancel',
        disableDeviceFallback: true, // Only fingerprint/biometrics, no passcode
      });

      if (result.success) {
        if (onSuccess) onSuccess();
        return true;
      } else {
        if (onFailure) onFailure(result.error || 'Authentication failed');
        return false;
      }
    } catch (e) {
      console.error('Biometric authentication error:', e);
      if (onFailure) onFailure(e.message || 'Error executing biometric auth');
      return false;
    }
  };

  return {
    isFingerprintAvailable,
    enrolledTypes,
    authenticate
  };
}
