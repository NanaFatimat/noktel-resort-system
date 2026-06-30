'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Phone, PhoneOff, Volume2, ChevronLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GoogleGenAI, Type, FunctionDeclaration, Modality, LiveServerMessage } from '@google/genai';
import { collection, getDocs, query, where, addDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { signInAnonymously } from 'firebase/auth';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo?: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const checkAvailabilityDeclaration: FunctionDeclaration = {
  name: "checkAvailability",
  description: "Check if rooms are available for the given dates and guest count.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      checkIn: { type: Type.STRING, description: "Check-in date in YYYY-MM-DD format" },
      checkOut: { type: Type.STRING, description: "Check-out date in YYYY-MM-DD format" },
      guests: { type: Type.NUMBER, description: "Number of guests" },
      roomType: { type: Type.STRING, description: "Optional room type preference (standard, deluxe, executive)" }
    },
    required: ["checkIn", "checkOut", "guests"],
  },
};

const bookRoomDeclaration: FunctionDeclaration = {
  name: "bookRoom",
  description: "Book a room for the customer.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      customerName: { type: Type.STRING, description: "Full name of the customer" },
      customerEmail: { type: Type.STRING, description: "Email address of the customer" },
      customerPhone: { type: Type.STRING, description: "Phone number of the customer" },
      roomId: { type: Type.STRING, description: "ID of the room to book" },
      roomName: { type: Type.STRING, description: "Name of the room to book" },
      checkIn: { type: Type.STRING, description: "Check-in date in YYYY-MM-DD format" },
      checkOut: { type: Type.STRING, description: "Check-out date in YYYY-MM-DD format" },
      guests: { type: Type.NUMBER, description: "Number of guests" },
      totalAmount: { type: Type.NUMBER, description: "Total price for the stay" }
    },
    required: ["customerName", "customerEmail", "customerPhone", "roomId", "roomName", "checkIn", "checkOut", "guests", "totalAmount"],
  },
};

export function AIVoiceAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const isCallActiveRef = useRef(false);
  const [status, setStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [messages, setMessages] = useState<{role: string, text: string}[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const aiRef = useRef<GoogleGenAI | null>(null);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);
  const audioQueueRef = useRef<Int16Array[]>([]);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const isPlayingRef = useRef(false);
  const nextPlayTimeRef = useRef(0);

  const [speakerActive, setSpeakerActive] = useState(true);
  const speakerActiveRef = useRef(true);
  const [isMuted, setIsMuted] = useState(false);
  const isMutedRef = useRef(false);
  const gainNodeRef = useRef<GainNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const toggleMute = () => {
    if (streamRef.current) {
      const newMuted = !isMutedRef.current;
      streamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !newMuted;
      });
      setIsMuted(newMuted);
      isMutedRef.current = newMuted;
      
      // If muting, also stop the AI from talking (interrupt)
      if (newMuted) {
        stopPlayback();
        if (sessionRef.current) {
          (sessionRef.current as any).sendClientContent({ turnComplete: true });
        }
      }
    }
  };

  // Function to process and play audio chunks
  const playAudioChunk = async (base64Data: string) => {
    if (!audioContextRef.current) return;
    
    try {
      const binary = atob(base64Data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const chunk = new Int16Array(bytes.buffer, 0, Math.floor(bytes.length / 2));
      
      audioQueueRef.current.push(chunk);
      processQueue();
    } catch (e) {
      console.error("Error playing audio chunk:", e);
    }
  };

  const processQueue = async () => {
    if (audioQueueRef.current.length === 0 || !audioContextRef.current) {
      return;
    }

    isPlayingRef.current = true;
    setStatus('speaking');
    
    // Process all chunks currently in the queue
    while (audioQueueRef.current.length > 0) {
      const chunk = audioQueueRef.current.shift()!;
      // Gemini Live output is 24000Hz
      const audioBuffer = audioContextRef.current.createBuffer(1, chunk.length, 24000);
      const channelData = audioBuffer.getChannelData(0);
      
      for (let i = 0; i < chunk.length; i++) {
        channelData[i] = chunk[i] / 32768.0;
      }

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;

      if (!gainNodeRef.current) {
        gainNodeRef.current = audioContextRef.current.createGain();
        gainNodeRef.current.connect(audioContextRef.current.destination);
      }
      
      // Adjust volume (1.0 = normal, 0.1 = earpiece)
      gainNodeRef.current.gain.value = speakerActiveRef.current ? 1.0 : 0.1;
      source.connect(gainNodeRef.current);
      
      // Add a small buffer (50ms) if we are recovering from an underrun to prevent immediate stutter
      if (nextPlayTimeRef.current < audioContextRef.current.currentTime) {
        nextPlayTimeRef.current = audioContextRef.current.currentTime + 0.05;
      }
      
      source.start(nextPlayTimeRef.current);
      nextPlayTimeRef.current += audioBuffer.duration;
      
      activeSourcesRef.current.push(source);
      
      source.onended = () => {
        activeSourcesRef.current = activeSourcesRef.current.filter(s => s !== source);
        if (activeSourcesRef.current.length === 0 && audioQueueRef.current.length === 0) {
          isPlayingRef.current = false;
          if (isCallActiveRef.current) {
            setStatus('listening');
          }
        }
      };
    }
  };

  const stopPlayback = () => {
    audioQueueRef.current = [];
    activeSourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) {}
    });
    activeSourcesRef.current = [];
    isPlayingRef.current = false;
    nextPlayTimeRef.current = 0;
  };

  // Removed static initialization to ensure latest key is used in startCall
  useEffect(() => {
    // No-op
  }, []);

  const startCall = async () => {
    // Initialize GoogleGenAI right before the call to ensure we have the latest API key
    if (process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
      aiRef.current = new GoogleGenAI({ 
        apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY
      });
    }

    if (!aiRef.current) {
      console.error("Gemini API Key not found in environment.");
      return;
    }
    
    setError(null);
    
    try {
      // Initialize Audio Context - 16000Hz is required for Gemini Live Input
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      await audioContextRef.current.resume();

      // Setup Audio Worklet for Recording
      const workletCode = `
        class RecorderProcessor extends AudioWorkletProcessor {
          constructor() {
            super();
            this.bufferSize = 2048;
            this.buffer = new Float32Array(this.bufferSize);
            this.bufferIndex = 0;
          }
          process(inputs, outputs, parameters) {
            const input = inputs[0];
            if (input.length > 0) {
              const channelData = input[0];
              for (let i = 0; i < channelData.length; i++) {
                this.buffer[this.bufferIndex] = channelData[i];
                this.bufferIndex++;
                if (this.bufferIndex >= this.bufferSize) {
                  const pcmData = new Int16Array(this.bufferSize);
                  for (let j = 0; j < this.bufferSize; j++) {
                    pcmData[j] = Math.max(-1, Math.min(1, this.buffer[j])) * 0x7FFF;
                  }
                  this.port.postMessage(pcmData);
                  this.bufferIndex = 0;
                }
              }
            }
            return true;
          }
        }
        registerProcessor('recorder-processor', RecorderProcessor);
      `;
      const blob = new Blob([workletCode], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      await audioContextRef.current.audioWorklet.addModule(url);
      
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
      } catch (err) {
        if (err instanceof Error && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
          setError("Microphone access denied. Please enable microphone permissions in your browser settings and try again.");
        } else {
          setError("Could not access microphone. Please ensure a microphone is connected and try again.");
        }
        return;
      }
      const source = audioContextRef.current.createMediaStreamSource(stream);
      audioWorkletNodeRef.current = new AudioWorkletNode(audioContextRef.current, 'recorder-processor');
      
      // Ensure the worklet is not suspended by connecting it to a zero-gain destination
      const zeroGain = audioContextRef.current.createGain();
      zeroGain.gain.value = 0;
      audioWorkletNodeRef.current.connect(zeroGain);
      zeroGain.connect(audioContextRef.current.destination);

      audioWorkletNodeRef.current.port.onmessage = (event) => {
        if (sessionRef.current && isCallActiveRef.current) {
          const pcmData = event.data;
          // Efficient base64 conversion
          const bytes = new Uint8Array(pcmData.buffer);
          let binary = '';
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64Data = btoa(binary);
          
          sessionRef.current.sendRealtimeInput({
            audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
          });
        }
      };

      source.connect(audioWorkletNodeRef.current);

      setIsCallActive(true);
      isCallActiveRef.current = true;
      setMessages([]);
      setStatus('listening');

      const session = await aiRef.current.live.connect({
        model: "gemini-3.1-flash-live-preview",
        callbacks: {
          onopen: () => {
            console.log("Live API connection established.");
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Audio Output
            if (message.serverContent?.modelTurn?.parts) {
              for (const part of message.serverContent.modelTurn.parts) {
                if (part.inlineData?.data) {
                  playAudioChunk(part.inlineData.data);
                }
                if (part.text) {
                  const newText = part.text;
                  setMessages(prev => {
                    const last = prev[prev.length - 1];
                    if (last && last.role === 'ai') {
                      return [...prev.slice(0, -1), { role: 'ai', text: (last.text || '') + newText }];
                    }
                    return [...prev, { role: 'ai', text: newText }];
                  });
                }
              }
            }

            // Handle User Transcription
            if (message.serverContent?.turnComplete) {
              if (activeSourcesRef.current.length === 0 && audioQueueRef.current.length === 0) {
                setStatus('listening');
              }
            }

            if (message.serverContent?.inputTranscription?.text) {
              const text = message.serverContent.inputTranscription.text.toLowerCase();
              if (text.includes('hang up')) {
                endCall();
              }
            }

            // Handle Interruption
            if (message.serverContent?.interrupted) {
              stopPlayback();
              setStatus('listening');
            }

            // Handle Tool Calls
            if (message.toolCall) {
              const functionCalls = message.toolCall.functionCalls;
              if (functionCalls) {
                const functionResponses = [];

                for (const call of functionCalls) {
                  let response: any = {};
                  if (call.name === 'checkAvailability') {
                    const { checkIn, checkOut, guests, roomType } = call.args as any;
                    const path = 'rooms';
                    try {
                      const q = query(collection(db, path), where('status', '==', 'available'));
                      const snapshot = await getDocs(q);
                      const rooms: any[] = [];
                      snapshot.forEach(doc => {
                        const data = doc.data();
                        if (data.capacity >= guests && (!roomType || data.type === roomType.toLowerCase())) {
                          rooms.push({ id: doc.id, name: data.name, type: data.type, price: data.price, capacity: data.capacity });
                        }
                      });
                      response = { availableRooms: rooms };
                    } catch (error) {
                      handleFirestoreError(error, OperationType.LIST, path);
                      response = { error: "Failed to check availability." };
                    }
                  } else if (call.name === 'bookRoom') {
                    const args = call.args as any;
                    const path = 'bookings';
                    try {
                      if (!auth.currentUser) await signInAnonymously(auth);
                      const bookingData = {
                        customerId: auth.currentUser?.uid || 'anonymous',
                        customerName: args.customerName,
                        customerEmail: args.customerEmail,
                        customerPhone: args.customerPhone,
                        roomId: args.roomId,
                        roomName: args.roomName,
                        checkIn: new Date(args.checkIn).toISOString(),
                        checkOut: new Date(args.checkOut).toISOString(),
                        guests: args.guests,
                        totalAmount: args.totalAmount,
                        status: 'pending',
                        paymentMethod: 'pay_at_hotel',
                        paymentStatus: 'unpaid',
                        source: 'phone',
                        createdAt: new Date().toISOString()
                      };
                      const docRef = await addDoc(collection(db, path), bookingData);
                      response = { success: true, bookingId: docRef.id };
                    } catch (error) {
                      handleFirestoreError(error, OperationType.WRITE, path);
                      response = { success: false, error: "Failed to book room." };
                    }
                  }
                  functionResponses.push({ name: call.name, response, id: call.id });
                }

                session.sendToolResponse({ functionResponses });
              }
            }
          },
          onerror: (err: any) => {
            console.error("Live API Connection Error:", err);
            if (err instanceof Error) {
              if (err.message.includes("permission")) {
                setError("Permission denied. Please ensure your API key has 'Multimodal Live API' enabled.");
              } else {
                setError(`Connection error: ${err.message}`);
              }
            } else if (typeof err === 'object' && err !== null && 'message' in err) {
              setError(`Connection error: ${(err as any).message}`);
            } else {
              setError("An unexpected error occurred during the call.");
            }
            setIsCallActive(false);
            isCallActiveRef.current = false;
          },
          onclose: (event) => {
            console.log("Live API connection closed. Code:", event.code, "Reason:", event.reason);
            endCall();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: `You are the Receptionist for Noktel Resort Hotel in Ilorin, Nigeria. 
          You are polite, professional, and helpful. Your job is to help customers check room availability and book rooms over the phone.
          Always ask for check-in and check-out dates, and the number of guests.
          If they want to book, use the checkAvailability tool first to find rooms and quote the price.
          If they agree to the price, ask for their full name, email, and phone number, then use the bookRoom tool.
          Keep your responses extremely brief, direct, and conversational to ensure fast response times on this voice call. Do not use markdown formatting.
          This is a real-time voice conversation, so be natural and highly responsive.`,
          tools: [{ functionDeclarations: [checkAvailabilityDeclaration, bookRoomDeclaration] }],
        },
      });

      sessionRef.current = session;
      (session as any).sendClientContent({ turns: [{ role: 'user', parts: [{ text: 'Hello! I am calling to check room availability. Please greet me warmly.' }] }], turnComplete: true });

    } catch (err) {
      console.error("Failed to start call:", err);
      setIsCallActive(false);
      isCallActiveRef.current = false;
      if (!error) {
        setError(err instanceof Error ? err.message : "An unexpected error occurred while starting the call.");
      }
    }
  };

  const endCall = () => {
    setIsCallActive(false);
    isCallActiveRef.current = false;
    setStatus('idle');
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (gainNodeRef.current) {
      gainNodeRef.current = null;
    }
    stopPlayback();
  };

  const seedRooms = async () => {
    const path = 'rooms';
    try {
      const snapshot = await getDocs(collection(db, path));
      if (snapshot.empty) {
        console.log("Seeding rooms...");
        const initialRooms = [
          { name: "Standard Single", type: "standard", price: 25000, capacity: 1, status: "available", description: "A cozy room for solo travelers.", size: "20m²", bed: "Single Bed", image: "https://picsum.photos/seed/room1/800/600" },
          { name: "Deluxe Double", type: "deluxe", price: 45000, capacity: 2, status: "available", description: "Spacious room with modern amenities.", size: "35m²", bed: "Queen Bed", image: "https://picsum.photos/seed/room2/800/600" },
          { name: "Executive Suite", type: "executive", price: 85000, capacity: 4, status: "available", description: "Luxury suite with a separate living area.", size: "60m²", bed: "King Bed", image: "https://picsum.photos/seed/room3/800/600" }
        ];
        for (const room of initialRooms) {
          await addDoc(collection(db, path), room);
        }
        console.log("Rooms seeded successfully.");
      }
    } catch (error) {
      console.error("Failed to seed rooms:", error);
    }
  };

  useEffect(() => {
    seedRooms();
  }, []);

  return (
    <>
      {/* Floating Action Button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="fixed bottom-6 right-6 w-16 h-16 bg-[#34C759] text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-[#32D74B] transition-colors z-40"
        onClick={() => setIsOpen(true)}
      >
        <Phone className="w-8 h-8" />
      </motion.button>

      {/* Call Interface Modal */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950 sm:p-4 text-white font-sans overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-600/30 via-zinc-950 to-zinc-950 pointer-events-none" />
            
            <motion.div 
              initial={{ opacity: 0, y: '10%' }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: '10%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full h-[100dvh] sm:h-[800px] sm:max-w-[400px] sm:mx-auto sm:rounded-[40px] flex flex-col relative z-10"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-14 pb-4">
                <button onClick={() => setIsOpen(false)} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
                  <ChevronLeft className="w-5 h-5 text-white" />
                </button>
                <div className="bg-white/10 px-4 py-1.5 rounded-full flex items-center gap-2">
                   <span className="text-sm font-medium">Noktel AI</span>
                   <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full">Beta</span>
                </div>
                <button className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
                  <RefreshCw className="w-4 h-4 text-white" />
                </button>
              </div>

              {/* Glowing Orb */}
              <div className="flex-1 flex flex-col items-center justify-center relative">
                <div className="relative w-64 h-64 flex items-center justify-center mb-12">
                  <motion.div
                    animate={
                      isCallActive 
                        ? (status === 'speaking' 
                            ? { scale: [1, 1.3, 1], rotate: [0, 90, 180], opacity: [0.6, 1, 0.6] } 
                            : { scale: [1, 1.05, 1], rotate: [0, 45, 90], opacity: [0.4, 0.7, 0.4] })
                        : { scale: 1, opacity: 0.2 }
                    }
                    transition={{ duration: status === 'speaking' ? 2 : 4, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute inset-0 rounded-full blur-3xl bg-gradient-to-tr from-orange-600 to-amber-500"
                  />
                  <motion.div
                    animate={
                      isCallActive
                         ? { scale: [0.9, 1.1, 0.9], rotate: [360, 180, 0] }
                         : { scale: 1 }
                    }
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-6 rounded-full blur-2xl bg-gradient-to-bl from-orange-400 to-yellow-300 opacity-70"
                  />
                  <div className="absolute inset-10 rounded-full bg-orange-200/20 backdrop-blur-sm border border-orange-200/30 shadow-[0_0_60px_rgba(251,146,60,0.6)] mix-blend-overlay" />
                </div>

                {/* Status Text */}
                <div className="px-8 text-center min-h-[100px]">
                  {error ? (
                    <p className="text-red-400 font-medium">{error}</p>
                  ) : !isCallActive ? (
                    <p className="text-white/60 text-lg font-light leading-relaxed tracking-wide">
                      Tap to connect
                    </p>
                  ) : (
                    <p className="text-white/80 text-lg font-light leading-relaxed tracking-wide">
                      {status === 'listening' ? "I'm Listening..." : status === 'speaking' ? "Speaking..." : "Connecting..."}
                    </p>
                  )}
                </div>
              </div>

              {/* Bottom Controls */}
              <div className="pb-16 px-8 flex justify-between items-center max-w-[320px] mx-auto w-full">
                <button 
                  onClick={() => {
                    const newActive = !speakerActive;
                    setSpeakerActive(newActive);
                    speakerActiveRef.current = newActive;
                    if (gainNodeRef.current) {
                      gainNodeRef.current.gain.value = newActive ? 1.0 : 0.1;
                    }
                  }}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 backdrop-blur-md border ${speakerActive ? 'bg-white/20 border-white/30 hover:bg-white/30 shadow-[0_0_15px_rgba(255,255,255,0.1)]' : 'bg-white/5 border-white/10 hover:bg-white/10 text-white/50'}`}
                >
                  <Volume2 className={`w-6 h-6 ${speakerActive ? 'text-white' : 'text-white/50'}`} />
                </button>

                <div className="relative">
                  {isCallActive && (
                    <motion.div 
                      animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.7, 0.4] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute inset-0 rounded-full bg-orange-500 blur-xl"
                    />
                  )}
                  <button 
                    onClick={isCallActive ? endCall : startCall}
                    className={`relative w-20 h-20 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(0,0,0,0.5)] transition-all duration-300 backdrop-blur-lg border ${isCallActive ? 'bg-gradient-to-tr from-red-500 to-rose-400 border-red-400/50 hover:scale-105' : 'bg-gradient-to-tr from-orange-500 to-amber-400 border-orange-400/50 hover:scale-105'}`}
                  >
                    {isCallActive ? <PhoneOff className="w-8 h-8 text-white drop-shadow-md" /> : <Phone className="w-8 h-8 text-white drop-shadow-md" />}
                  </button>
                </div>

                <button 
                  onClick={toggleMute}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 backdrop-blur-md border ${isMuted ? 'bg-orange-500/20 border-orange-500/30 text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.2)]' : 'bg-white/5 border-white/10 hover:bg-white/10 text-white'}`}
                >
                  {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
