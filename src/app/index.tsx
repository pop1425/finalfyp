// src/app/index.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  Animated,
  Easing,
  Platform,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudio } from '../hooks/useAudio';
import { useBiometrics } from '../hooks/useBiometrics';
import { useContacts } from '../hooks/useContacts';
import { parseSpokenText } from '../utils/nlpParser';

// Import Firebase config
import { db, isFirebaseConfigured } from '../config/firebase';
import {
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  addDoc,
  collection,
  serverTimestamp,
  increment,
  query,
  where
} from 'firebase/firestore';

// Import Gemini AI Config and Service
import { isGeminiConfigured } from '../config/gemini';
import { askGemini } from '../utils/geminiService';

// Import ISP Gateway Config
import { ISP_GATEWAY_CONFIG } from '../config/ispGateway';

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

  // App States: 'IDLE', 'LISTENING', 'CONFIRMING', 'REQUESTING_ISP', 'SUCCESS', 'CANCELLED', 'SPEAKING_BALANCE'
  const [appState, setAppState] = useState<string>('IDLE');
  const [balance, setBalance] = useState<number>(15000); // Default local balance
  const [currentTransaction, setCurrentTransaction] = useState<{ amount: number; recipient: string; number: string | null } | null>(null);
  const [statusText, setStatusText] = useState<string>('Tap to Start');
  const [spokenTextDisplay, setSpokenTextDisplay] = useState<string>('');
  
  // Real ISP Payment Gateway JSON Log
  const [ispPayload, setIspPayload] = useState<string>('');

  // Gemini AI Chat History
  const [chatHistory, setChatHistory] = useState<any[]>([]);

  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim1 = useRef(new Animated.Value(0)).current;
  const waveAnim2 = useRef(new Animated.Value(0)).current;

  // English system prompt speak helper
  const speakSystemPrompt = (key: string, vars: any = {}) => {
    let text = '';
    
    switch (key) {
      case 'WELCOME_OFFLINE':
        text = 'Welcome to VoicePay. Tap anywhere on the screen to speak your command.';
        break;
      case 'WELCOME_AI_OFFLINE':
        text = 'Welcome to VoicePay. AI assistant active. Tap anywhere on the screen to speak.';
        break;
      case 'WELCOME_CLOUD':
        text = 'Welcome to VoicePay. Cloud connected. Tap to start.';
        break;
      case 'WELCOME_AI_CLOUD':
        text = 'Welcome to VoicePay. Cloud connected. AI assistant active. Tap to start.';
        break;
      case 'RECOGNITION_ERROR':
        text = 'Command not recognized. Tap and try again.';
        break;
      case 'CANCELLED':
        text = 'Transaction cancelled. Tap to redo transaction.';
        break;
      case 'BALANCE':
        text = `Your balance is ${vars.balance.toLocaleString()} shillings.`;
        break;
      case 'INSUFFICIENT_BALANCE':
        text = `Insufficient balance. Your current balance is ${vars.balance.toLocaleString()} shillings. Tap to try again.`;
        break;
      case 'CONFIRM_SEND':
        if (vars.number) {
          text = `Sending ${vars.amount.toLocaleString()} shillings to ${vars.recipient}, phone number ${vars.number}. Place your finger on the sensor to confirm.`;
        } else {
          text = `Sending ${vars.amount.toLocaleString()} shillings to ${vars.recipient}, phone number not found. Place your finger on the sensor to confirm.`;
        }
        break;
      case 'REQUESTING_ISP':
        text = 'Requesting payment gateway.';
        break;
      case 'SUCCESS':
        text = `Transaction successful. ${vars.amount.toLocaleString()} shillings sent to ${vars.recipient}.`;
        break;
      case 'SEARCHING_CONTACTS':
        text = `Searching contacts for ${vars.recipient}.`;
        break;
    }
    
    speak(text, 'en-US');
  };

  // Initial welcome greeting & Firebase subscription
  useEffect(() => {
    const welcomeKey = isFirebaseConfigured
      ? (isGeminiConfigured ? 'WELCOME_AI_CLOUD' : 'WELCOME_CLOUD')
      : (isGeminiConfigured ? 'WELCOME_AI_OFFLINE' : 'WELCOME_OFFLINE');

    if (!isFirebaseConfigured || !db) {
      const timer = setTimeout(() => {
        speakSystemPrompt(welcomeKey);
      }, 1000);
      return () => clearTimeout(timer);
    }

    setStatusText('Syncing with Cloud database...');
    const appStartTime = Date.now();

    // 1. Subscribe to real-time balance of 'current_user' (represented as 'Juma')
    const userDocRef = doc(db, 'users', 'current_user');
    const unsubscribeUser = onSnapshot(userDocRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data && typeof data.balance === 'number') {
          setBalance(data.balance);
          setStatusText('Tap to Start');
        }
      } else {
        try {
          await setDoc(userDocRef, {
            name: 'Juma',
            balance: 15000
          });
          setBalance(15000);
          setStatusText('Tap to Start');
        } catch (e) {
          console.error('Error initializing user document:', e);
          setStatusText('Sync Failed');
        }
      }
    }, (error) => {
      console.error('Firestore user subscription error:', error);
      setStatusText('Sync Error');
    });

    // 2. Subscribe to incoming transactions to Juma in real-time
    const txCollectionRef = collection(db, 'transactions');
    const q = query(txCollectionRef, where('recipient', '==', 'Juma'));
    const unsubscribeTx = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          if (data && data.senderName !== 'Juma') {
            const txTime = data.timestamp?.toDate ? data.timestamp.toDate().getTime() : Date.now();
            if (txTime > appStartTime - 3000) {
              // Real-time Text-to-Speech incoming notification
              const alertMsg = `You have received ${data.amount.toLocaleString()} shillings from ${data.senderName}.`;
              
              speak(alertMsg, 'en-US');
              setStatusText(`Received ${data.amount.toLocaleString()} TZS`);
              setSpokenTextDisplay(`Received ${data.amount.toLocaleString()} TZS from ${data.senderName}`);
              
              setTimeout(() => {
                setStatusText('Tap to Start');
              }, 5000);
            }
          }
        }
      });
    }, (error) => {
      console.error('Firestore transactions subscription error:', error);
    });

    const timer = setTimeout(() => {
      speakSystemPrompt(welcomeKey);
    }, 1000);

    return () => {
      clearTimeout(timer);
      unsubscribeUser();
      unsubscribeTx();
    };
  }, [isFirebaseConfigured, db, speak]);

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

  // Main NLP & AI command processor
  const handleProcessCommand = async (text: string) => {
    setStatusText('Processing command...');

    // If Gemini AI is configured, let it handle conversational parsing!
    if (isGeminiConfigured) {
      try {
        const aiResponse = await askGemini(text, chatHistory);
        
        if (aiResponse) {
          console.log("Gemini parsed response:", aiResponse);
          
          // Speak AI response Speech using English
          speak(aiResponse.responseSpeech, 'en-US');
          
          setChatHistory(prev => [
            ...prev,
            { role: "user", parts: [{ text: text }] },
            { role: "model", parts: [{ text: JSON.stringify(aiResponse) }] }
          ]);

          if (aiResponse.intent === 'CANCEL') {
            handleCancel();
          } else if (aiResponse.intent === 'BALANCE') {
            speak(`Your current balance is ${balance.toLocaleString()} shillings.`, 'en-US');
            setStatusText(`Balance: ${balance.toLocaleString()} TZS`);
            
            setTimeout(() => {
              setAppState('IDLE');
              setStatusText('Tap to Start');
            }, 5000);
          } else if (aiResponse.intent === 'CLARIFY') {
            setStatusText('Listening for details...');
            setTimeout(() => {
              startListening();
            }, 4500);
          } else if (aiResponse.intent === 'SEND' && aiResponse.amount) {
            const recipientName = aiResponse.recipient || 'Unknown';
            setStatusText(`Searching contacts for ${recipientName}...`);
            
            speakSystemPrompt('SEARCHING_CONTACTS', { recipient: recipientName });
            
            const contact = await findContactByName(recipientName);
            const resolvedName = contact ? contact.name : recipientName;
            const resolvedNumber = contact ? contact.number : null;

            handleSendTransaction(aiResponse.amount, resolvedName, resolvedNumber);
          } else if (aiResponse.intent === 'CHITCHAT') {
            setAppState('IDLE');
            setStatusText('Tap to Start');
            setChatHistory([]);
          }
          return;
        }
      } catch (err) {
        console.error("AI flow failed, falling back to local engine:", err);
      }
    }

    // Fallback: Local Regex-based parser if AI is disabled or fails
    const result = parseSpokenText(text) as any;

    if (result.type === 'CANCEL') {
      handleCancel();
    } else if (result.type === 'BALANCE') {
      handleBalanceCheck();
    } else if (result.type === 'SEND') {
      setStatusText(`Searching contacts for ${result.recipient}...`);
      speakSystemPrompt('SEARCHING_CONTACTS', { recipient: result.recipient });

      const contact = await findContactByName(result.recipient);
      const recipientName = contact ? contact.name : result.recipient;
      const recipientNumber = contact ? contact.number : null;

      handleSendTransaction(result.amount, recipientName, recipientNumber);
    } else {
      setAppState('IDLE');
      setStatusText('Tap to Start');
      speakSystemPrompt('RECOGNITION_ERROR');
    }
  };

  const handleCancel = () => {
    setAppState('CANCELLED');
    setStatusText('Transaction Cancelled');
    speakSystemPrompt('CANCELLED');
    setChatHistory([]);
    
    setTimeout(() => {
      setAppState('IDLE');
      setStatusText('Tap to Start');
      setSpokenTextDisplay('');
      setIspPayload('');
    }, 4000);
  };

  const handleBalanceCheck = () => {
    setAppState('SPEAKING_BALANCE');
    setStatusText(`Balance: ${balance.toLocaleString()} TZS`);
    speakSystemPrompt('BALANCE', { balance });
    
    setTimeout(() => {
      setAppState('IDLE');
      setStatusText('Tap to Start');
      setSpokenTextDisplay('');
    }, 5000);
  };

  const handleSendTransaction = (amount: number, recipientName: string, recipientNumber: string | null) => {
    if (amount > balance) {
      setAppState('IDLE');
      setStatusText('Insufficient Balance');
      speakSystemPrompt('INSUFFICIENT_BALANCE', { balance });
      setChatHistory([]);
      return;
    }

    setCurrentTransaction({ amount, recipient: recipientName, number: recipientNumber });
    setAppState('CONFIRMING');
    setStatusText(`Confirm Send ${amount.toLocaleString()} to ${recipientName}`);
    
    speakSystemPrompt('CONFIRM_SEND', { amount, recipient: recipientName, number: recipientNumber });

    setTimeout(() => {
      triggerFingerprintAuth(amount, recipientName, recipientNumber);
    }, 3500);
  };

  // Trigger Fingerprint verification and call ISP Gateway
  const triggerFingerprintAuth = (amount: number, recipientName: string, recipientNumber: string | null) => {
    authenticate(
      // Success Callback
      async () => {
        setAppState('REQUESTING_ISP');
        setStatusText('Requesting ISP Gateway...');
        speakSystemPrompt('REQUESTING_ISP');

        // Build payment gateway JSON payload containing credentials
        const txId = 'TX-' + Math.floor(Math.random() * 9000000 + 1000000);
        const payload = {
          transactionId: txId,
          timestamp: new Date().toISOString(),
          amount: amount,
          recipient: {
            name: recipientName,
            phoneNumber: recipientNumber || 'Unknown/Manual'
          },
          sender: 'Juma',
          gatewayUrl: ISP_GATEWAY_CONFIG.apiUrl,
          merchantId: ISP_GATEWAY_CONFIG.merchantId,
          authorizationKey: ISP_GATEWAY_CONFIG.apiKey // Referenced dynamically
        };

        setIspPayload(JSON.stringify(payload, null, 2));
        setChatHistory([]);

        // Simulate payment gateway latency (2.5 seconds)
        setTimeout(async () => {
          if (isFirebaseConfigured && db) {
            try {
              await updateDoc(doc(db, 'users', 'current_user'), {
                balance: increment(-amount)
              });

              await addDoc(collection(db, 'transactions'), {
                amount: amount,
                recipient: recipientName,
                recipientNumber: recipientNumber || 'Unknown/Manual',
                senderName: 'Juma',
                transactionId: txId,
                timestamp: serverTimestamp()
              });

            } catch (e) {
              console.error('Error writing transfer to database:', e);
            }
          } else {
            setBalance(prev => prev - amount);
          }

          setAppState('SUCCESS');
          setStatusText('Transfer Successful');
          speakSystemPrompt('SUCCESS', { amount, recipient: recipientName });

          setTimeout(() => {
            setAppState('IDLE');
            setStatusText('Tap to Start');
            setCurrentTransaction(null);
            setSpokenTextDisplay('');
            setIspPayload('');
          }, 5000);
        }, 2500);
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
      setStatusText('Listening...');
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
        <Text style={styles.appName}>VoicePay</Text>

        {/* AI & Database indicators */}
        <View style={styles.badgeRow}>
          <Text style={styles.badge}>
            {isFirebaseConfigured ? '🟢 CLOUD' : '🟡 LOCAL'}
          </Text>
          <Text style={styles.badge}>
            {isGeminiConfigured ? '🟢 AI ACTIVE' : '🟡 LOCAL NLP'}
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

        {/* Gateway API Payload Panel (Rendered only when submitting or done) */}
        {ispPayload ? (
          <View style={styles.gatewayPanel}>
            <Text style={styles.gatewayTitle}>ISP GATEWAY TRANSACTION PAYLOAD</Text>
            <ScrollView style={styles.payloadScroll}>
              <Text style={styles.payloadText}>{ispPayload}</Text>
            </ScrollView>
          </View>
        ) : (
          /* Giant Central Touch Target Button */
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
                    ? 'Confirm Transaction'
                    : appState === 'REQUESTING_ISP'
                    ? 'Connecting ISP Gateway...'
                    : isListening
                    ? 'Listening... Tap to Stop'
                    : 'Tap to Speak'}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        )}

        <Text style={styles.balanceOverlay}>
          Balance: {balance.toLocaleString()} TZS
        </Text>
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
  gatewayPanel: {
    width: '85%',
    height: 260,
    backgroundColor: 'rgba(20, 18, 38, 0.75)',
    borderWidth: 1.5,
    borderColor: '#4A3B75',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#FF3C00',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 15,
    shadowOpacity: 0.25,
  },
  gatewayTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFB800',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 1,
  },
  payloadScroll: {
    flex: 1,
    backgroundColor: '#07060F',
    borderRadius: 8,
    padding: 12,
  },
  payloadText: {
    color: '#00FF66',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
    lineHeight: 16,
  },
  balanceOverlay: {
    fontSize: 18,
    fontWeight: '600',
    color: '#888',
    letterSpacing: 1,
  },
});
