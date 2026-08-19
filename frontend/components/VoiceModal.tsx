"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Mic, Square } from "lucide-react";
import { api } from "@/lib/api";

interface VoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  onTurnComplete: (userText: string, botText: string) => void;
}

type VoiceState = "idle" | "listening" | "thinking" | "speaking";

export default function VoiceModal({
  isOpen,
  onClose,
  sessionId,
  onTurnComplete,
}: VoiceModalProps) {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      startListening();
    } else {
      stopEverything();
    }
    return () => stopEverything();
  }, [isOpen]);

  const stopEverything = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    setVoiceState("idle");
  };

  const startListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        if (blob.size > 0) {
          processVoiceTurn(blob);
        }
      };

      mediaRecorder.start();
      setVoiceState("listening");
    } catch (err) {
      console.error("Microphone access error:", err);
      alert("Microphone permission required.");
      onClose();
    }
  };

  const stopListening = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  };

  const processVoiceTurn = async (blob: Blob) => {
    setVoiceState("thinking");
    try {
      const result = await api.sendVoiceChat(sessionId, blob);
      onTurnComplete(result.user_text, result.assistant_text);

      const audioUrl = `data:audio/mp3;base64,${result.audio_base64}`;
      const audio = new Audio(audioUrl);
      currentAudioRef.current = audio;

      setVoiceState("speaking");
      audio.play();

      audio.onended = () => {
        startListening();
      };
    } catch (err) {
      console.error(err);
      setVoiceState("idle");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-[#171717]/95 backdrop-blur-md p-8 select-none">
      <div className="w-full flex justify-end">
        <button
          onClick={onClose}
          className="p-2 text-[#A0A0A0] hover:text-white bg-[#212121] hover:bg-[#2a2a2a] rounded-full transition cursor-pointer"
        >
          <X size={20} />
        </button>
      </div>

      <div className="flex flex-col items-center justify-center gap-8">
        <div className="relative flex items-center justify-center">
          <div
            className={`absolute rounded-full transition-all duration-700 ${
              voiceState === "listening"
                ? "w-48 h-48 bg-[#10a37f]/20 animate-ping"
                : voiceState === "thinking"
                ? "w-48 h-48 bg-blue-500/20 animate-spin"
                : voiceState === "speaking"
                ? "w-56 h-56 bg-purple-500/20 animate-pulse"
                : "w-40 h-40 bg-zinc-800"
            }`}
          />

          <div
            className={`w-36 h-36 rounded-full flex items-center justify-center shadow-2xl transition-all duration-500 ${
              voiceState === "listening"
                ? "bg-[#10a37f] scale-105 shadow-[#10a37f]/50"
                : voiceState === "thinking"
                ? "bg-gradient-to-tr from-cyan-500 to-blue-600 animate-pulse"
                : voiceState === "speaking"
                ? "bg-gradient-to-r from-purple-500 to-indigo-600 scale-110 shadow-purple-500/50"
                : "bg-[#2f2f2f]"
            }`}
          >
            <div className="w-28 h-28 rounded-full bg-[#171717]/40 backdrop-blur-sm flex items-center justify-center text-white">
              {voiceState === "listening" && <Mic size={32} className="animate-bounce" />}
              {voiceState === "thinking" && <div className="w-6 h-6 rounded-full border-2 border-white border-t-transparent animate-spin" />}
              {voiceState === "speaking" && <div className="w-8 h-8 rounded-full bg-white/80 animate-ping" />}
            </div>
          </div>
        </div>

        <span className="text-sm font-medium tracking-wide text-[#ECECEC] uppercase text-center">
          {voiceState === "listening" && "Listening..."}
          {voiceState === "thinking" && "Thinking..."}
          {voiceState === "speaking" && "ChatGPT is speaking..."}
          {voiceState === "idle" && "Tap to talk"}
        </span>
      </div>

      <div className="flex items-center gap-4">
        {voiceState === "listening" ? (
          <button
            onClick={stopListening}
            className="flex items-center gap-2 px-6 py-3 bg-[#2f2f2f] hover:bg-[#383838] border border-[#383838] text-white rounded-full text-xs font-medium transition cursor-pointer"
          >
            <Square size={14} className="fill-current text-red-400" />
            <span>Finished Speaking</span>
          </button>
        ) : voiceState === "speaking" ? (
          <button
            onClick={() => {
              if (currentAudioRef.current) currentAudioRef.current.pause();
              startListening();
            }}
            className="px-6 py-3 bg-[#2f2f2f] hover:bg-[#383838] border border-[#383838] text-white rounded-full text-xs font-medium transition cursor-pointer"
          >
            Interrupt / Speak
          </button>
        ) : null}
      </div>
    </div>
  );
}