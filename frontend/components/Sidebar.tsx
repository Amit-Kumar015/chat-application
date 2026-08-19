"use client";

import React, { useState } from "react";
import {
  Plus,
  MessageSquare,
  Trash2,
  Edit2,
  PanelLeftClose,
  Check,
  X,
} from "lucide-react";
import { Session } from "@/lib/api";

interface SidebarProps {
  sessions: Session[];
  currentSessionId: string | null;
  isOpen: boolean;
  onToggle: () => void;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onRenameSession: (id: string, newTitle: string) => void;
  onDeleteSession: (id: string) => void;
}

export default function Sidebar({
  sessions,
  currentSessionId,
  isOpen,
  onToggle,
  onSelectSession,
  onNewChat,
  onRenameSession,
  onDeleteSession,
}: SidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  if (!isOpen) return null;

  const handleStartRename = (s: Session, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(s.session_id);
    setEditTitle(s.title);
  };

  const handleSaveRename = (
    id: string,
    e?: React.MouseEvent | React.KeyboardEvent,
  ) => {
    e?.stopPropagation();
    if (editTitle.trim()) {
      onRenameSession(id, editTitle.trim());
    }
    setEditingId(null);
  };

  return (
    <aside className="w-[260px] min-w-[260px] max-w-[260px] h-screen bg-[#0a0a0a] border-r border-[#333333] flex flex-col flex-shrink-0 z-30 select-none font-sans">
      <div className="p-3.5 flex items-center justify-between gap-2">
        <span className="font-semibold text-xl text-[#ECECEC]">OpenChat</span>
        <button
          type="button"
          onClick={onToggle}
          className="p-2 text-[#A0A0A0] hover:text-[#ECECEC] hover:bg-[#212121] rounded-lg transition border border-transparent cursor-pointer"
          title="Close sidebar"
        >
          <PanelLeftClose size={18} />
        </button>
      </div>

      <div className="px-3.5 pt-2 pb-2 flex">
        <button
          type="button"
          onClick={onNewChat}
          className="flex-1 flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#ECECEC] bg-transparent hover:bg-[#212121] active:bg-[#2f2f2f] rounded-md transition border border-[#333333] cursor-pointer"
        >
          <Plus size={16} className="text-[#ECECEC]" />
          <span>New chat</span>
        </button>
      </div>

      <div className="px-4 pt-1 pb-3">
        <span className="text-[11px] font-semibold text-[#8E8E8E] tracking-wider uppercase">
          Recent Chats
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-2.5 py-1 space-y-1">
        {sessions.length === 0 ? (
          <div className="text-xs text-[#8E8E8E] py-8 text-center font-normal">
            No chats yet.
          </div>
        ) : (
          sessions.map((s) => {
            const isActive = s.session_id === currentSessionId;
            const isEditing = s.session_id === editingId;

            return (
              <div
                key={s.session_id}
                onClick={() => !isEditing && onSelectSession(s.session_id)}
                className={`group relative flex items-center justify-between px-3 py-2.5 rounded-lg text-xs cursor-pointer transition ${
                  isActive
                    ? "bg-[#212121] text-[#ECECEC] font-medium"
                    : "text-[#B4B4B4] hover:bg-[#212121] hover:text-[#ECECEC]"
                }`}
              >
                <div className="flex items-center gap-2.5 overflow-hidden flex-1 mr-2">
                  <MessageSquare
                    size={14}
                    className="shrink-0 text-[#8E8E8E]"
                  />
                  {isEditing ? (
                    <input
                      type="text"
                      autoFocus
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter")
                          handleSaveRename(s.session_id, e);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="bg-transparent border-b border-[#10a37f] focus:outline-none w-full text-xs text-[#ECECEC] py-0.5"
                    />
                  ) : (
                    <span className="truncate text-xs">
                      {s.title || "New Chat"}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={(e) => handleSaveRename(s.session_id, e)}
                        className="p-1 text-[#10a37f] hover:opacity-80 cursor-pointer"
                      >
                        <Check size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(null);
                        }}
                        className="p-1 text-[#8E8E8E] hover:text-[#ECECEC] cursor-pointer"
                      >
                        <X size={13} />
                      </button>
                    </>
                  ) : (
                    <div
                      className={`flex items-center gap-1 ${
                        isActive
                          ? "opacity-100"
                          : "opacity-0 group-hover:opacity-100"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={(e) => handleStartRename(s, e)}
                        className="p-1 text-[#8E8E8E] hover:text-[#ECECEC] cursor-pointer"
                        title="Rename"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSession(s.session_id);
                        }}
                        className="p-1 text-[#8E8E8E] hover:text-red-400 cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <span className="h-px bg-[#333333] px-3"></span>
      <div className="p-2">
        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#212121] cursor-pointer transition">
          <div className="w-8 h-8 rounded-full bg-[#10a37f] flex items-center justify-center font-bold text-xs text-white shrink-0">
            AI
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-xs font-medium text-[#ECECEC] truncate">
              Workspace
            </span>
            <span className="text-[10px] text-[#8E8E8E]">RAG Free Plan</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
