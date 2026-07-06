// src/hooks/useAudio.ts
import { useState, useCallback, useRef } from 'react';
import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';

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
          lowerText.includes('salio') || 
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
      ExpoSpeechRecognitionModule.stop();
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
