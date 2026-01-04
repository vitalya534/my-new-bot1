
import React, { useState, useEffect, useRef } from 'react';
import { PERSONALITIES } from './constants';
import { Message, Personality } from './types';
import PersonalityCard from './components/PersonalityCard';
import ChatMessage from './components/ChatMessage';
import { geminiService } from './services/geminiService';

declare global {
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
  const [userName, setUserName] = useState('Пользователь');
  const [apiKeyStatus, setApiKeyStatus] = useState<'checking' | 'missing' | 'ready'>('checking');
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      if (tg.initDataUnsafe?.user?.first_name) {
        setUserName(tg.initDataUnsafe.user.first_name);
      }
    }
    
    const checkKey = async () => {
      if (window.aistudio) {
        try {
          const hasKey = await window.aistudio.hasSelectedApiKey();
          setApiKeyStatus(hasKey ? 'ready' : 'missing');
        } catch (e) {
          setApiKeyStatus('missing');
        }
      } else {
        setApiKeyStatus(process.env.API_KEY ? 'ready' : 'missing');
      }
    };
    checkKey();
  }, []);

  useEffect(() => {
    if (apiKeyStatus !== 'ready') return;
    
    geminiService.initChat(currentPersonality.instruction);
    const welcomeMsg: Message = {
      role: 'model',
      text: `Система Reasoning активна. Движок: Deep-Think (Gemini 3 Pro). Режим: ${currentPersonality.name}. Готов к глубокому анализу.`,
      timestamp: Date.now()
    };
    setMessages([welcomeMsg]);
  }, [currentPersonality, apiKeyStatus]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSetupKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setApiKeyStatus('ready');
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isTyping || apiKeyStatus !== 'ready') return;

    const userMessage: Message = {
      role: 'user',
      text: inputText,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputText;
    setInputText('');
    setIsTyping(true);

    const history = messages.slice(1).map(m => ({
      role: m.role,
      parts: [{ text: String(m.text) }]
    }));

    try {
      const stream = geminiService.sendMessageStream(userMessage.text, history);
      let streamStarted = false;
      let fullResponseText = '';

      for await (const chunk of stream) {
        if (!streamStarted) {
          streamStarted = true;
          setMessages(prev => [...prev, { role: 'model', text: '', timestamp: Date.now() }]);
        }
        
        fullResponseText += chunk;
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last && last.role === 'model') {
            last.text = fullResponseText;
          }
          return updated;
        });
      }
    } catch (error: any) {
      const isAuthError = error.message === "AUTH_ERROR" || error.message === "MISSING_API_KEY";
      if (isAuthError) setApiKeyStatus('missing');

      setMessages(prev => [...prev, {
        role: 'model',
        text: isAuthError 
          ? "⚠️ Требуется обновление API-ключа для доступа к Reasoning Engine." 
          : "⚠️ Критическая ошибка анализа. Повторите попытку.",
        timestamp: Date.now()
      }]);
      setInputText(currentInput);
    } finally {
      setIsTyping(false);
    }
  };

  if (apiKeyStatus === 'checking') {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-900 gap-4">
        <div className="w-12 h-12 border-4 border-slate-700 border-t-cyan-500 rounded-full animate-spin"></div>
        <p className="text-slate-400 font-mono text-sm tracking-widest uppercase animate-pulse">Initializing Deep-Think...</p>
      </div>
    );
  }

  if (apiKeyStatus === 'missing') {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-900 p-8 text-center animate-fade-in">
        <div className="text-6xl mb-6 drop-shadow-[0_0_15px_rgba(6,182,212,0.5)]">💎</div>
        <h2 className="text-2xl font-bold text-white mb-2">DeepSeek-Style Reasoning</h2>
        <p className="text-slate-400 mb-8 max-w-xs font-light">
          Для работы мощного интеллекта с глубоким размышлением требуется подключение API ключа.
        </p>
        <button 
          onClick={handleSetupKey}
          className="w-full max-w-xs bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-cyan-900/40 active:scale-95 transition-all"
        >
          АКТИВИРОВАТЬ ДВИЖОК
        </button>
        <a 
          href="https://ai.google.dev/gemini-api/docs/billing" 
          target="_blank" 
          className="mt-6 text-xs text-slate-500 hover:text-cyan-400 underline transition-colors"
        >
          Инструкция по биллингу (Google AI Studio)
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-slate-950 relative overflow-hidden animate-fade-in font-sans">
      <header className="px-5 py-4 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 z-30 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500 flex items-center justify-center shadow-[0_0_10px_rgba(6,182,212,0.4)]">
             <span className="text-white text-xs font-black">DS</span>
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-tight uppercase tracking-wider">
              Reasoning <span className="text-cyan-400">Engine</span>
            </h1>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_5px_rgba(34,197,94,0.6)]"></span>
              <span className="text-[9px] text-slate-400 uppercase font-black">Connected to DeepThink R1</span>
            </div>
          </div>
        </div>
        <button 
          onClick={() => setApiKeyStatus('missing')}
          className="p-2 text-slate-500 hover:text-cyan-400 transition-colors bg-slate-800 rounded-lg"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
        </button>
      </header>

      <div className="px-4 py-4 personality-grid bg-slate-950/50 backdrop-blur-sm z-20 border-b border-slate-900 shrink-0">
        {PERSONALITIES.map(p => (
          <PersonalityCard 
            key={p.id} 
            personality={p} 
            isActive={currentPersonality.id === p.id}
            onClick={() => setCurrentPersonality(p)}
          />
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 hide-scrollbar bg-[radial-gradient(circle_at_50%_50%,rgba(6,182,212,0.05),transparent)]">
        {messages.map((msg, i) => <ChatMessage key={`${msg.timestamp}-${i}`} message={msg} />)}
        
        {isTyping && (!messages[messages.length-1]?.text) && (
          <div className="flex justify-start mb-6 animate-fade-in">
            <div className="bg-slate-900 px-5 py-4 rounded-2xl rounded-tl-none border border-slate-800 shadow-xl flex flex-col gap-2 min-w-[200px]">
              <div className="flex items-center gap-2">
                 <div className="w-2 h-2 bg-cyan-500 rounded-full animate-ping"></div>
                 <div className="text-[10px] text-cyan-400 font-black uppercase tracking-widest">Chain-of-thought analysis...</div>
              </div>
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-slate-700 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-slate-700 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-1.5 h-1.5 bg-slate-700 rounded-full animate-bounce [animation-delay:0.4s]"></div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={chatEndRef} />
      </div>

      <footer className="p-4 bg-slate-900 border-t border-slate-800 z-30 shrink-0 pb-safe">
        <form onSubmit={handleSendMessage} className="flex gap-3">
          <input 
            type="text"
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-5 py-4 text-sm font-medium text-white placeholder-slate-600 shadow-inner focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-all outline-none"
            placeholder="Введите запрос для глубокого анализа..."
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            disabled={isTyping}
          />
          <button 
            type="submit"
            disabled={!inputText.trim() || isTyping}
            className={`p-4 rounded-xl transition-all active:scale-90 flex items-center justify-center ${
              !inputText.trim() || isTyping 
                ? 'bg-slate-800 text-slate-600' 
                : 'bg-cyan-600 text-white shadow-lg shadow-cyan-900/20 hover:bg-cyan-500'
            }`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </form>
      </footer>
    </div>
  );
};

export default App;
