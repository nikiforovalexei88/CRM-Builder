import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { ExternalLink, FileUp, MessageCircle, Paperclip, RefreshCw, Send, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Chat = {
  id: number;
  lead_id?: number | null;
  leadId?: number | null;
  manager_id?: number | null;
  telegram_chat_id?: string | null;
  telegramChatId?: string | null;
  telegram_username?: string | null;
  telegramUsername?: string | null;
  client_name?: string;
  clientName?: string;
  status: string;
  last_message_text?: string | null;
  lastMessageText?: string | null;
  last_message_at?: string | null;
  lastMessageAt?: string | null;
  lead_status?: string | null;
  manager_name?: string | null;
};

type Message = {
  id: number;
  direction: "incoming" | "outgoing";
  senderType: string;
  text?: string | null;
  attachmentName?: string | null;
  attachment_name?: string | null;
  status: string;
  createdAt?: string;
  created_at?: string;
};

function chatName(chat?: Chat | null) {
  return chat?.clientName ?? chat?.client_name ?? "Клиент";
}

function chatLeadId(chat?: Chat | null) {
  return chat?.leadId ?? chat?.lead_id ?? null;
}

function chatTelegramId(chat?: Chat | null) {
  return chat?.telegramChatId ?? chat?.telegram_chat_id ?? null;
}

function lastText(chat: Chat) {
  return chat.lastMessageText ?? chat.last_message_text ?? "Нет сообщений";
}

function messageDate(message: Message) {
  return message.createdAt ?? message.created_at ?? "";
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "include", ...options });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || "Ошибка запроса");
  return data as T;
}

async function fileToBase64(file: File) {
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export default function Chats() {
  const [location, navigate] = useLocation();
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [connectLink, setConnectLink] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedChat = useMemo(() => chats.find((chat) => chat.id === selectedId) ?? null, [chats, selectedId]);

  const loadChats = async () => {
    const rows = await api<Chat[]>("/api/chats");
    setChats(rows);
    const leadParam = new URLSearchParams(location.split("?")[1] ?? "").get("leadId");
    if (leadParam) {
      const byLead = rows.find((chat) => String(chatLeadId(chat)) === leadParam);
      if (byLead) setSelectedId(byLead.id);
    } else if (!selectedId && rows[0]) {
      setSelectedId(rows[0].id);
    }
  };

  const loadMessages = async (chatId: number) => {
    const rows = await api<Message[]>(`/api/chats/${chatId}/messages`);
    setMessages(rows);
    setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }), 50);
  };

  useEffect(() => {
    void loadChats();
    const timer = window.setInterval(() => {
      void loadChats();
      if (selectedId) void loadMessages(selectedId);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    setError("");
    setConnectLink(null);
    void loadMessages(selectedId);
  }, [selectedId]);

  useEffect(() => {
    const leadId = chatLeadId(selectedChat);
    if (!selectedChat || chatTelegramId(selectedChat) || !leadId) return;
    void api<{ connectLink: string | null }>(`/api/chats/lead/${leadId}/connect-link`).then((data) => setConnectLink(data.connectLink));
  }, [selectedChat]);

  const sendMessage = async () => {
    if (!selectedId || (!text.trim() && !file)) return;
    setIsSending(true);
    setError("");
    try {
      const payload: any = { text: text.trim() };
      if (file) {
        payload.file = {
          name: file.name,
          type: file.type,
          dataBase64: await fileToBase64(file),
        };
      }
      await api(`/api/chats/${selectedId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      setText("");
      setFile(null);
      await loadMessages(selectedId);
      await loadChats();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Сообщение не отправлено");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 bg-background">
      <aside className="flex h-full w-80 shrink-0 flex-col border-r bg-card">
        <div className="flex h-14 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2 font-semibold">
            <MessageCircle className="h-4 w-4" />
            Чаты
          </div>
          <Button variant="ghost" size="icon" onClick={() => void loadChats()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {chats.map((chat) => (
            <button
              key={chat.id}
              type="button"
              onClick={() => setSelectedId(chat.id)}
              className={cn(
                "flex w-full flex-col gap-1 border-b px-4 py-3 text-left hover:bg-muted/60",
                selectedId === chat.id && "bg-muted",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{chatName(chat)}</span>
                <span className={cn("rounded px-1.5 py-0.5 text-[10px] uppercase", chatTelegramId(chat) ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                  {chatTelegramId(chat) ? "active" : "wait"}
                </span>
              </div>
              <div className="truncate text-sm text-muted-foreground">{lastText(chat)}</div>
              <div className="text-xs text-muted-foreground">{chat.manager_name ?? ""}</div>
            </button>
          ))}
          {chats.length === 0 && <div className="p-6 text-sm text-muted-foreground">Чатов пока нет</div>}
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        {selectedChat ? (
          <>
            <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-4">
              <div className="min-w-0">
                <div className="truncate font-semibold">{chatName(selectedChat)}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {selectedChat.telegramUsername ?? selectedChat.telegram_username ? `@${selectedChat.telegramUsername ?? selectedChat.telegram_username}` : "Telegram не подключен"}
                </div>
              </div>
              {chatLeadId(selectedChat) && (
                <Button variant="outline" size="sm" onClick={() => navigate(`/leads?id=${chatLeadId(selectedChat)}`)}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Открыть заявку
                </Button>
              )}
            </header>

            {!chatTelegramId(selectedChat) && (
              <div className="border-b bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Клиент еще не подключил бота. Отправьте ему ссылку:
                <span className="ml-2 select-all font-mono">{connectLink ?? "ссылка недоступна"}</span>
              </div>
            )}

            <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-muted/20 p-4">
              {messages.map((message) => {
                const outgoing = message.direction === "outgoing";
                return (
                  <div key={message.id} className={cn("flex", outgoing ? "justify-end" : "justify-start")}>
                    <div className={cn("max-w-[70%] rounded-lg border px-3 py-2 text-sm shadow-sm", outgoing ? "bg-primary text-primary-foreground" : "bg-card")}>
                      {message.text && <div className="whitespace-pre-wrap">{message.text}</div>}
                      {(message.attachmentName ?? message.attachment_name) && (
                        <div className="mt-1 flex items-center gap-1 text-xs opacity-80">
                          <Paperclip className="h-3 w-3" />
                          {message.attachmentName ?? message.attachment_name}
                        </div>
                      )}
                      <div className="mt-1 text-right text-[10px] opacity-70">
                        {messageDate(message) ? new Date(messageDate(message)).toLocaleString("ru-RU") : ""}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <footer className="shrink-0 border-t bg-card p-3">
              {error && <div className="mb-2 rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
              {file && <div className="mb-2 text-xs text-muted-foreground">Файл: {file.name}</div>}
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="icon" onClick={() => setText((value) => `${value} 🙂`)}>
                  <Smile className="h-4 w-4" />
                </Button>
                <label className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border bg-background hover:bg-muted">
                  <FileUp className="h-4 w-4" />
                  <input type="file" className="hidden" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
                </label>
                <Input
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void sendMessage();
                    }
                  }}
                  placeholder="Написать сообщение"
                  disabled={!chatTelegramId(selectedChat)}
                />
                <Button onClick={() => void sendMessage()} disabled={isSending || !chatTelegramId(selectedChat) || (!text.trim() && !file)}>
                  <Send className="mr-2 h-4 w-4" />
                  Отправить
                </Button>
              </div>
            </footer>
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">Выберите чат</div>
        )}
      </section>
    </div>
  );
}
