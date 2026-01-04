
import React, { useState, useEffect, useRef } from 'react';
import { PERSONALITIES } from './constants';
import { Message, Personality } from './types';
import PersonalityCard from './components/PersonalityCard';
import ChatMessage from './components/ChatMessage';
import { geminiService } from './services/geminiService';

declare global {
  // Define AIStudio interface to match existing global expectations
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    Telegram?: any;
    aistudio?: AIStudio;
  }
}

const App: React.FC = () => {
  const [currentPersonality, setCurrentPersonality] = useState<Personality>(PERSONALITIES[0]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [userName, setUserName] = useState('Друг');
  const [needsKey, setNeedsKey] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      if (tg.initDataUnsafe?.user) {
        setUserName(tg.initDataUnsafe.user.first_name);
      }
    }
    
    // Check key status on mount
    const checkKey = async () => {
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setNeedsKey(!hasKey);
      }
    };
    checkKey();
  }, []);

  useEffect(() => {
    geminiService.initChat(currentPersonality.instruction);
    const welcomeMsg: Message = {
      role: 'model',
      text: `Привет, ${userName}! Теперь я в режиме "${currentPersonality.name}". О чем поболтаем?`,
      timestamp: Date.now()
    };
    setMessages([welcomeMsg]);
  }, [currentPersonality, userName]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleOpenKeyDialog = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setNeedsKey(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isTyping) return;

    const userMessage: Message = {
      role: 'user',
      text: inputText,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputText;
    setInputText('');
    setIsTyping(true);

    // Prepare history for stateless stream re-init if needed
    const history = messages.slice(1).map(m => ({
      role: m.role,
      parts: [{ text: m.text }]
    }));

    try {
      const stream = geminiService.sendMessageStream(userMessage.text, history);
      let streamStarted = false;
      let fullText = '';

      for await (const chunk of stream) {
        if (!streamStarted) {
          streamStarted = true;
          setMessages(prev => [...prev, { role: 'model', text: '', timestamp: Date.now() }]);
        }
        
        fullText += chunk;
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last && last.role === 'model') last.text = fullText;
          return updated;
        });
      }
    } catch (error: any) {
      console.error("Chat failure:", error);
      if (error.message === "AUTH_ERROR" || error.message === "MISSING_API_KEY") {
        setNeedsKey(true);
      }
      
      setMessages(prev => [...prev, {
        role: 'model',
        text: error.message === "AUTH_ERROR" 
          ? "⚠️ Требуется настроить API-ключ. Нажмите кнопку ниже." 
          : "⚠️ Что-то пошло не так. Пожалуйста, попробуйте еще раз.",
        timestamp: Date.now()
      }]);
      setInputText(currentInput);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 relative overflow-hidden">
      <header className="px-5 py-3 glass z-30 shrink-0">
        <h1 className="text-lg font-bold text-slate-800">
          Чат с <span className="text-indigo-600">{userName}</span>
        </h1>
        <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Gemini 3 Flash</p>
      </header>

      <div className="px-4 py-3 grid grid-cols-2 gap-2 bg-slate-50/50 backdrop-blur-sm z-20 border-b border-slate-100 shrink-0">
        {PERSONALITIES.map(p => (
          <PersonalityCard 
            key={p.id} 
            personality={p} 
            isActive={currentPersonality.id === p.id}
            onClick={() => setCurrentPersonality(p)}
          />
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 hide-scrollbar">
        {messages.map((msg, i) => <ChatMessage key={msg.timestamp + i} message={msg} />)}
        
        {isTyping && !messages[messages.length-1]?.text && messages[messages.length-1]?.role === 'model' && (
          <div className="flex justify-start mb-4 animate-pulse">
            <div className="bg-white px-4 py-2 rounded-2xl rounded-tl-none border border-slate-100 text-slate-400 text-xs">
              Печатает...
            </div>
          </div>
        )}
        
        {needsKey && (
          <div className="flex flex-col items-center justify-center p-6 bg-amber-50 rounded-2xl border border-amber-100 my-4 gap-3 text-center">
            <p className="text-xs text-amber-800 font-medium">Для работы приложения нужно выбрать платный проект в Google AI Studio</p>
            <button 
              onClick={handleOpenKeyDialog}
              className="bg-amber-600 text-white px-4 py-2 rounded-full text-xs font-bold hover:bg-amber-700 transition-colors shadow-sm"
            >
              Настроить API Ключ
            </button>
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="text-[10px] text-amber-600 underline">Подробнее о биллинге</a>
          </div>
        )}
        
        <div ref={chatEndRef} />
      </div>

      <footer className="p-4 glass border-t border-slate-100 z-30 shrink-0">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input 
            type="text"
            className="flex-1 bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:border-indigo-500 transition-colors"
            placeholder="Сообщение..."
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            disabled={isTyping}
          />
          <button 
            type="submit"
            disabled={!inputText.trim() || isTyping}
            className={`p-3 rounded-2xl transition-transform active:scale-90 ${
              !inputText.trim() || isTyping ? 'bg-slate-200 text-slate-400' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
            }`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </form>
      </footer>
    </div>
  );
};

export default App;
