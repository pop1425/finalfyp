// src/app/index.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Animated,
  Easing
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAudio } from '../hooks/useAudio';
import { useBiometrics } from '../hooks/useBiometrics';
import { useContacts } from '../hooks/useContacts';
import { parseSpokenText } from '../utils/nlpParser';

// Import Supabase config
import { supabase, isSupabaseConfigured } from '../config/supabase';

// Import Backend API
import { disburse as backendDisburse, getStatus } from '../api/transactions';
import { parseVoiceCommand } from '../api/nlp';

export default function HomeScreen() {
  const {
    speak,
    isListening,
    setIsListening,
    speechResult,
    setSpeechResult,
    speechError,
    startListening,
    stopListening
  } = useAudio();

  const { isFingerprintAvailable, authenticate } = useBiometrics();
  const { findContactByName } = useContacts();

  // App States: 'IDLE', 'LISTENING', 'CONFIRMING', 'REQUESTING_ISP', 'SUCCESS', 'CANCELLED'
  const [appState, setAppState] = useState<string>('IDLE');
  const [currentTransaction, setCurrentTransaction] = useState<{ amount: number; recipient: string; number: string | null } | null>(null);
  const [statusText, setStatusText] = useState<string>('Gusa ili Kuanza');
  const [spokenTextDisplay, setSpokenTextDisplay] = useState<string>('');
  
  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim1 = useRef(new Animated.Value(0)).current;
  const waveAnim2 = useRef(new Animated.Value(0)).current;

  // Swahili system prompt speak helper
  const speakSystemPrompt = (key: string, vars: any = {}) => {
    let text = '';
    
    switch (key) {
      case 'WELCOME_OFFLINE':
        text = 'Karibu kwenye VoiceSend. Gusa popote kwenye skrini ili kuongea.';
        break;
      case 'WELCOME_AI_OFFLINE':
        text = 'Karibu kwenye VoiceSend. Msaidizi wa AI yuko tayari. Gusa popote ili kuongea.';
        break;
      case 'WELCOME_CLOUD':
        text = 'Karibu kwenye VoiceSend. Mtandao umeunganishwa. Gusa ili kuanza.';
        break;
      case 'WELCOME_AI_CLOUD':
        text = 'Karibu kwenye VoiceSend. Mtandao umeunganishwa na msaidizi wa AI yuko tayari. Gusa ili kuanza.';
        break;
      case 'RECOGNITION_ERROR':
        text = 'Muamala haukutambulika. Tafadhali gusa na ujaribu tena.';
        break;
      case 'CANCELLED':
        text = 'Muamala umeghairiwa. Gusa ili kuanza upya.';
        break;
      case 'CONFIRM_SEND':
        if (vars.number) {
          text = `Ninatuma shilingi ${vars.amount.toLocaleString()} kwa ${vars.recipient}, namba ya simu ${vars.number}. Weka kidole chako kwenye kihisi ili kudhibitisha.`;
        } else {
          text = `Ninatuma shilingi ${vars.amount.toLocaleString()} kwa ${vars.recipient}, namba ya simu haikupatikana. Weka kidole chako kwenye kihisi ili kudhibitisha.`;
        }
        break;
      case 'REQUESTING_ISP':
        text = 'Ninasajili malipo kwenye mtandao.';
        break;
      case 'SUCCESS':
        text = `Muamala umekamilika. Shilingi ${vars.amount.toLocaleString()} zimetumwa kwa ${vars.recipient}.`;
        break;
      case 'SEARCHING_CONTACTS':
        text = `Ninasaka namba ya simu ya ${vars.recipient} kwenye orodha yako ya mawasiliano.`;
        break;
    }
    
    speak(text, 'sw-TZ');
  };

  // Initial welcome greeting & Supabase subscription
  useEffect(() => {
    // Backend always has AI configured, so use cloud welcome
    const welcomeKey = isSupabaseConfigured ? 'WELCOME_AI_CLOUD' : 'WELCOME_OFFLINE';

    if (!isSupabaseConfigured) {
      const timer = setTimeout(() => {
        speakSystemPrompt(welcomeKey);
      }, 1000);
      return () => clearTimeout(timer);
    }

    const appStartTime = Date.now();

    // Subscribe to incoming transactions to Juma in real-time using Supabase
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions',
          filter: 'recipient=eq.Juma'
        },
        (payload) => {
          const data = payload.new;
          if (data && data.sender_name !== 'Juma') {
            const txTime = data.created_at ? new Date(data.created_at).getTime() : Date.now();
            if (txTime > appStartTime - 3000) {
              // Real-time Text-to-Speech incoming notification
              const alertMsg = `Umepokea shilingi ${data.amount.toLocaleString()} kutoka kwa ${data.sender_name}.`;
              
              speak(alertMsg, 'sw-TZ');
              setStatusText(`Umepokea ${data.amount.toLocaleString()} TZS`);
              setSpokenTextDisplay(`Umepokea ${data.amount.toLocaleString()} TZS kutoka kwa ${data.sender_name}`);
              
              setTimeout(() => {
                setStatusText('Gusa ili Kuanza');
              }, 5000);
            }
          }
        }
      )
      .subscribe();

    const timer = setTimeout(() => {
      speakSystemPrompt(welcomeKey);
    }, 1000);

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [isSupabaseConfigured, speak]);

  // Audio wave and pulse animation controls
  useEffect(() => {
    if (isListening || appState === 'REQUESTING_ISP') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 600,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 600,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
        ])
      ).start();

      waveAnim1.setValue(0);
      waveAnim2.setValue(0);
      Animated.loop(
        Animated.parallel([
          Animated.timing(waveAnim1, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
            easing: Easing.out(Easing.ease),
          }),
          Animated.timing(waveAnim2, {
            toValue: 1,
            duration: 1200,
            delay: 600,
            useNativeDriver: true,
            easing: Easing.out(Easing.ease),
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
      waveAnim1.setValue(0);
      waveAnim2.setValue(0);
      pulseAnim.stopAnimation();
      waveAnim1.stopAnimation();
      waveAnim2.stopAnimation();
    }
  }, [isListening, appState]);

  // Process voice results once speech stops or completes
  useEffect(() => {
    if (speechResult) {
      setSpokenTextDisplay(speechResult);
      handleProcessCommand(speechResult);
      setSpeechResult('');
    }
  }, [speechResult]);

  // Main NLP command processor (via backend API)
  const handleProcessCommand = async (text: string) => {
    setStatusText('Inachakata muamala...');

    try {
      const parsed = await parseVoiceCommand(text);
      console.log("Backend parsed response:", parsed);

      if (parsed.intent === 'cancel' || parsed.intent === 'help') {
        handleCancel();
        return;
      }

      if (parsed.intent === 'send_money' && parsed.amount) {
        const recipientName = parsed.recipient || 'Unknown';
        setStatusText(`Inatafuta mawasiliano ya ${recipientName}...`);
        
        speakSystemPrompt('SEARCHING_CONTACTS', { recipient: recipientName });
        
        const contact = await findContactByName(recipientName);
        if (!contact) {
          setStatusText('Mawasiliano Hayakufanikiwa');
          speak(`Mawasiliano ya ${recipientName} hayakupatikana kwenye orodha yako ya simu.`, 'sw-TZ');
          setAppState('IDLE');
          setTimeout(() => {
            setStatusText('Gusa ili Kuanza');
          }, 4000);
          return;
        }

        handleSendTransaction(parsed.amount, contact.name, contact.number);
        return;
      }
    } catch (err) {
      console.error("Backend NLP failed, falling back to local engine:", err);
    }

    // Fallback: Local Regex-based parser
    const result = parseSpokenText(text) as any;

    if (result.type === 'CANCEL') {
      handleCancel();
    } else if (result.type === 'SEND') {
      setStatusText(`Inatafuta mawasiliano ya ${result.recipient}...`);
      speakSystemPrompt('SEARCHING_CONTACTS', { recipient: result.recipient });

      const contact = await findContactByName(result.recipient);
      if (!contact) {
        setStatusText('Mawasiliano Hayakufanikiwa');
        speak(`Mawasiliano ya ${result.recipient} hayakupatikana kwenye orodha yako ya simu.`, 'sw-TZ');
        setAppState('IDLE');
        setTimeout(() => {
          setStatusText('Gusa ili Kuanza');
        }, 4000);
        return;
      }

      handleSendTransaction(result.amount, contact.name, contact.number);
    } else {
      setAppState('IDLE');
      setStatusText('Gusa ili Kuanza');
      speakSystemPrompt('RECOGNITION_ERROR');
    }
  };

  const handleCancel = () => {
    setAppState('CANCELLED');
    setStatusText('Muamala Umeghairiwa');
    speakSystemPrompt('CANCELLED');
    setCurrentTransaction(null);
    
    setTimeout(() => {
      setAppState('IDLE');
      setStatusText('Gusa ili Kuanza');
      setSpokenTextDisplay('');
    }, 4000);
  };

  const handleSendTransaction = (amount: number, recipientName: string, recipientNumber: string | null) => {
    setCurrentTransaction({ amount, recipient: recipientName, number: recipientNumber });
    setAppState('CONFIRMING');
    setStatusText(`Thibitisha Tuma ${amount.toLocaleString()} kwa ${recipientName}`);
    
    speakSystemPrompt('CONFIRM_SEND', { amount, recipient: recipientName, number: recipientNumber });

    setTimeout(() => {
      triggerFingerprintAuth(amount, recipientName, recipientNumber);
    }, 3500);
  };

  // Trigger Fingerprint verification and call Backend API
  const triggerFingerprintAuth = (amount: number, recipientName: string, recipientNumber: string | null) => {
    authenticate(
      // Success Callback
      async () => {
        setAppState('REQUESTING_ISP');
        setStatusText('Inatuma Ombi Mtandaoni...');
        speakSystemPrompt('REQUESTING_ISP');

        const txId = 'TX-' + Math.floor(Math.random() * 9000000 + 1000000);

        if (recipientNumber) {
          try {
            const result = await backendDisburse({
              amount: amount,
              recipient_name: recipientName,
              recipient_phone: recipientNumber.replace(/(?!^\+)\D/g, ''),
              reference: txId,
              sender_name: 'Juma',
            });

            if (result.success) {
              const ref = result.transaction_id;
              let finalStatus = result.status;

              if (finalStatus !== 'completed') {
                for (let i = 0; i < 12; i++) {
                  await new Promise((r) => setTimeout(r, 5000));
                  try {
                    const check = await getStatus(ref);
                    if (check) {
                      finalStatus = check.status;
                      if (finalStatus === 'completed' || finalStatus === 'failed') break;
                    }
                  } catch (e) {
                    console.error('Status check failed:', e);
                  }
                }
              }

              if (finalStatus === 'completed') {
                setAppState('SUCCESS');
                setStatusText('Muamala Umekamilika');
                speakSystemPrompt('SUCCESS', { amount, recipient: recipientName });
              } else {
                console.error('Payout failed or timed out:', finalStatus);
                setAppState('CANCELLED');
                setStatusText('Muamala Umeshindwa');
                speak('Muamala umeshindwa. ' + (finalStatus || 'Muda umekwisha'), 'sw-TZ');
              }
            } else {
              console.error('Disbursement failed:', result.message);
              setAppState('CANCELLED');
              setStatusText('Muamala Umeshindwa');
              speak('Muamala umeshindwa. ' + (result.message || ''), 'sw-TZ');
            }
          } catch (err) {
            console.error('Backend disburse error:', err);
            setAppState('CANCELLED');
            setStatusText('Muamala Umeshindwa');
            speak('Muamala umeshindwa. Hitilafu ya mtandao.', 'sw-TZ');
          }
        } else {
          setAppState('CANCELLED');
          setStatusText('Namba ya Simu Haijatolewa');
          speak('Namba ya simu ya mpokeaji haijatolewa.', 'sw-TZ');
        }

        setTimeout(() => {
          setAppState('IDLE');
          setStatusText('Gusa ili Kuanza');
          setCurrentTransaction(null);
          setSpokenTextDisplay('');
        }, 5000);
      },
      // Failure Callback
      (error: any) => {
        console.log('Authentication failed:', error);
        handleCancel();
      }
    );
  };

  // Screen Tapped action (Big button trigger)
  const handleMainButtonPress = () => {
    if (appState === 'CONFIRMING') {
      if (currentTransaction) {
        speakSystemPrompt('CONFIRM_SEND', {
          amount: currentTransaction.amount,
          recipient: currentTransaction.recipient,
          number: currentTransaction.number
        });
        triggerFingerprintAuth(currentTransaction.amount, currentTransaction.recipient, currentTransaction.number);
      }
      return;
    }

    if (appState === 'REQUESTING_ISP') {
      return;
    }

    if (isListening) {
      stopListening();
    } else {
      setAppState('LISTENING');
      setStatusText('Inasikiliza...');
      setSpokenTextDisplay('');
      startListening();
    }
  };

  // Animated styles for ripples
  const waveStyle1 = {
    transform: [
      {
        scale: waveAnim1.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 2.2],
        }),
      },
    ],
    opacity: waveAnim1.interpolate({
      inputRange: [0, 0.8, 1],
      outputRange: [0.6, 0.2, 0],
    }),
  };

  const waveStyle2 = {
    transform: [
      {
        scale: waveAnim2.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 2.2],
        }),
      },
    ],
    opacity: waveAnim2.interpolate({
      inputRange: [0, 0.8, 1],
      outputRange: [0.6, 0.2, 0],
    }),
  };

  // Determine state colors for the background glow and dashboard button
  const getStateGlowColor = () => {
    switch (appState) {
      case 'LISTENING':
        return '#00FF66'; // Glowing Emerald Green
      case 'CONFIRMING':
        return '#FFB800'; // Glowing Amber Orange
      case 'REQUESTING_ISP':
        return '#FF3C00'; // Glowing Orange Red
      case 'SUCCESS':
        return '#00E0FF'; // Glowing Cyan
      case 'CANCELLED':
        return '#FF003C'; // Glowing Red
      default:
        return '#8F00FF'; // Glowing Neon Violet
    }
  };

  const glowColor = getStateGlowColor();

  return (
    <SafeAreaView style={styles.container}>
      {/* Background Neon Gradients */}
      <View style={[styles.glowBackground, { shadowColor: glowColor }]} />

      {/* Main Content Area */}
      <View style={styles.content}>
        <Text style={styles.appName}>VoiceSend</Text>

        {/* AI & Database indicators */}
        <View style={styles.badgeRow}>
          <Text style={styles.badge}>
            {isSupabaseConfigured ? '🟢 CLOUD' : '🟡 LOCAL'}
          </Text>
          <Text style={styles.badge}>
            🟢 AI ACTIVE
          </Text>
        </View>

        {/* Large visual feedback display */}
        <View style={styles.feedbackContainer}>
          <Text style={[styles.statusLabel, { color: glowColor }]}>
            {statusText}
          </Text>
          {spokenTextDisplay ? (
            <Text style={styles.spokenText}>
              {spokenTextDisplay}
            </Text>
          ) : null}
        </View>

        {/* Contact details display panel */}
        {currentTransaction && (
          <View style={[styles.contactCard, { borderColor: glowColor + '40' }]}>
            <Ionicons name="person-circle-outline" size={46} color={glowColor} />
            <View style={styles.contactDetails}>
              <Text style={styles.contactName}>{currentTransaction.recipient}</Text>
              <Text style={styles.contactNumber}>
                {currentTransaction.number || 'Namba haikupatikana'}
              </Text>
            </View>
          </View>
        )}

        {/* Giant Central Touch Target Button */}
        <View style={styles.buttonWrapper}>
          {(isListening || appState === 'REQUESTING_ISP') && (
            <>
              <Animated.View style={[styles.rippleRing, waveStyle1, { borderColor: glowColor }]} />
              <Animated.View style={[styles.rippleRing, waveStyle2, { borderColor: glowColor }]} />
            </>
          )}

          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleMainButtonPress}
              style={[
                styles.giantButton,
                {
                  borderColor: glowColor,
                  shadowColor: glowColor,
                  backgroundColor: appState === 'CONFIRMING' ? '#2A1C08' : '#0F0E1F',
                },
              ]}
            >
              <Ionicons
                name={
                  appState === 'CONFIRMING'
                    ? 'finger-print'
                    : appState === 'REQUESTING_ISP'
                    ? 'swap-horizontal'
                    : isListening
                    ? 'mic'
                    : 'mic-outline'
                }
                size={80}
                color={glowColor}
              />
              <Text style={[styles.buttonHint, { color: glowColor }]}>
                {appState === 'CONFIRMING'
                  ? 'Thibitisha Muamala'
                  : appState === 'REQUESTING_ISP'
                  ? 'Inatuma Ombi Mtandaoni...'
                  : isListening
                  ? 'Inasikiliza... Gusa Kusitisha'
                  : 'Gusa ili Uongee'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>


      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07060F',
  },
  glowBackground: {
    position: 'absolute',
    top: '30%',
    left: '25%',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'transparent',
    shadowRadius: 150,
    shadowOpacity: 0.45,
    zIndex: 0,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 40,
    zIndex: 1,
  },
  appName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
    letterSpacing: 2,
    marginTop: 20,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 5,
  },
  badge: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FFF',
    backgroundColor: '#1E1B38',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
  feedbackContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    height: 120,
    width: '100%',
  },
  statusLabel: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  spokenText: {
    fontSize: 16,
    fontStyle: 'italic',
    color: '#AAA',
    textAlign: 'center',
  },
  buttonWrapper: {
    width: 280,
    height: 280,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  rippleRing: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 2.5,
    backgroundColor: 'transparent',
  },
  giantButton: {
    width: 250,
    height: 250,
    borderRadius: 125,
    borderWidth: 3.5,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 25,
    shadowOpacity: 0.4,
    elevation: 8,
  },
  buttonHint: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 15,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131124',
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
    width: '85%',
    gap: 16,
    marginVertical: 12,
  },
  contactDetails: {
    flex: 1,
  },
  contactName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  contactNumber: {
    fontSize: 14,
    color: '#AAA',
    marginTop: 4,
  },

});
