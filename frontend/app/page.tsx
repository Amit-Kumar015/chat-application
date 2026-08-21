"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import {
  ArrowUp,
  Paperclip,
  PanelLeft,
  Bot,
  Loader2,
  Plus,
  Globe,
  FileText,
  Mic,
  Square,
  Headphones,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Sidebar from "@/components/Sidebar";
import { api, Session, Message, AttachedDocument, User } from "@/lib/api";
import AttachMenu from "@/components/AttachMenu";
import VoiceModal from "@/components/VoiceModal";
import Auth from "@/components/Auth";

export default function ChatPage() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedDocument[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loadSessions = useCallback(async () => {
    try {
      const data = await api.getSessions();
      setSessions(data);
      // if(!currentSessionId) handleNewChat()
    } catch (e) {
      console.error(e);
    }
  }, [])

  useEffect(() => {
    const verifyTokenAndLoad = async () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

      if (!token) {
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }

      try {
        const userData = await api.getMe();
        localStorage.setItem("user", JSON.stringify(userData));
        setUser(userData);
        setIsAuthenticated(true);
        await loadSessions();
        setCurrentSessionId((prev) => prev || `session_${uuidv4().substring(0, 8)}`)
      } catch (err) {
        console.error("Token invalid or expired:", err);
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    verifyTokenAndLoad();
  }, [loadSessions]); 

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleAuthSuccess = async () => {
    try {
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      } else {
        const userData = await api.getMe();
        setUser(userData);
      }
      setIsAuthenticated(true);
      await loadSessions();
    } catch (err) {
      console.error("Error setting up session post-auth:", err);
    }
  };

  const handleSelectFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const activeSessionId =
      currentSessionId || `session_${crypto.randomUUID().substring(0, 8)}`;
    if (!currentSessionId) setCurrentSessionId(activeSessionId);

    setIsUploading(true);
    try {
      const res = await api.uploadFile(activeSessionId, file);
      setAttachedFiles((prev) => [
        ...prev,
        {
          name: file.name,
          type: "file",
          chunks_count: res.chunks_count,
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSelectUrl = async () => {
    const url = prompt("Enter the Web URL");
    if (!url || !url.trim()) return;

    const activeSessionId =
      currentSessionId || `session_${crypto.randomUUID().substring(0, 8)}`;
    if (!currentSessionId) setCurrentSessionId(activeSessionId);

    setIsUploading(true);
    try {
      const res = await api.ingestUrl(activeSessionId, url.trim());
      setAttachedFiles((prev) => [
        ...prev,
        {
          name: url.trim(),
          type: "url",
          chunks_count: res.chunks_count,
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      console.error("URL ingestion failed", err);
    } finally {
      setIsUploading(false);
    }
  };

  const switchSession = async (sessionId: string) => {
    setCurrentSessionId(sessionId);
    if(isVoiceModalOpen) setIsVoiceModalOpen(false)
    try {
      const [history, docs] = await Promise.all([
        api.getMessages(sessionId),
        api.getSessionDocuments(sessionId),
      ]);
      setMessages(history);
      setAttachedFiles(docs);
    } catch {
      setMessages([]);
      setAttachedFiles([]);
    }
  };

  const handleNewChat = () => {
    const newId = `session_${uuidv4().substring(0, 8)}`;
    setCurrentSessionId(newId);
    setMessages([]);
    setAttachedFiles([]);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isStreaming) return;

    const userPrompt = input.trim();
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const activeSessionId =
      currentSessionId || `session_${uuidv4().substring(0, 8)}`;
    if (!currentSessionId) setCurrentSessionId(activeSessionId);

    const isFirstMessage = messages.length === 0;

    const updatedMessages: Message[] = [
      ...messages,
      { role: "user", content: userPrompt },
    ];
    setMessages(updatedMessages);
    setIsStreaming(true);

    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    let accumulatedResponse = "";

    await api.streamChat(
      activeSessionId,
      userPrompt,
      (token) => {
        accumulatedResponse += token;
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            role: "assistant",
            content: accumulatedResponse,
          };
          return next;
        });
      },
      async () => {
        setIsStreaming(false);
        if(isFirstMessage){
          await loadSessions();
        }
      },
      (error) => {
        setIsStreaming(false);
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            role: "assistant",
            content: `Error: ${error}`,
          };
          return next;
        });
      },
    );
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());

        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        if (audioBlob.size === 0) return;

        setIsTranscribing(true);
        try {
          const transcribedText = await api.transcribeVoice(audioBlob);
          if (transcribedText) {
            const textStr = String(transcribedText);
            setInput((prev) => (prev ? `${prev} ${textStr}` : textStr));
          }
        } catch (err) {
          console.error("Transcription error:", err);
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start(200);
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Microphone access denied or error:", err);
      alert("Please allow microphone permissions to use voice input.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-[#171717] flex flex-col items-center justify-center gap-3 select-none">
        <Loader2 size={24} className="animate-spin text-[#10a37f]" />
        <span className="text-xs text-[#8E8E8E] font-medium tracking-wide">
          Verifying session...
        </span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Auth onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="flex w-screen h-screen bg-[#212121] text-[#ECECEC] overflow-hidden font-sans">
      <Sidebar
        user={user}
        setUser={setUser}
        setIsAuthenticated={setIsAuthenticated}
        sessions={sessions}
        currentSessionId={currentSessionId}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onSelectSession={(sessionId) => {
          switchSession(sessionId);
          setSidebarOpen(false);
        }}
        onNewChat={() => {
          handleNewChat();
          setSidebarOpen(false);
        }}
        onRenameSession={async (id, title) => {
          await api.renameSession(id, title);
          loadSessions();
        }}
        onDeleteSession={async (id) => {
          await api.deleteSession(id);
          if (currentSessionId === id) handleNewChat();
          loadSessions();
        }}
      />
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm md:hidden"
        />
      )}

      <main className="flex-1 flex flex-col h-full min-w-0 bg-[#0a0a0a] relative overflow-hidden">
        <header className="h-12 flex items-center justify-between px-3 sm:px-4 shrink-0">
          <div className="flex items-center gap-2">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-1.5 rounded-lg text-[#A0A0A0] hover:text-[#ECECEC] hover:bg-[#2a2a2a] transition cursor-pointer"
              >
                <PanelLeft size={18} />
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-3 sm:px-4 md:px-0 py-4 sm:py-6">
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.length === 0  ? (
              <div className="h-[55vh] sm:h-[60vh] flex flex-col items-center justify-center text-center space-y-3 px-4">
                <div className="w-13 h-13 rounded-full bg-[#2f2f2f] border border-[#333333] flex items-center justify-center text-[#ECECEC]">
                  <Bot size={24} />
                </div>
                <h2 className="text-2xl sm:text-3xl font-semibold text-[#ECECEC]">
                  What can I help with today?
                </h2>
              </div>
            ) : (
              messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex gap-3 items-start ${
                    m.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {m.role === "assistant" && (
                    <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center bg-[#10a37f] text-white">
                      <Bot size={15} />
                    </div>
                  )}

                  <div
                    className={`text-sm leading-relaxed max-w-[80%] ${
                      m.role === "user"
                        ? "bg-[#2f2f2f] text-[#ECECEC] px-4 py-2.5 rounded-2xl rounded-tr-sm border border-[#333333]"
                        : "text-[#ECECEC] prose prose-invert max-w-none pt-1"
                    }`}
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {m.content}
                    </ReactMarkdown>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="max-w-3xl w-full mx-auto p-3 sm:p-4 shrink-0">
          {attachedFiles.length > 0 && (
            <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
              {attachedFiles.map((doc, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 text-[11px] text-[#ECECEC] bg-[#2f2f2f] border border-[#383838] px-2.5 py-1 rounded-lg"
                >
                  {doc.type === "url" ? (
                    <Globe size={13} className="text-[#10a37f] shrink-0" />
                  ) : (
                    <FileText size={13} className="text-[#10a37f] shrink-0" />
                  )}
                  <span className="truncate max-w-[200px]">{doc.name}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end bg-[#2f2f2f] border border-[#333333] rounded-2xl p-1.5 shadow-lg focus-within:border-[#555555] transition">
            {!isRecording && (
              <>
                <button
                  type="button"
                  onClick={() => setIsMenuOpen((prev) => !prev)}
                  className="p-1.5 text-[#ECECEC] hover:bg-[#383838] rounded-full transition ml-1 cursor-pointer"
                  title="Add attachments"
                >
                  {isUploading ? (
                    <Loader2
                      size={18}
                      className="animate-spin text-[#10a37f]"
                    />
                  ) : (
                    <Plus size={18} />
                  )}
                </button>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".pdf,.docx,.txt,.mp3,.mp4,.wav,.m4a,.webm,.ogg"
                  className="hidden"
                />

                <AttachMenu
                  isOpen={isMenuOpen}
                  onClose={() => setIsMenuOpen(false)}
                  onSelectFile={handleSelectFile}
                  onSelectUrl={handleSelectUrl}
                />
              </>
            )}

            {isRecording ? (
              <div className="flex-1 flex items-center justify-between px-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs text-[#ECECEC] font-medium truncate">
                    Recording voice...
                  </span>
                  <span className="text-xs text-[#8E8E8E] font-mono">
                    {formatDuration(recordingTime)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={stopRecording}
                  className="flex items-center gap-1.5 px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 rounded-full text-xs transition cursor-pointer"
                >
                  <Square size={12} className="fill-current" />
                    <span className="hidden sm:inline">Stop & Transcribe</span>
                </button>
              </div>
            ) : (
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                onKeyDown={handleKeyDown}
                placeholder={
                  isTranscribing
                    ? "Transcribing speech with Whisper..."
                    : "Message OpenChat..."
                }
                disabled={isTranscribing}
                className="w-full min-w-0 bg-transparent text-sm text-[#ECECEC] placeholder-[#A0A0A0] focus:outline-none resize-none px-2 sm:px-3 py-1.5 max-h-30"
              />
            )}

            <div className="flex items-center gap-1 mr-1 shrink-0">
              {isTranscribing ? (
                <div className="p-1.5">
                  <Loader2 size={16} className="animate-spin text-[#10a37f]" />
                </div>
              ) : !input.trim() && !isRecording ? (
                <>
                  <button
                    type="button"
                    onClick={startRecording}
                    className="p-1.5 text-[#ECECEC] hover:bg-[#383838] rounded-full transition cursor-pointer"
                    title="Voice input"
                  >
                    <Mic size={18} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsVoiceModalOpen(true)}
                    className="p-1.5 text-[#ECECEC] hover:bg-[#383838] rounded-full transition cursor-pointer"
                    title="Voice Mode"
                  >
                    <Headphones size={18} />
                  </button>

                  <VoiceModal
                    isOpen={isVoiceModalOpen}
                    onClose={() => setIsVoiceModalOpen(false)}
                    sessionId={currentSessionId || "default"}
                    onTurnComplete={(userText, botText) => {
                      setMessages((prev) => [
                        ...prev,
                        { role: "user", content: userText },
                        { role: "assistant", content: botText },
                      ]);
                    }}
                  />
                </>
              ) : (
                !isRecording && (
                  <button
                    type="submit"
                    onClick={handleSendMessage}
                    disabled={!input.trim() || isStreaming}
                    className="h-8 w-8 rounded-full bg-blue-600 text-[#212121] hover:opacity-90 disabled:opacity-70 flex items-center justify-center transition cursor-pointer mr-1"
                  >
                    <ArrowUp size={16} />
                  </button>
                )
              )}
            </div>
          </div>
          <p className="text-[10px] text-center text-[#A0A0A0] mt-2">
            OpenChat can make mistakes. Verify important info.
          </p>
        </div>
      </main>
    </div>
  );
}
