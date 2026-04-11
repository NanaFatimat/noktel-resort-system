'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Phone, PhoneOff, Loader2, Volume2, Grid, Plus, Video, User } from 'lucide-react';
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
      aiRef.current = new GoogleGenAI({ 
        apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY,
        apiVersion: 'v1alpha'
      });
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
        model: "gemini-2.0-flash-exp",
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
        className="fixed bottom-6 right-6 w-16 h-16 bg-[#34C759] text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-[#32D74B] transition-colors z-40"
        onClick={() => setIsOpen(true)}
      >
        <Phone className="w-8 h-8" />
      </motion.button>

      {/* Call Interface Modal */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl sm:p-4">
            <motion.div 
              initial={{ opacity: 0, y: '100%' }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-[#1C1C1E] sm:rounded-[40px] shadow-2xl w-full h-full sm:h-[800px] sm:max-w-[375px] overflow-hidden flex flex-col relative text-white"
            >
              {/* Top Section */}
              <div className="pt-16 pb-8 flex flex-col items-center">
                <h2 className="text-3xl font-normal tracking-wide mb-2">AI Receptionist</h2>
                <p className="text-[#8E8E93] text-sm">
                  {!isCallActive ? 'Noktel Resort' : (status === 'listening' ? 'listening...' : status === 'speaking' ? 'speaking...' : 'connecting...')}
                </p>
              </div>

              {/* Middle Section - Avatar */}
              <div className="flex-1 flex items-center justify-center">
                 <div className="relative w-32 h-32">
                    {/* Glowing effect when active */}
                    {isCallActive && (
                      <div className={`absolute inset-0 rounded-full blur-2xl transition-colors duration-500 ${
                        status === 'speaking' ? 'bg-blue-500/40' : status === 'listening' ? 'bg-[#34C759]/40' : 'bg-white/10'
                      }`} />
                    )}
                    <div className="w-full h-full rounded-full bg-gradient-to-b from-[#4A4A4C] to-[#2C2C2E] flex items-center justify-center relative z-10 overflow-hidden">
                       <User className="w-16 h-16 text-white/50" />
                    </div>
                 </div>
              </div>

              {/* Bottom Section - Controls */}
              <div className="pb-12 px-8">
                {isCallActive ? (
                  <>
                    {/* 3x2 Grid */}
                    <div className="grid grid-cols-3 gap-y-6 gap-x-4 mb-12">
                      <div className="flex flex-col items-center gap-2">
                        <button className="w-16 h-16 rounded-full bg-[#333333] flex items-center justify-center hover:bg-[#444444] transition-colors">
                          <MicOff className="w-7 h-7 text-white" />
                        </button>
                        <span className="text-xs text-white">mute</span>
                      </div>
                      <div className="flex flex-col items-center gap-2">
                        <button className="w-16 h-16 rounded-full bg-[#333333] flex items-center justify-center hover:bg-[#444444] transition-colors">
                          <Grid className="w-7 h-7 text-white" />
                        </button>
                        <span className="text-xs text-white">keypad</span>
                      </div>
                      <div className="flex flex-col items-center gap-2">
                        <button className="w-16 h-16 rounded-full bg-[#333333] flex items-center justify-center hover:bg-[#444444] transition-colors">
                          <Volume2 className="w-7 h-7 text-white" />
                        </button>
                        <span className="text-xs text-white">speaker</span>
                      </div>
                      <div className="flex flex-col items-center gap-2">
                        <button className="w-16 h-16 rounded-full bg-[#333333] flex items-center justify-center hover:bg-[#444444] transition-colors opacity-50 cursor-not-allowed">
                          <Plus className="w-7 h-7 text-white" />
                        </button>
                        <span className="text-xs text-white">add call</span>
                      </div>
                      <div className="flex flex-col items-center gap-2">
                        <button className="w-16 h-16 rounded-full bg-[#333333] flex items-center justify-center hover:bg-[#444444] transition-colors opacity-50 cursor-not-allowed">
                          <Video className="w-7 h-7 text-white" />
                        </button>
                        <span className="text-xs text-white">FaceTime</span>
                      </div>
                      <div className="flex flex-col items-center gap-2">
                        <button className="w-16 h-16 rounded-full bg-[#333333] flex items-center justify-center hover:bg-[#444444] transition-colors opacity-50 cursor-not-allowed">
                          <User className="w-7 h-7 text-white" />
                        </button>
                        <span className="text-xs text-white">contacts</span>
                      </div>
                    </div>

                    {/* End Call Button */}
                    <div className="flex justify-center">
                      <button 
                        onClick={() => { endCall(); setIsOpen(false); }}
                        className="w-16 h-16 rounded-full bg-[#FF3B30] flex items-center justify-center hover:bg-[#FF453A] transition-colors"
                      >
                        <PhoneOff className="w-8 h-8 text-white" />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between px-4 mb-8">
                    <div className="flex flex-col items-center gap-2">
                      <button 
                        onClick={() => setIsOpen(false)}
                        className="w-16 h-16 rounded-full bg-[#FF3B30] flex items-center justify-center hover:bg-[#FF453A] transition-colors"
                      >
                        <PhoneOff className="w-8 h-8 text-white" />
                      </button>
                      <span className="text-xs text-white">Decline</span>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <button 
                        onClick={startCall}
                        className="w-16 h-16 rounded-full bg-[#34C759] flex items-center justify-center hover:bg-[#32D74B] transition-colors"
                      >
                        <Phone className="w-8 h-8 text-white" />
                      </button>
                      <span className="text-xs text-white">Accept</span>
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
