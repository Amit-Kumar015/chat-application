"use client";

import React, { useRef, useEffect } from "react";
import { Paperclip, Globe, FileText, Image as ImageIcon, Sparkles } from "lucide-react";

interface AttachMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFile: () => void;
  onSelectUrl: () => void;
}

export default function AttachMenu({
  isOpen,
  onClose,
  onSelectFile,
  onSelectUrl,
}: AttachMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className="absolute bottom-14 left-0 z-50 w-72 bg-[#212121] border border-[#383838] rounded-2xl p-1.5 shadow-2xl animate-in fade-in zoom-in-95 duration-100 select-none"
    >
      <button
        type="button"
        onClick={() => {
          onSelectFile();
          onClose();
        }}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#2f2f2f] text-left transition cursor-pointer group"
      >
        <Paperclip size={18} className="text-[#ECECEC] shrink-0" />
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="text-sm font-medium text-[#ECECEC]">Add files</span>
          <span className="text-sm text-[#8E8E8E] truncate">Upload from computer</span>
        </div>
      </button>

      <button
        type="button"
        onClick={() => {
          onSelectUrl();
          onClose();
        }}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#2f2f2f] text-left transition cursor-pointer group"
      >
        <Globe size={18} className="text-[#ECECEC] shrink-0" />
        <div className="flex text-sm items-center gap-2 overflow-hidden">
          <span className=" font-medium text-[#ECECEC]">Web link</span>
          <span className="text-[#8E8E8E] truncate">Ingest live web page</span>
        </div>
      </button>
    </div>
  );
}