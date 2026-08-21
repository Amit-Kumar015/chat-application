import { customFetch } from "./apiClient";

export interface Session {
  session_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

export interface AttachedDocument {
  name: string;
  type: "file" | "url";
  chunks_count: number;
  created_at: string;
}

export interface User{
  user_id: string,
  username: string, 
  email: string, 
  created_at: string
}

export interface AuthResponse{
  access_token: string,
  token_type: string;
  user: User;
}

export const api = {
  async login(email: string, password: string): Promise<AuthResponse>{
    const res = await customFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({email, password})
    })

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || "Failed to login");
    }
    return res.json()
  },

  async signup(username: string, email: string, password: string): Promise<AuthResponse>{
    const res = await customFetch("/auth/signup", {
      method: "POST",
      body: JSON.stringify({username, email, password})
    })

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || "Failed to signup");
    }
    return res.json()
  },

  async getMe(): Promise<User>{
    const res = await customFetch("/auth/me", {
      method: "GET"
    })

    if (!res.ok) {
      throw new Error("Failed to fetch user profile");
    }

    return res.json()
  },

  async getSessions(): Promise<Session[]> {
    const res = await customFetch("/sessions");
    if (!res.ok) throw new Error("Failed to fetch sessions");
    return res.json();
  },

  async getSessionDocuments(sessionId: string): Promise<AttachedDocument[]> {
    const res = await customFetch(`/documents/${sessionId}`);
    if (!res.ok) return [];
    return res.json();
  },

  async createSession(): Promise<Session> {
    const res = await customFetch(`/sessions`, { method: "POST" });
    if (!res.ok) throw new Error("Failed to create session");
    return res.json();
  },

  async renameSession(sessionId: string, title: string): Promise<Session> {
    const res = await customFetch(`/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) throw new Error("Failed to rename session");
    return res.json();
  },

  async deleteSession(sessionId: string): Promise<void> {
    const res = await customFetch(`/sessions/${sessionId}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete session");
  },

  async getMessages(sessionId: string): Promise<Message[]> {
    const res = await customFetch(`/sessions/${sessionId}/messages`);
    if (!res.ok) throw new Error("Failed to customFetch messages");
    const data = await res.json();
    return data.messages;
  },

  async uploadFile(sessionId: string, file: File): Promise<{ chunks_count: number }> {
    const formData = new FormData();
    formData.append("session_id", sessionId);
    formData.append("file", file);

    const res = await customFetch(`/documents/upload`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error("Upload failed");
    return res.json();
  },

  async ingestUrl(sessionId: string, url: string): Promise<{ chunks_count: number }> {
    const res = await customFetch(`/documents/ingest-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, url }),
    });
    if (!res.ok) throw new Error("URL ingestion failed");
    return res.json();
  },

  async streamChat(
    sessionId: string,
    message: string,
    onToken: (token: string) => void,
    onComplete: () => void,
    onError: (err: string) => void
  ) {
    try {
      const response = await customFetch(`/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, message }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to establish stream");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.replace("data: ", "").trim();
            if (dataStr === "[DONE]") {
              onComplete();
              return;
            }
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.token) onToken(parsed.token);
              if (parsed.error) onError(parsed.error);
            } catch {
              // Ignore partial JSON chunks
            }
          }
        }
      }
      onComplete();
    } catch (err: any) {
      onError(err.message || "Streaming error occurred");
    }
  },

  async transcribeVoice(audioBlob: Blob): Promise<String>{
    const formData = new FormData()
    formData.append("file", audioBlob, "voice_input.webm")

    const res = await customFetch(`/audio/transcribe`, {
      method: "POST",
      body: formData
    })

    if(!res.ok){
      throw new Error("Failed to transcribe audio.");
    }

    const data = await res.json()
    return data.text;
  },

  async sendVoiceChat(session_id: string, audioBlob: Blob): Promise<{
    user_text: string;
    assistant_text: string;
    audio_base64: string;
  }>{
    const formData = new FormData()
    formData.append("session_id", session_id)
    formData.append("file", audioBlob, "voice_turn.webm")

    const res = await customFetch(`/voice/chat`, {
      method: "POST",
      body: formData
    })

    if(!res.ok){
      throw new Error("Voice pipeline failed.");
    }

    return res.json()
  }
};