// src/hooks/useAudio.ts
import { useState, useCallback, useRef } from 'react';
import * as Speech from 'expo-speech';

// expo-speech-recognition is a native module NOT bundled in Expo Go, so its import
// would throw on load there. Resolve it lazily so the app still renders in Expo Go
// (the voice-command feature just degrades gracefully in that environment).
let ExpoSpeechRecognitionModule: any = null;
let useSpeechRecognitionEvent: (event: string, listener: (event: any) => void) => void = () => {};

try {
  const mod = require('expo-speech-recognition');
  ExpoSpeechRecognitionModule = mod.ExpoSpeechRecognitionModule;
  useSpeechRecognitionEvent = mod.useSpeechRecognitionEvent;
} catch (e) {
  console.warn('expo-speech-recognition unavailable (running in Expo Go?)', e);
}

export function useAudio() {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speechResult, setSpeechResult] = useState<string>('');
  const [speechError, setSpeechError] = useState<string>('');
  const isSpeakingRef = useRef<boolean>(false);

  // Bind speech recognition lifecycle event listeners using the library hooks
  useSpeechRecognitionEvent('start', () => {
    setIsListening(true);
    setSpeechError('');
    setSpeechResult('');
  });

  useSpeechRecognitionEvent('end', () => {
    setIsListening(false);
  });

  useSpeechRecognitionEvent('result', (event) => {
    if (event.results && event.results.length > 0) {
      setSpeechResult(event.results[0].transcript || '');
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    console.error('Speech recognition error event:', event);
    setSpeechError(event.message || event.error || 'Error recognizing speech');
    setIsListening(false);
  });

  // Text-To-Speech function
  const speak = useCallback(async (text: string, lang?: string) => {
    try {
      // 1. Kill any current speech immediately (Continuous Audio Feedback Loop)
      await Speech.stop();
      isSpeakingRef.current = true;

      // Determine language: use explicitly provided language or run autodetect fallback
      let speechLang = lang;
      
      if (!speechLang) {
        speechLang = 'en-US'; // Default fallback
        const lowerText = text.toLowerCase();
        if (
          lowerText.includes('tuma') || 
          lowerText.includes('nitumie') || 
          lowerText.includes('ghairi') ||
          lowerText.includes('shilingi') ||
          lowerText.includes('kwa') ||
          lowerText.includes('upokee')
        ) {
          speechLang = 'sw-TZ'; // Swahili
        }
      }

      Speech.speak(text, {
        language: speechLang,
        pitch: 1.0,
        rate: 0.95,
        onDone: () => {
          isSpeakingRef.current = false;
        },
        onError: (err) => {
          console.error('TTS Error:', err);
          isSpeakingRef.current = false;
        }
      });
    } catch (e) {
      console.error('Error playing TTS:', e);
    }
  }, []);

  // Request permissions & start speech recognition
  const startListening = useCallback(async () => {
    setSpeechResult('');
    setSpeechError('');

    try {
      if (!ExpoSpeechRecognitionModule) {
        setSpeechError('Speech recognition is only available in the preview build.');
        speak('Speech recognition is not available in Expo Go. Please use the preview build.');
        return;
      }

      // Request microphone and speech recognition permissions
      const { status } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      
      if (status !== 'granted') {
        setSpeechError('Permission to use speech recognition was denied');
        speak('Permission denied. Please enable microphone and speech recognition in settings.');
        return;
      }

      // Stop any speech before opening the microphone to avoid self-recording
      await Speech.stop();

      // Start native speech recognition in Swahili
      ExpoSpeechRecognitionModule.start({
        lang: 'sw-TZ',
        interimResults: false,
      });
      setIsListening(true);
    } catch (e: any) {
      console.error('Failed to start speech recognition:', e);
      setSpeechError(e.message || 'Speech recognition failed to start');
      setIsListening(false);
    }
  }, [speak]);

  // Stop recording
  const stopListening = useCallback(async () => {
    try {
      if (ExpoSpeechRecognitionModule) {
        ExpoSpeechRecognitionModule.stop();
      }
      setIsListening(false);
    } catch (e) {
      console.error('Failed to stop speech recognition:', e);
    }
  }, []);

  return {
    speak,
    isListening,
    setIsListening,
    speechResult,
    setSpeechResult,
    speechError,
    setSpeechError,
    startListening,
    stopListening
  };
}
