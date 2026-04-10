'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Phone, PhoneOff, Loader2, Volume2 } from 'lucide-react';
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
  
  const aiRef = useRef<GoogleGenAI | null>(null);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);
  const audioQueueRef = useRef<Int16Array[]>([]);
  const isPlayingRef = useRef(false);
  const nextPlayTimeRef = useRef(0);

  // Function to process and play audio chunks
  const playAudioChunk = async (base64Data: string) => {
    if (!audioContextRef.current) return;
    
    try {
      const binary = atob(base64Data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const chunk = new Int16Array(bytes.buffer);
      
      audioQueueRef.current.push(chunk);
      if (!isPlayingRef.current) {
        processQueue();
      }
    } catch (e) {
      console.error("Error playing audio chunk:", e);
    }
  };

  const processQueue = async () => {
    if (audioQueueRef.current.length === 0 || !audioContextRef.current) {
      isPlayingRef.current = false;
      if (isCallActiveRef.current && status === 'speaking') {
        setStatus('listening');
      }
      return;
    }

    isPlayingRef.current = true;
    setStatus('speaking');
    const chunk = audioQueueRef.current.shift()!;
    // Gemini Live output is 24000Hz
    const audioBuffer = audioContextRef.current.createBuffer(1, chunk.length, 24000);
    const channelData = audioBuffer.getChannelData(0);
    
    for (let i = 0; i < chunk.length; i++) {
      channelData[i] = chunk[i] / 32768.0;
    }

    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContextRef.current.destination);
    
    const startTime = Math.max(audioContextRef.current.currentTime, nextPlayTimeRef.current);
    source.start(startTime);
    nextPlayTimeRef.current = startTime + audioBuffer.duration;
    
    source.onended = () => {
      processQueue();
    };
  };

  const stopPlayback = () => {
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    nextPlayTimeRef.current = 0;
    // We don't easily stop the currently playing source without keeping track of all of them,
    // but clearing the queue stops future chunks.
  };

  // Removed static initialization to ensure latest key is used in startCall
  useEffect(() => {
    // No-op
  }, []);

  const startCall = async () => {
    // Initialize GoogleGenAI right before the call to ensure we have the latest API key
    if (process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
      aiRef.current = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });
    }

    if (!aiRef.current) {
      console.error("Gemini API Key not found in environment.");
      return;
    }
    
    try {
      // Initialize Audio Context - 16000Hz is required for Gemini Live Input
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      await audioContextRef.current.resume();

      // Setup Audio Worklet for Recording
      const workletCode = `
        class RecorderProcessor extends AudioWorkletProcessor {
          process(inputs, outputs, parameters) {
            const input = inputs[0];
            if (input.length > 0) {
              const channelData = input[0];
              // Convert Float32 to Int16 PCM
              const pcmData = new Int16Array(channelData.length);
              for (let i = 0; i < channelData.length; i++) {
                pcmData[i] = Math.max(-1, Math.min(1, channelData[i])) * 0x7FFF;
              }
              this.port.postMessage(pcmData);
            }
            return true;
          }
        }
        registerProcessor('recorder-processor', RecorderProcessor);
      `;
      const blob = new Blob([workletCode], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      await audioContextRef.current.audioWorklet.addModule(url);
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      audioWorkletNodeRef.current = new AudioWorkletNode(audioContextRef.current, 'recorder-processor');
      
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
              // Turn is done
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
          onerror: (error) => {
            console.error("Live API Connection Error:", error);
            if (error instanceof Event) {
              console.error("WebSocket handshake failed. This usually means the model name is incorrect, the API key lacks permissions for the Live API, or your region is not supported.");
            }
            if (error instanceof Error && error.message.includes("permission")) {
              console.error("PERMISSION ERROR: Please ensure your Gemini API Key has 'Multimodal Live API' enabled in the Google AI Studio settings.");
            }
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
          systemInstruction: `You are the AI Receptionist for Noktel Resort Hotel in Ilorin, Nigeria. 
          You are polite, professional, and helpful. Your job is to help customers check room availability and book rooms over the phone.
          Always ask for check-in and check-out dates, and the number of guests.
          If they want to book, use the checkAvailability tool first to find rooms and quote the price.
          If they agree to the price, ask for their full name, email, and phone number, then use the bookRoom tool.
          Keep your responses conversational, concise, and suitable for a voice call. Do not use markdown formatting.
          This is a real-time voice conversation, so be natural and responsive.`,
          tools: [{ functionDeclarations: [checkAvailabilityDeclaration, bookRoomDeclaration] }],
        },
      });

      sessionRef.current = session;

    } catch (error) {
      console.error("Failed to start call:", error);
      setIsCallActive(false);
      isCallActiveRef.current = false;
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
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
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
        className="fixed bottom-6 right-6 w-16 h-16 bg-amber-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-amber-700 transition-colors z-40"
        onClick={() => setIsOpen(true)}
      >
        <Phone className="w-6 h-6" />
      </motion.button>

      {/* Call Interface Modal */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#151619] border border-white/10 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col h-[650px] relative"
            >
              {/* Hardware Style Header */}
              <div className="p-8 text-center border-b border-white/5 relative bg-gradient-to-b from-white/5 to-transparent">
                <div className="flex justify-between items-center mb-8">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    <span className="text-[10px] font-mono uppercase tracking-[2px] text-white/40">Noktel-Core v2.0</span>
                  </div>
                  <button 
                    onClick={() => { endCall(); setIsOpen(false); }}
                    className="text-white/20 hover:text-white transition-colors"
                  >
                    <span className="text-[10px] font-mono uppercase tracking-[2px]">Close</span>
                  </button>
                </div>

                <div className="relative inline-block mb-6">
                  <div className={`absolute inset-0 rounded-full blur-2xl transition-colors duration-500 ${
                    status === 'speaking' ? 'bg-blue-500/20' : status === 'listening' ? 'bg-amber-500/20' : 'bg-white/5'
                  }`} />
                  <div className="w-24 h-24 rounded-full border border-white/10 flex items-center justify-center relative bg-[#151619]">
                    {isCallActive ? (
                      <div className="flex items-center gap-1">
                        {[...Array(4)].map((_, i) => (
                          <motion.div
                            key={i}
                            animate={{ height: status === 'speaking' || status === 'listening' ? [8, 24, 8] : 8 }}
                            transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.1 }}
                            className={`w-1 rounded-full ${status === 'speaking' ? 'bg-blue-400' : 'bg-amber-400'}`}
                          />
                        ))}
                      </div>
                    ) : (
                      <Phone className="w-8 h-8 text-white/20" />
                    )}
                  </div>
                </div>

                <h2 className="text-2xl font-light tracking-tight text-white mb-1">AI Receptionist</h2>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-[2px] text-amber-500/80">
                    {isCallActive ? (status === 'listening' ? 'System Listening' : status === 'speaking' ? 'System Output' : 'Processing') : 'Standby Mode'}
                  </span>
                </div>
              </div>

              {/* Transcript Area - Hardware Feed Style */}
              <div className="flex-1 p-8 overflow-y-auto space-y-6 scrollbar-hide">
                {messages.length === 0 && !isCallActive && (
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <div className="w-12 h-12 border border-dashed border-white/10 rounded-full flex items-center justify-center mb-4">
                      <Mic className="w-5 h-5 text-white/10" />
                    </div>
                    <p className="text-white/30 text-xs font-mono uppercase tracking-wider max-w-[200px]">
                      Initialize secure voice link to begin booking
                    </p>
                  </div>
                )}
                {messages.map((msg, i) => (
                  <motion.div 
                    initial={{ opacity: 0, x: msg.role === 'user' ? 10 : -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={i} 
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[85%] p-4 rounded-2xl text-sm font-light leading-relaxed ${
                      msg.role === 'user' 
                        ? 'bg-white/5 border border-white/10 text-white/90 rounded-tr-none' 
                        : 'bg-amber-500/10 border border-amber-500/20 text-amber-200/90 rounded-tl-none'
                    }`}>
                      <div className="text-[9px] font-mono uppercase tracking-wider opacity-40 mb-2">
                        {msg.role === 'user' ? 'Client' : 'Receptionist'}
                      </div>
                      {msg.text}
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Hardware Style Controls */}
              <div className="p-8 border-t border-white/5 bg-black/20">
                {!isCallActive ? (
                  <Button 
                    size="lg" 
                    className="w-full h-16 rounded-2xl bg-white text-black hover:bg-white/90 text-sm font-mono uppercase tracking-[2px] transition-all active:scale-95"
                    onClick={startCall}
                  >
                    Establish Connection
                  </Button>
                ) : (
                  <div className="flex justify-between items-center px-4">
                    <div className="flex flex-col items-center gap-2">
                      <div className={`w-12 h-12 rounded-full border border-white/10 flex items-center justify-center ${status === 'listening' ? 'text-amber-500' : 'text-white/20'}`}>
                        <Mic className="w-5 h-5" />
                      </div>
                      <span className="text-[9px] font-mono uppercase tracking-widest text-white/20">Input</span>
                    </div>

                    <motion.button 
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/50 flex items-center justify-center group"
                      onClick={endCall}
                    >
                      <div className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.4)] group-hover:shadow-[0_0_30px_rgba(239,68,68,0.6)] transition-all">
                        <PhoneOff className="w-6 h-6 text-white" />
                      </div>
                    </motion.button>

                    <div className="flex flex-col items-center gap-2">
                      <div className={`w-12 h-12 rounded-full border border-white/10 flex items-center justify-center ${status === 'speaking' ? 'text-blue-500' : 'text-white/20'}`}>
                        <Volume2 className="w-5 h-5" />
                      </div>
                      <span className="text-[9px] font-mono uppercase tracking-widest text-white/20">Output</span>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
