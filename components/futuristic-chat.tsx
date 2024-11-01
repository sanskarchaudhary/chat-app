"use client";

import React, { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { UserListView } from "@/components/UserListView";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  User,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  limit,
  getDocs,
  serverTimestamp as _serverTimestamp,
} from "firebase/firestore";
import { getDatabase, set, onValue, off, ref as dbRef, ref as databaseRef, onDisconnect as firebaseOnDisconnect, DatabaseReference } from "firebase/database";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Video,
  Send,
  Mic,
  MoreVertical,
  X,
  Monitor,
  Mouse,
  LogOut,
  Sun,
  Moon,
  VolumeX,
  Volume2,
  Users,
  Upload,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from 'react-hot-toast';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, StorageReference } from "firebase/storage";
import { DismissableToast } from "@/components/dismissable-toast"; // Adjust the import path as needed

interface SignalingData {
  from?: string;
  to?: string;
  type: string;
  event?: any;
}

interface SignalingServer {
  emit: (event: string, data: SignalingData) => Promise<void>;
  on: (event: string, callback: (data: any) => void) => void;
}

// Create signal
let signalingServerSignal: SignalingServer | null = null;

// Firebase configuration (replace with your own)
export const firebaseConfig = {
  apiKey: "AIzaSyD55cPP_lp1dU-SfN_VqcwiOkscqHX1rYw",
  authDomain: "whatsapp1193425.firebaseapp.com",
  projectId: "whatsapp1193425",
  storageBucket: "whatsapp1193425.appspot.com",
  messagingSenderId: "739346863908",
  appId: "1:739346863908:web:ba867f843d86987b1d85b1",
  databaseURL: "https://whatsapp1193425-default-rtdb.asia-southeast1.firebasedatabase.app"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
export const db = getFirestore(app);
const rtdb = getDatabase(app);
const storage = getStorage(app);

// WebRTC configuration
const configuration = {
  iceServers: [
    {
      urls: [
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302'
      ]
    }
  ],
  iceCandidatePoolSize: 10
};

// Custom hook for authentication
function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const createUserDocument = async (user: User) => {
    const userRef = doc(db, "users", user.uid);
    const userData = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || "",
      // Add any other user data you want to store
    };
    await setDoc(userRef, userData, { merge: true });
  };

  const signIn = async (email: string, password: string) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      await createUserDocument(user); // Create user document after sign in (if it doesn't exist)
    } catch (error) {
      console.error("Error signing in:", error);
      throw error;
    }
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      await updateProfile(user, { displayName });
      await createUserDocument(user); // Create user document after sign up
    } catch (error) {
      console.error("Error signing up:", error);
      throw error;
    }
  };

  const signOutUser = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out", error);
    }
  };

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;
      await createUserDocument(user); // Create user document after Google sign in (if it doesn't exist)
    } catch (error) {
      console.error("Error signing in with Google:", error);
      throw error;
    }
  };

  return { user, loading, signIn, signUp, signOut: signOutUser, signInWithGoogle };
}

// Update the WebRTCService class with better error handling and connection management
class WebRTCService {
  endCall() {
    throw new Error("Method not implemented.");
  }
  async startScreenShare(): Promise<boolean> {
    try {
      // Add screen sharing implementation here
      // Return true on success
      return true;
    } catch (err) {
      console.error('Failed to start screen sharing:', err);
      return false;
    }
  }
  private peerConnection!: RTCPeerConnection;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private roomId: string;
  private userId: string;
  private connectionStateHandler: ((state: string) => void) | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 3; // Adjust this value as needed

  private localVideoRef: React.RefObject<HTMLVideoElement> | null = null;
  private remoteVideoRef: React.RefObject<HTMLVideoElement> | null = null;

  constructor(roomId: string, userId: string, onConnectionStateChange?: (state: string) => void) {
    this.roomId = roomId;
    this.userId = userId;
    this.connectionStateHandler = onConnectionStateChange || null;
    this.initializePeerConnection();
  }

  private async initializePeerConnection() {
    // Create new peer connection
    this.peerConnection = new RTCPeerConnection(configuration);
    
    // Set up connection state monitoring
    this.peerConnection.onconnectionstatechange = () => {
      console.log("Connection state:", this.peerConnection.connectionState);
      if (this.connectionStateHandler) {
        this.connectionStateHandler(this.peerConnection.connectionState);
      }
    };

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendIceCandidate(event.candidate);
      }
    };

    // Handle incoming tracks
    this.peerConnection.ontrack = (event) => {
      if (event.streams?.[0]) {
        this.remoteStream = event.streams[0];
        // Update remote video if reference exists
        if (this.remoteVideoRef?.current) {
          this.remoteVideoRef.current.srcObject = this.remoteStream;
        }
      }
    };
  }

  async startCall(
    localVideoRef: React.RefObject<HTMLVideoElement>,
    remoteVideoRef: React.RefObject<HTMLVideoElement>
  ) {
    try {
      // Store video refs
      this.localVideoRef = localVideoRef;
      this.remoteVideoRef = remoteVideoRef;

      // Initialize peer connection first
      await this.initializePeerConnection();

      // Get user media
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      // Set local video
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = this.localStream;
      }

      // Add tracks to peer connection
      this.localStream.getTracks().forEach(track => {
        if (this.localStream) {
          this.peerConnection.addTrack(track, this.localStream);
        }
      });

      // Create and send offer
      await this.createAndSendOffer();

      // Set up listeners for remote description and candidates
      this.listenForRemoteSessionDescription();
      this.listenForRemoteIceCandidate();

    } catch (error) {
      console.error("Error in startCall:", error);
      throw error;
    }
  }

  private async createAndSendOffer() {
    try {
      // Create offer
      const offer = await this.peerConnection.createOffer();
      
      // Set local description before sending
      await this.peerConnection.setLocalDescription(offer);

      // Wait for ICE gathering to complete
      await new Promise<void>((resolve) => {
        if (this.peerConnection.iceGatheringState === 'complete') {
          resolve();
        } else {
          this.peerConnection.addEventListener('icegatheringstatechange', () => {
            if (this.peerConnection.iceGatheringState === 'complete') {
              resolve();
            }
          });
        }
      });

      // Send offer
      await set(
        dbRef(rtdb, `rooms/${this.roomId}/offers/${this.userId}`),
        {
          type: offer.type,
          sdp: offer.sdp
        }
      );
    } catch (error) {
      console.error("Error creating/sending offer:", error);
      throw error;
    }
  }

  private listenForRemoteSessionDescription() {
    const remoteUserId = this.userId === "user1" ? "user2" : "user1";
    const offerRef = dbRef(rtdb, `rooms/${this.roomId}/offers/${remoteUserId}`);
    const answerRef = dbRef(rtdb, `rooms/${this.roomId}/answers/${remoteUserId}`);

    // Listen for offers
    onValue(offerRef, async (snapshot) => {
      const offer = snapshot.val();
      if (offer && !this.peerConnection.currentRemoteDescription) {
        try {
          await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await this.peerConnection.createAnswer();
          await this.peerConnection.setLocalDescription(answer);
          
          // Send answer
          await set(
            dbRef(rtdb, `rooms/${this.roomId}/answers/${this.userId}`),
            {
              type: answer.type,
              sdp: answer.sdp
            }
          );
        } catch (error) {
          console.error("Error handling offer:", error);
        }
      }
    });

    // Listen for answers
    onValue(answerRef, async (snapshot) => {
      const answer = snapshot.val();
      if (answer && !this.peerConnection.currentRemoteDescription) {
        try {
          await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (error) {
          console.error("Error handling answer:", error);
        }
      }
    });
  }

  private async sendIceCandidate(candidate: RTCIceCandidate) {
    try {
      await set(
        dbRef(rtdb, `rooms/${this.roomId}/candidates/${this.userId}`),
        {
          candidate: candidate.candidate,
          sdpMLineIndex: candidate.sdpMLineIndex,
          sdpMid: candidate.sdpMid
        }
      );
    } catch (error) {
      console.error("Error sending ICE candidate:", error);
    }
  }

  private listenForRemoteIceCandidate() {
    const remoteUserId = this.userId === "user1" ? "user2" : "user1";
    const candidatesRef = dbRef(rtdb, `rooms/${this.roomId}/candidates/${remoteUserId}`);

    onValue(candidatesRef, async (snapshot) => {
      const candidate = snapshot.val();
      if (candidate && this.peerConnection.remoteDescription) {
        try {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
          console.error("Error adding ICE candidate:", error);
        }
      }
    });
  }

  private async replaceVideoTrack() {
    try {
      // Check if peer connection is open before proceeding
      if (this.peerConnection.connectionState === 'closed') {
        throw new Error('Cannot replace track - peer connection is closed');
      }

      const sender = this.peerConnection.getSenders().find(s => 
        s.track?.kind === 'video'
      );

      const videoTrack = this.localStream?.getVideoTracks()[0];
      
      if (sender && videoTrack) {
        await sender.replaceTrack(videoTrack);
      }
    } catch (err) {
      console.error('Failed to replace video track:', err);
      // Handle error appropriately
    }
  }

  public sendRemoteDesktopEvent(event: { type: string; x: number; y: number }) {
    if (this.dataChannel?.readyState === 'open') {
      this.dataChannel.send(JSON.stringify({
        type: 'remote-desktop',
        event
      }));
    }
  }

  // ... rest of the WebRTCService class methods ...
}

// Remote Desktop Component
function RemoteDesktop({
  webrtcService,
}: {
  webrtcService: WebRTCService | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      webrtcService?.sendRemoteDesktopEvent({ type: "mousemove", x, y });
    };

    const handleClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      webrtcService?.sendRemoteDesktopEvent({ type: "click", x, y });
    };

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("click", handleClick);

    return () => {
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("click", handleClick);
    };
  }, [webrtcService]);

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full bg-gray-800 rounded-lg"
        width={800}
        height={600}
      />
      <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded">
        Remote Desktop
      </div>
    </div>
  );
}
// Add these interfaces at the top of the file
interface Message {
  id: string;
  sender: string;
  senderName: string;
  content: string;
  timestamp: Timestamp;
  type: 'text' | 'audio';
  audioUrl?: string;
  duration?: number;
  roomId?: string;
}

// Keep only this complete version
interface AudioMessage extends Message {
  type: 'audio';
  audioUrl: string;  // Make it required since it's needed for audio playback
  duration: number;
}

interface ChatRoom {
  id: string;
  participants: string[];
  lastMessage?: string;
  lastMessageAt?: Timestamp;
}
// Initialize chat list management
const _monitorChatList = (peerConnection: RTCPeerConnection) => {
  const dataChannel = peerConnection.createDataChannel('chat', {
    ordered: false  // Use UDP semantics for chat messages
  });

  // Track active chats
  let activeChatList: { [key: string]: ChatRoom } = {};

  dataChannel.onopen = () => {
    console.log('Chat channel opened');
  };

  dataChannel.onmessage = (evt) => {
    // Handle incoming chat messages
    const message = evt.data;
    updateChatList(message);
  };

  dataChannel.onclose = () => {
    // Clean up chat list when connection closes
    console.log('Chat channel closed');
    cleanupChatList();
  };

  const updateChatList = (message: string) => {
    // Update active chats based on message
    const parsedMessage = JSON.parse(message) as { userId: string; chatData: ChatRoom };
    activeChatList[parsedMessage.userId] = parsedMessage.chatData;
  };

  const cleanupChatList = () => {
    activeChatList = {};
  };
};

// Add these interfaces
interface AudioMessage {
  id: string;
  sender: string;
  senderName: string;
  content: string;
  timestamp: Timestamp;
  type: 'audio';
  audioUrl: string;
}

// Add these types near the top of the file
interface FileUpload {
  id: string;
  url: string;
  name: string;
  type: string;
  size: number;
  progress: number;
}

// Add this helper function at the top level
const getFriendDisplayName = async (db: any, userId: string, roomId: string): Promise<string> => {
  // Extract friend's ID from room ID
  const [id1, id2] = roomId.split('_');
  const friendId = id1 === userId ? id2 : id1;
  
  // Get friend's user document
  const userDoc = await getDoc(doc(db, "users", friendId));
  const userData = userDoc.data();
  
  return userData?.displayName || userData?.email || 'Unknown User';
};

// Add this function to find the most recent chat
const _findMostRecentChat = (chats: (Message | AudioMessage)[]) => {
  if (!chats || chats.length === 0) return null;
  
  return chats.reduce((mostRecent, current) => {
    const currentTime = current.timestamp?.toDate() || new Date(0);
    const mostRecentTime = mostRecent.timestamp?.toDate() || new Date(0);
    return currentTime > mostRecentTime ? current : mostRecent;
  });
};

// Modify the handleOpenChat function
const handleOpenChat = (currentUser: User) => {
  if (!currentUser) return;
  
  // Get chats from Firestore
  const q = query(
    collection(db, "chats"),
    orderBy("timestamp", "desc"),
    limit(1)
  );

  onSnapshot(q, (snapshot) => {
    const mostRecentChat = snapshot.docs[0]?.data();
    if (mostRecentChat) {
      const recipientId = mostRecentChat.participants.find(
        (id: string) => id !== currentUser.uid
      );
      setActiveChat(recipientId);
    }
  });
};

// Main Component
export default function FuturisticChat() {
  const { user, loading, signIn, signUp, signOut, signInWithGoogle } =
    useAuth();
  const [messages, setMessages] = useState<(Message | AudioMessage)[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [activeChat, setActiveChat] = useState("");
  const [isInCall, setIsInCall] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRemoteDesktop, setIsRemoteDesktop] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [authError, setAuthError] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showUserList, setShowUserList] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState(false);
  const [_audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const _audioChunksRef = useRef<Blob[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [_fileUploads, _setFileUploads] = useState<Record<string, FileUpload>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const webrtcServiceRef = useRef<WebRTCService | null>(null);

  const chatComponentRef = useRef<HTMLDivElement>(null);

  // Define interface for contact type
  interface Contact {
    id: string;
    name: string;
    photoURL?: string;
    email?: string;
  }

  // Initialize contacts array with proper typing
  const [contacts, setContacts] = useState<Contact[]>([]);

  // Add state for chat names
  const [chatNames, setChatNames] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (!user) return;

    // Query users collection excluding current user
    const usersRef = collection(db, "users");
    const q = query(usersRef);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const contactsList: Contact[] = [];
      snapshot.forEach((doc) => {
        const userData = doc.data();
        // Don't include current user in contacts list
        if (doc.id !== user.uid) {
          contactsList.push({
            id: doc.id,
            name: userData.displayName || userData.email || "Unknown User",
            photoURL: userData.photoURL,
            email: userData.email,
          });
        }
      });
      setContacts(contactsList);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user || !activeChat) return;

    // Create room ID consistently
    const roomId = [user.uid, activeChat].sort().join("_");

    // Query messages for this specific chat room
    const q = query(
      collection(db, `chatrooms/${roomId}/messages`),
      orderBy("timestamp", "desc"),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (QuerySnapshot) => {
      const fetchedMessages: (Message | AudioMessage)[] = [];
      QuerySnapshot.forEach((doc) => {
        const data = doc.data();
        fetchedMessages.push({
          id: doc.id,
          ...data,
          timestamp: data.timestamp,
        } as Message | AudioMessage);
      });

      setMessages(fetchedMessages.reverse());
    });

    return () => unsubscribe();
  }, [activeChat, user]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !user || !activeChat) return;

    try {
      const roomId = [user.uid, activeChat].sort().join("_");

      const message = {
        content: inputMessage,
        sender: user.uid,
        senderName: user.displayName || user.email || "Unknown User",
        timestamp: Timestamp.now(),
        type: "text",
      };

      // Add message to the chat room's messages subcollection
      await addDoc(collection(db, `chatrooms/${roomId}/messages`), message);

      // Update latest message in chat room document
      await setDoc(
        doc(db, "chatrooms", roomId),
        {
          lastMessage: {
            content: inputMessage,
            timestamp: Timestamp.now(),
          },
        },
        { merge: true }
      );

      setInputMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    }
  };

  const handleStartCall = async () => {
    try {
      if (!user || !activeChat) return;
      
      // Send "incoming call" signal via your signaling server
      if (signalingServerSignal) {
        await signalingServerSignal.emit('incoming-call', {
          from: user.uid,
          to: activeChat,
          type: 'video' // or 'audio'
        });
      }

      // Initialize WebRTC after the other peer accepts
      webrtcServiceRef.current = new WebRTCService(
        `room_${activeChat}`, 
        user.uid,
        (state) => {
          console.log("WebRTC connection state:", state);
        }
      );
    } catch (error) {
      console.error("Failed to start call:", error);
    }
  };

  const handleEndCall = () => {
    if (webrtcServiceRef.current) {
      webrtcServiceRef.current.endCall();
      webrtcServiceRef.current = null;
    }
    setIsInCall(false);
  };

  const handleScreenShare = async () => {
    if (webrtcServiceRef.current) {
      const success = await webrtcServiceRef.current.startScreenShare();
      setIsScreenSharing(success);
    }
  };

  const handleRemoteDesktop = () => {
    setIsRemoteDesktop(!isRemoteDesktop);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    try {
      if (isSignUp) {
        await signUp(email, password, displayName);
      } else {
        await signIn(email, password);
      }
    } catch {
      setAuthError("Authentication failed. Please check your credentials.");
    }
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    // Apply dark mode to the entire app
    document.documentElement.classList.toggle("dark");
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    // Implement actual muting logic here
  };

  // Add user presence tracking
  useEffect(() => {
    if (!user) return;

    const userStatusRef = databaseRef(rtdb, `status/${user.uid}`);
    const connectedRef = databaseRef(rtdb, ".info/connected");

    onValue(connectedRef, (snapshot) => {
      if (snapshot.val() === false) return;

      set(userStatusRef, {
        state: "online",
        lastSeen: Timestamp.now().toDate().toISOString(),
        displayName: user.displayName || user.email,
      }).catch(console.error);

      // When user disconnects, update the last seen time
      const disconnectRef = firebaseOnDisconnect(databaseRef(rtdb, `status/${user.uid}`));
      disconnectRef.set({
        state: "offline",
        lastSeen: Timestamp.now().toDate().toISOString(),
        displayName: user.displayName || user.email,
      }).catch(console.error);
    });

    return () => {
      off(connectedRef);
      set(userStatusRef, {
        state: "offline",
        lastSeen: new Date().toISOString(),
        displayName: user.displayName || user.email,
      }).catch(console.error);
    };
  }, [user]);

  const handleMessageRequest = async (recipientId: string) => {
    if (!user) return;

    try {
      // Get recipient user data to get their display name
      const recipientDoc = await getDoc(doc(db, "users", recipientId));
      const recipientData = recipientDoc.data();
      const recipientName = recipientData?.displayName || "Unknown User";

      // Create a unique chat room ID (keep UIDs for backend but use name for display)
      const chatRoomId = [recipientName].sort().join('"');

      // Create or update chat room
      await setDoc(
        doc(db, "chatrooms", chatRoomId),
        {
          participants: [user.uid, recipientId],
          participantNames: {
            [user.uid]: user.displayName,
            [recipientId]: recipientName,
          },
          createdAt: Timestamp.now(),
          lastMessage: {
            content: "Chat started",
            timestamp: Timestamp.now(),
          },
        },
        { merge: true }
      );

      // Add to recent chats collection for both users
      await addDoc(collection(db, "users", user.uid, "recentChats"), {
        chatRoomId,
        participantId: recipientId,
        participantName: recipientName, // Store recipient name
        lastMessageAt: Timestamp.now(),
      });

      await addDoc(collection(db, "users", recipientId, "recentChats"), {
        chatRoomId,
        participantId: user.uid,
        participantName: user.displayName, // Store sender name
        lastMessageAt: Timestamp.now(),
      });

      setShowUserList(false);
      setActiveChat(chatRoomId);
      toast.success("Chat started successfully!");
    } catch (error) {
      console.error("Error creating chat:", error);
      toast.error("Failed to start chat");
    }
  };

  // Modify the useEffect that fetches chats to include recent chats
  useEffect(() => {
    if (!user) return;

    // Query recent chats for current user
    const recentChatsRef = collection(db, "users", user.uid, "recentChats");
    const q = query(recentChatsRef, orderBy("lastMessageAt", "desc"));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const chatsPromises = snapshot.docs.map(async (documentSnapshot) => {
        const chatData = documentSnapshot.data();
        const roomId = [user.uid, chatData.participantId].sort().join("_");

        // Get friend's display name
        const friendName = await getFriendDisplayName(db, user.uid, roomId);

        // Update chat names state
        setChatNames((prev) => ({
          ...prev,
          [roomId]: friendName,
        }));

        return {
          id: roomId,
          content: chatData.lastMessage || "",
          sender: chatData.participantId,
          senderName: friendName,
          timestamp: chatData.lastMessageAt,
          type: "text" as const,
          roomId: roomId,
        } satisfies Message;
      });

      const chats = await Promise.all(chatsPromises);
      setMessages(chats as (Message | AudioMessage)[]);
    });

    return () => unsubscribe();
  }, [user]);

  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleAudioRecording = async () => {
    if (!user || !activeChat) {
      toast.error("Please select a chat first");
      return;
    }

    if (!isRecording) {
      try {
        // Check browser compatibility first
        if (!navigator.mediaDevices || !MediaRecorder) {
          toast.error("Your browser does not support audio recording");
          return;
        }

        // Start recording with error checks
        setIsRecording(true);
        const audioData = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        // Verify MIME type support
        const mimeType = MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : null;

        if (!mimeType) {
          throw new Error("No supported audio MIME type found");
        }

        const recorder = new MediaRecorder(audioData, { mimeType });
        const chunks: BlobPart[] = [];

        recorder.ondataavailable = (e) => {
          if (e.data?.size > 0) chunks.push(e.data);
        };

        recorder.onstop = async () => {
          try {
            // Stop all audio tracks
            audioData.getTracks().forEach((track) => track.stop());

            const blob = new Blob(chunks, { type: recorder.mimeType });
            const roomId = [user.uid, activeChat].sort().join("_");
            const filename = `chatrooms/${roomId}/audio/${Date.now()}_${
              user.uid
            }.${recorder.mimeType.split("/")[1]}`;

            // Create storage reference
            const storageRef = ref(storage, filename);

            // Show uploading toast
            const uploadingToast = toast.loading("Uploading voice message...");

            try {
              // Upload the blob
              const uploadResult = await uploadBytesResumable(storageRef, blob);
              const audioUrl = await getDownloadURL(uploadResult.ref);

              // Add message to Firestore
              await addDoc(collection(db, `chatrooms/${roomId}/messages`), {
                sender: user.uid,
                senderName: user.displayName || user.email,
                timestamp: Timestamp.now(),
                type: "audio",
                audioUrl,
                content: "🎤 Voice message",
                duration: chunks.length * 100,
              });

              // Update latest message
              await setDoc(
                doc(db, "chatrooms", roomId),
                {
                  lastMessage: {
                    content: "🎤 Voice message",
                    timestamp: Timestamp.now(),
                  },
                },
                { merge: true }
              );

              toast.dismiss(uploadingToast);
              toast.success("Voice message sent!");
            } catch (error) {
              console.error("Error uploading audio:", error);
              toast.dismiss(uploadingToast);

              // More specific error handling
              if ((error as any).code === 'storage/unauthorized') {
                toast.error('Permission denied. Please check if you are logged in.');
              } else if ((error as any).code === 'storage/quota-exceeded') {
                toast.error('Storage quota exceeded. Please contact support.');
              } else {
                toast.error("Failed to send voice message");
              }
            }
          } catch (error) {
            console.error("Error processing audio:", error);
            toast.error("Failed to process audio recording");
          }
        };

        recorder.start(100);
        setMediaRecorder(recorder);
      } catch (error) {
        console.error("Error recording audio:", error);
        setIsRecording(false);
        toast.error(
          error instanceof Error ? error.message : "Failed to access microphone"
        );
      }
    } else {
      if (mediaRecorder?.state === "recording") {
        mediaRecorder.stop();
        setMediaRecorder(null);
      }
      setIsRecording(false);
    }
  };

  // Update the delete message function
  const handleDeleteMessage = async (messageId: string, senderId: string) => {
    if (!user || user.uid !== senderId) {
      toast.error("You can only delete your own messages");
      return;
    }

    try {
      const roomId = [user.uid, activeChat].sort().join("_");

      // Delete the message document
      await deleteDoc(doc(db, `chatrooms/${roomId}/messages`, messageId));

      // Update latest message if this was the last message
      const q = query(
        collection(db, `chatrooms/${roomId}/messages`),
        orderBy("timestamp", "desc"),
        limit(1)
      );

      const lastMessageSnapshot = await getDocs(q);
      if (!lastMessageSnapshot.empty) {
        const lastMessage = lastMessageSnapshot.docs[0].data();
        await setDoc(
          doc(db, "chatrooms", roomId),
          {
            lastMessage: {
              content: lastMessage.content,
              timestamp: lastMessage.timestamp,
            },
          },
          { merge: true }
        );
      }

      toast.success("Message deleted");
    } catch (error) {
      console.error("Error deleting message:", error);
      toast.error("Failed to delete message");
    }
  };

  const _handleChatOpen = () => {
    if (chatComponentRef.current) {
      chatComponentRef.current.style.height = "100%";
      console.log("Chat opened successfully");
    }
  };

  // Add this function to handle file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !activeChat || !user) return;

    setIsUploading(true);
    const roomId = [user.uid, activeChat].sort().join("_");

    try {
      const file = files[0]; // Handle one file at a time for simplicity
      const filename = `chatrooms/${roomId}/files/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, filename);
      const uploadTask = uploadBytesResumable(storageRef, file);

      // Monitor upload progress
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress =
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (error) => {
          console.error("Upload error:", error);
          toast.error("Failed to upload file");
          setIsUploading(false);
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

            // Add message to chat
            await addDoc(collection(db, `chatrooms/${roomId}/messages`), {
              sender: user.uid,
              senderName: user.displayName || user.email,
              timestamp: Timestamp.now(),
              type: "file",
              fileUrl: downloadURL,
              fileName: file.name,
              fileType: file.type,
              fileSize: file.size,
              content: `📎 ${file.name}`,
            });

            // Update latest message
            await setDoc(
              doc(db, "chatrooms", roomId),
              {
                lastMessage: {
                  content: `📎 ${file.name}`,
                  timestamp: Timestamp.now(),
                },
              },
              { merge: true }
            );

            toast.success("File uploaded successfully!");
          } catch (error) {
            console.error("Error saving message:", error);
            toast.error("Failed to send file message");
          } finally {
            setIsUploading(false);
            setUploadProgress(0);
            // Clear the file input
            if (fileInputRef.current) {
              fileInputRef.current.value = "";
            }
          }
        }
      );
    } catch (error) {
      console.error("Error starting upload:", error);
      toast.error("Failed to start upload");
      setIsUploading(false);
    }
  };

  // Add this function near your other state declarations
  const handleContactClick = async (contactName: string) => {
    setActiveChat(contactName);

    const messagesRef = collection(db, "messages");
    const q = query(messagesRef, orderBy("timestamp", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newMessages = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as (Message | AudioMessage)[];
      setMessages(newMessages);
    });

    return unsubscribe;
  };

  // Add this helper function to get contact name from ID
  const getContactName = (contactId: string): string => {
    const contact = contacts.find((c) => c.id === contactId);
    return contact?.name || "Unknown User";
  };

  // Add this helper function at the component level
  const getRecipientName = (
    recipientId: string,
    contacts: Contact[]
  ): string => {
    const recipient = contacts.find((c) => c.id === recipientId);
    return recipient?.name || "Unknown User";
  };

  // 2. On the receiving end
  useEffect(() => {
    if (!signalingServerSignal) return;

    signalingServerSignal.on('incoming-call', async (data: { from: string; type: string }) => {
      // Show incoming call UI with ringtone
      setIncomingCall({
        from: data.from,
        type: data.type
      });
      
      // Play ringtone
      playRingtone();
    });
    // Handle call accepted
    signalingServerSignal.on('call-accepted', async (data: any) => {
      // Initialize WebRTC connection
      if (webrtcServiceRef.current) {
        await webrtcServiceRef.current.startCall(localVideoRef, remoteVideoRef);
      }
    });
  }, []);

  // 3. Helper function to play ringtone
  const playRingtone = () => {
    const audio = new Audio('/path/to/ringtone.mp3');
    audio.loop = true;
    audio.play();
    return audio; // Store this reference to stop it later
  };

  // Make component reactive to signals

  const handleCall = async () => {
    if (!user) return;

    await signalingServerSignal!.emit('incoming-call', {
      from: user.uid,
      to: activeChat,
      type: 'call'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-r from-purple-400 via-pink-500 to-red-500">
        <div className="text-white text-4xl font-bold">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-r from-purple-400 via-pink-500 to-red-500">
        <Card className="w-96 p-6 bg-white bg-opacity-10 backdrop-blur-lg rounded-xl shadow-xl">
          <h2 className="text-3xl font-bold mb-6 text-center text-white">
            {isSignUp ? "Sign Up" : "Login"}
          </h2>
          <form onSubmit={handleAuth} className="space-y-4">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-white bg-opacity-20 border-0 placeholder-gray-300 text-white"
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="bg-white bg-opacity-20 border-0 placeholder-gray-300 text-white"
            />
            {isSignUp && (
              <Input
                type="text"
                placeholder="Display Name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                className="bg-white bg-opacity-20 border-0 placeholder-gray-300 text-white"
              />
            )}
            {authError && <p className="text-red-300 text-sm">{authError}</p>}
            <Button
              type="submit"
              className="w-full bg-white text-purple-600 hover:bg-opacity-90"
            >
              {isSignUp ? "Sign Up" : "Login"}
            </Button>

            <Button
              type="button"
              onClick={signInWithGoogle}
              className="w-full bg-white text-purple-600 hover:bg-opacity-90"
            >
              Sign In with Google
            </Button>
          </form>
          <p className="mt-4 text-center text-white">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="ml-1 text-pink-300 hover:underline"
            >
              {isSignUp ? "Login" : "Sign Up"}
            </button>
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div ref={chatComponentRef}>
      <DismissableToast />
      <div
        className={`flex h-screen bg-gradient-to-r ${
          isDarkMode
            ? "from-gray-900 to-gray-800 text-white"
            : "from-purple-100 to-pink-100"
        } transition-colors duration-500`}
      >
        <div className="w-1/4 bg-opacity-10 backdrop-blur-lg border-r border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
              Chats
            </h2>
            <div className="flex space-x-2 items-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="relative h-10 w-10 rounded-full"
                  >
                    <Avatar className="h-10 w-10 ring-2 ring-purple-500">
                      <AvatarImage
                        src={user.photoURL || ""}
                        alt={user.displayName || "User"}
                      />
                      <AvatarFallback>
                        {(user.displayName || user.email || "U")
                          ?.charAt(0)
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end">
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="flex flex-col items-start">
                    <span className="font-medium">
                      {user.displayName || "User"}
                    </span>
                    <span className="text-xs text-gray-500">{user.email}</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="ghost" size="icon" onClick={toggleDarkMode}>
                {isDarkMode ? (
                  <Sun className="h-5 w-5" />
                ) : (
                  <Moon className="h-5 w-5" />
                )}
              </Button>
              <Button variant="ghost" size="icon" onClick={toggleMute}>
                {isMuted ? (
                  <VolumeX className="h-5 w-5" />
                ) : (
                  <Volume2 className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
          <ScrollArea className="h-[calc(100vh-5rem)]">
            {contacts?.map((contact) => (
              <motion.button
                key={contact.id}
                className={`flex items-center w-full p-4 hover:bg-white hover:bg-opacity-10 ${
                  activeChat === contact.id ? "bg-white bg-opacity-20" : ""
                }`}
                onClick={() => setActiveChat(contact.id)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Avatar className="h-10 w-10 ring-2 ring-purple-500">
                  <AvatarImage
                    src={contact.photoURL || ""}
                    alt={contact.name}
                  />
                  <AvatarFallback>
                    {contact.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="ml-4 text-left">
                  <p className="font-medium">{contact.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {contact.email}
                  </p>
                </div>
              </motion.button>
            ))}
          </ScrollArea>
        </div>
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-opacity-10 backdrop-blur-lg">
            <div className="flex items-center">
              <Avatar className="h-10 w-10 ring-2 ring-purple-500">
                <AvatarImage
                  src={
                    contacts.find((c) => c.id === activeChat)?.photoURL || ""
                  }
                  alt={getRecipientName(activeChat, contacts)}
                />
                <AvatarFallback>
                  {getRecipientName(activeChat, contacts)
                    .charAt(0)
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <h2 className="ml-4 text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
                {getRecipientName(activeChat, contacts)}
              </h2>
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handleStartCall}
                className="bg-opacity-20 backdrop-blur-sm"
              >
                <Video className="h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="bg-opacity-20 backdrop-blur-sm"
              >
                <MoreVertical className="h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowUserList(true)}
                className="bg-opacity-20 backdrop-blur-sm"
              >
                <Users className="h-5 w-5" />
              </Button>
            </div>
          </div>
          <ScrollArea className="flex-1 p-4 bg-opacity-10 backdrop-blur-sm">
            <AnimatePresence mode="popLayout">
              {messages.map((message) => (
                <motion.div
                  key={`${message.id}_${message.timestamp}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className={`flex ${
                    message.sender === user?.uid
                      ? "justify-end"
                      : "justify-start"
                  } mb-4`}
                >
                  <div
                    className={`max-w-[70%] p-3 rounded-lg relative group ${
                      message.sender === user.uid
                        ? "bg-purple-500 text-white"
                        : "bg-white bg-opacity-20 backdrop-blur-sm"
                    }`}
                  >
                    {/* Add delete button that shows on hover */}
                    {message.sender === user.uid && (
                      <button
                        onClick={() =>
                          handleDeleteMessage(message.id, message.sender)
                        }
                        className="absolute -right-2 -top-2 opacity-0 group-hover:opacity-100 
                                   transition-opacity bg-red-500 hover:bg-red-600 rounded-full 
                                   p-1 text-white"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                    <p className="font-semibold">{message.senderName}</p>
                    {message.type === "audio" ? (
                      <div className="flex items-center space-x-2">
                        <audio
                          controls
                          src={(message as AudioMessage).audioUrl}
                          className="h-8 max-w-[200px] audio-player-custom"
                          preload="metadata"
                        />
                        <span className="text-xs opacity-70">
                          {message.type === "audio" && "duration" in message && message.duration 
                            ? `${Math.round(message.duration / 1000)}s`
                            : ""}
                        </span>
                      </div>
                    ) : (
                      <p>{message.content}</p>
                    )}
                    <p
                      className={`text-xs mt-1 ${
                        message.sender === user.uid
                          ? "text-purple-200"
                          : "text-gray-400"
                      }`}
                    >
                      {message.timestamp?.toDate()?.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      }) ?? "No time available"}
                    </p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </ScrollArea>
          <form
            onSubmit={handleSendMessage}
            className="p-4 bg-opacity-10 backdrop-blur-lg border-t border-gray-200 dark:border-gray-700 flex items-center"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              multiple
            />
            <Input
              type="text"
              placeholder="Type a message..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              className="flex-1 mr-2 bg-white bg-opacity-20 border-0 placeholder-gray-400 text-gray-800 dark:text-white"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              className="mr-2"
              disabled={isUploading}
            >
              {isUploading ? (
                <div className="h-5 w-5 relative">
                  <div className="absolute inset-0 rounded-full border-2 border-gray-200" />
                  <div
                    className="absolute inset-0 rounded-full border-2 border-purple-500 transition-all duration-300"
                    style={{
                      clipPath: `inset(0 ${100 - uploadProgress}% 0 0)`,
                    }}
                  />
                </div>
              ) : (
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              )}
            </Button>
            <Button
              type="submit"
              size="icon"
              className="bg-purple-500 hover:bg-purple-600"
            >
              <Send className="h-5 w-5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={`ml-2 transition-colors duration-200 ${
                isRecording ? "bg-red-500 hover:bg-red-600" : ""
              }`}
              onMouseDown={handleAudioRecording}
              onMouseUp={handleAudioRecording}
              onMouseLeave={() => isRecording && handleAudioRecording()}
              disabled={isUploading}
            >
              {isUploading ? (
                <div className="h-5 w-5 relative">
                  <div className="absolute inset-0 rounded-full border-2 border-gray-200" />
                  <div
                    className="absolute inset-0 rounded-full border-2 border-purple-500 transition-all duration-300"
                    style={{
                      clipPath: `inset(0 ${100 - uploadProgress}% 0 0)`,
                    }}
                  />
                </div>
              ) : (
                <Mic
                  className={`h-5 w-5 ${isRecording ? "animate-pulse" : ""}`}
                />
              )}
            </Button>
          </form>
        </div>

        <AnimatePresence>
          {isInCall && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50"
            >
              <Card className="w-[80vw] max-w-4xl p-6 bg-opacity-90 backdrop-blur-lg">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
                    Call with {getRecipientName(activeChat, contacts)}
                  </h3>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={handleEndCall}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
                <Tabs defaultValue="video" className="w-full">
                  <TabsList className="grid w-full grid-cols-3 mb-4">
                    <TabsTrigger value="video">Video Call</TabsTrigger>
                    <TabsTrigger value="screen">Screen Share</TabsTrigger>
                    <TabsTrigger value="remote">Remote Desktop</TabsTrigger>
                  </TabsList>
                  <TabsContent value="video" className="mt-0">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="aspect-video bg-gray-800 rounded-lg overflow-hidden">
                        <video
                          ref={localVideoRef}
                          autoPlay
                          muted
                          playsInline
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="aspect-video bg-gray-800 rounded-lg overflow-hidden">
                        <video
                          ref={remoteVideoRef}
                          autoPlay
                          playsInline
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="screen" className="mt-0">
                    <div className="aspect-video bg-gray-800 rounded-lg overflow-hidden mb-4">
                      <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </TabsContent>
                  <TabsContent value="remote" className="mt-0">
                    <RemoteDesktop webrtcService={webrtcServiceRef.current} />
                  </TabsContent>
                </Tabs>
                <div className="flex justify-center space-x-4">
                  <Button variant="outline" size="icon" onClick={toggleMute}>
                    {isMuted ? (
                      <VolumeX className="h-5 w-5" />
                    ) : (
                      <Mic className="h-5 w-5" />
                    )}
                  </Button>
                  <Button variant="outline" size="icon">
                    <Video className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleScreenShare}
                    disabled={isScreenSharing}
                  >
                    <Monitor className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleRemoteDesktop}
                    disabled={isRemoteDesktop}
                  >
                    <Mouse className="h-5 w-5" />
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {showUserList && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50"
            >
              <div className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowUserList(false)}
                  className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full"
                >
                  <X className="h-5 w-5" />
                </Button>
                <UserListView
                  currentUser={{
                    ...user,
                    email: user?.email || "",
                    photoURL: user?.photoURL || undefined,
                    displayName: user?.displayName || "",
                  }}
                  onMessageRequest={handleMessageRequest}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function signal(arg0: null) {
  throw new Error("Function not implemented.");
}

function setActiveChat(recipientId: any) {
  throw new Error("Function not implemented.");
}

function onDisconnect(userStatusRef: DatabaseReference) {
  throw new Error("Function not implemented.");
}

function uploadBytes(storageRef: StorageReference, blob: Blob) {
  throw new Error("Function not implemented.");
}

function setIsUploading(arg0: boolean) {
  throw new Error("Function not implemented.");
}

function setIncomingCall(arg0: { from: any; type: any; }) {
  throw new Error("Function not implemented.");
}

