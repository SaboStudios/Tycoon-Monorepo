"use client";

import React, { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { Send, MessageCircle, Users, Reply, X } from "lucide-react";
import { Player } from "@/types/game";
import toast from "react-hot-toast";
import { parseMessageBody } from "./chat-room";

const REPLY_QUOTE_PREFIX = "> ";
const REPLY_QUOTE_SEP = "\n\n";
const REPLY_QUOTE_MAX_LEN = 80;

interface Message {
  id: string | number;
  body: string;
  player_id: string;
  created_at?: string;
  username?: string | null;
}

type ReplyingTo = { id: string | number; name: string; body: string };

interface ChatRoomDesktopProps {
  gameId: string | number;
  me: Player | null;
}

const POLLING_INTERVAL = 3000;

const fetchMessages = async (gameId: string | number): Promise<Message[]> => {
  const res = await apiClient.get<{ data?: Message[] }>(`/messages/game/${gameId}`);
  const payload = (res as { data?: { data?: Message[] } })?.data;
  const list = payload?.data ?? payload;
  return Array.isArray(list) ? list : [];
};

function formatTime(created_at?: string) {
  if (!created_at) return "";
  try {
    const d = new Date(created_at);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    return isToday
      ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function getDisplayName(msg: Message, me: Player | null, playerId: string) {
  const isMe = String(msg.player_id) === playerId;
  if (isMe && me?.username) return me.username;
  return msg.username ?? "Player";
}

function getInitial(name: string) {
  return (name || "?").charAt(0).toUpperCase();
}

const ChatRoomDesktop = ({ gameId, me }: ChatRoomDesktopProps) => {
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ReplyingTo | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const playerId = me?.id != null ? String(me.id) : "";
  const canSend = !!playerId;

  const { data: messages = [], isLoading } = useQuery<Message[]>({
    queryKey: ["messages", gameId],
    queryFn: () => fetchMessages(gameId),
    refetchInterval: POLLING_INTERVAL,
    refetchOnWindowFocus: true,
    staleTime: 2000,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !gameId || !playerId || sending) return;

    setSending(true);
    const trimmed = newMessage.trim();
    let bodyToSend = trimmed;
    if (replyingTo) {
      const quoteText = replyingTo.body.length > REPLY_QUOTE_MAX_LEN
        ? replyingTo.body.slice(0, REPLY_QUOTE_MAX_LEN) + "…"
        : replyingTo.body;
      bodyToSend = `${REPLY_QUOTE_PREFIX}@${replyingTo.name}: ${quoteText}${REPLY_QUOTE_SEP}${trimmed}`;
      setReplyingTo(null);
    }
    setNewMessage("");

    queryClient.setQueryData<Message[]>(["messages", gameId], (old = []) => [
      ...old,
      {
        id: "temp-" + Date.now(),
        body: bodyToSend,
        player_id: playerId,
        created_at: new Date().toISOString(),
      },
    ]);

    try {
      await apiClient.post("/messages", {
        game_id: gameId,
        player_id: playerId,
        body: bodyToSend,
      });
      queryClient.invalidateQueries({ queryKey: ["messages", gameId] });
    } catch (err: unknown) {
      queryClient.setQueryData<Message[]>(["messages", gameId], (old = []) =>
        old.filter((m) => !String(m.id).startsWith("temp-"))
      );
      setNewMessage(trimmed);
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to send message";
      toast.error(msg);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden bg-gradient-to-b from-[#0a1214] to-[#060a0b] rounded-xl border border-white/[0.06] shadow-2xl shadow-black/30">
      {/* Messages — desktop: more padding, visible scrollbar */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-5 py-4">
        {isLoading && messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[160px] gap-4">
            <div className="w-12 h-12 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
            <span className="text-sm text-cyan-400/80 font-medium">Loading chat...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center px-8">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500/25 to-cyan-600/10 flex items-center justify-center mb-5 ring-1 ring-cyan-400/25">
              <MessageCircle className="w-10 h-10 text-cyan-400/80" />
            </div>
            <p className="text-white/95 font-semibold text-xl">No messages yet</p>
            <p className="text-cyan-400/70 text-sm mt-2 max-w-xs">
              Start the conversation — say hi to your opponents!
            </p>
            <div className="flex items-center gap-2 mt-4 text-white/40 text-xs">
              <Users className="w-4 h-4" />
              Game chat{gameId ? ` · ${gameId}` : ""}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {messages.map((msg) => {
              const isMe = String(msg.player_id) === playerId;
              const displayName = getDisplayName(msg, me, playerId);
              const { quote, main } = parseMessageBody(msg.body);
              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${isMe ? "flex-row-reverse" : ""}`}
                >
                  <div
                    className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
                      isMe
                        ? "bg-gradient-to-br from-cyan-500 to-cyan-600 text-white shadow-md shadow-cyan-500/25"
                        : "bg-white/10 text-cyan-300/90 border border-white/10"
                    }`}
                  >
                    {getInitial(displayName)}
                  </div>
                  <div className={`flex flex-col min-w-0 flex-1 ${isMe ? "items-end" : "items-start"}`}>
                    <div className={`flex items-baseline gap-2 mb-1 ${isMe ? "flex-row-reverse" : ""}`}>
                      <span
                        className={`text-sm font-semibold ${
                          isMe ? "text-cyan-400" : "text-cyan-400/90"
                        }`}
                      >
                        {displayName}
                      </span>
                      {msg.created_at && !String(msg.id).startsWith("temp-") && (
                        <span className="text-xs text-white/35 tabular-nums">
                          {formatTime(msg.created_at)}
                        </span>
                      )}
                    </div>
                    <div className={`group flex items-end gap-1 max-w-[85%] ${isMe ? "flex-row-reverse" : ""}`}>
                      <div
                        className={`px-4 py-3 rounded-2xl ${
                          isMe
                            ? "bg-gradient-to-br from-cyan-500 to-cyan-600 text-white shadow-lg shadow-cyan-500/20 rounded-br-md"
                            : "bg-white/[0.06] text-white/95 border border-white/10 rounded-bl-md"
                        }`}
                      >
                        {quote && (
                          <div className={`mb-2 pl-2 border-l-2 text-xs opacity-90 ${isMe ? "border-white/50" : "border-cyan-400/50"}`}>
                            <p className="font-semibold text-[11px] mb-0.5">{quote.name}</p>
                            <p className="leading-snug break-words line-clamp-2">{quote.text}</p>
                          </div>
                        )}
                        <p className="text-[15px] leading-relaxed break-words whitespace-pre-wrap">
                          {main}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setReplyingTo({ id: msg.id, name: displayName, body: main })}
                        className="flex-shrink-0 p-1.5 rounded-lg text-white/50 hover:text-cyan-300 transition opacity-0 group-hover:opacity-100"
                        aria-label={`Reply to ${displayName}`}
                      >
                        <Reply className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input — desktop: cleaner bar, no extra bottom padding */}
      <div className="flex-shrink-0 p-4 border-t border-white/[0.06] bg-[#060a0b]/95">
        {replyingTo && (
          <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl bg-cyan-500/10 border border-cyan-400/20">
            <Reply className="w-4 h-4 text-cyan-400 flex-shrink-0" />
            <p className="flex-1 min-w-0 text-xs text-cyan-200 truncate">
              Replying to <span className="font-semibold">{replyingTo.name}</span>: {replyingTo.body.slice(0, 60)}{replyingTo.body.length > 60 ? "…" : ""}
            </p>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10"
              aria-label="Cancel reply"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {!canSend ? (
          <div className="text-center py-3 text-sm text-white/45 font-medium">
            Join the game to send messages
          </div>
        ) : (
          <div className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Type a message..."
              maxLength={500}
              className="flex-1 bg-white/5 text-white placeholder-white/25 px-5 py-3.5 rounded-xl
                border border-white/10 outline-none focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20
                transition-all text-[15px] font-medium"
            />
            <button
              onClick={sendMessage}
              disabled={!newMessage.trim() || sending}
              className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600
                hover:from-cyan-400 hover:to-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed
                flex items-center justify-center text-white shadow-lg shadow-cyan-500/25
                transition-all active:scale-95"
              aria-label="Send message"
            >
              <Send className="w-5 h-5" strokeWidth={2.5} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatRoomDesktop;
