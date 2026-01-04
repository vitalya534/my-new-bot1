
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
  const [userName, setUserName] = useState('Друг');
  const [apiKeyStatus, setApiKeyStatus] = useState<'checking' | 'missing' | 'ready'>('checking');
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initializing Telegram WebApp
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      if (tg.initDataUnsafe?.user?.first_name) {
        setUserName(tg.initDataUnsafe.user.first_name);
      }
    }
    
    // Check API Key status
    const checkKey = async () => {
      if (window.aistudio) {
        try {
          const hasKey = await window.aistudio.hasSelectedApiKey();
          setApiKeyStatus(hasKey ? 'ready' : 'missing');
        } catch (e) {
          console.error("Key check failed", e);
          setApiKeyStatus('missing');
        }
      } else {
        // Fallback for non-AI Studio environments (where process.env might be set)
        setApiKeyStatus(process.env.API_KEY ? 'ready' : 'missing');
      }
    };
    checkKey();
  }, []);

  // Update system prompt and set welcome message when personality changes
  useEffect(() => {
    if (apiKeyStatus !== 'ready') return;
    
    geminiService.initChat(currentPersonality.instruction);
    const welcomeMsg: Message = {
      role: 'model',
      text: `Привет, ${userName}! Теперь я в режиме "${currentPersonality.name}". О чем поболтаем?`,
      timestamp: Date.now()
    };
    setMessages([welcomeMsg]);
  }, [currentPersonality, userName, apiKeyStatus]);

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
      console.error("Streaming failed:", error);
      const isAuthError = error.message === "AUTH_ERROR" || error.message === "MISSING_API_KEY";
      
      if (isAuthError) setApiKeyStatus('missing');

      setMessages(prev => [...prev, {
        role: 'model',
        text: isAuthError 
          ? "⚠️ Похоже, возникла проблема с API-ключом. Пожалуйста, настройте его заново." 
          : "⚠️ Ой! Произошла ошибка. Попробуй отправить сообщение еще раз.",
        timestamp: Date.now()
      }]);
      setInputText(currentInput);
    } finally {
      setIsTyping(false);
    }
  };

  if (apiKeyStatus === 'checking') {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 gap-4">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
        <p className="text-slate-500 font-medium animate-pulse">Загрузка...</p>
      </div>
    );
  }

  if (apiKeyStatus === 'missing') {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-white p-8 text-center animate-fade-in">
        <div className="text-6xl mb-6">🔑</div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Настройка API Ключа</h2>
        <p className="text-slate-500 mb-8 max-w-xs">
          Для общения с Gemini необходимо выбрать активный платный проект в Google AI Studio.
        </p>
        <button 
          onClick={handleSetupKey}
          className="w-full max-w-xs bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-100 active:scale-95 transition-transform"
        >
          Настроить API Ключ
        </button>
        <a 
          href="https://ai.google.dev/gemini-api/docs/billing" 
          target="_blank" 
          className="mt-6 text-sm text-indigo-500 underline"
        >
          Как это работает?
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 relative overflow-hidden animate-fade-in">
      {/* Header */}
      <header className="px-5 py-3 glass z-30 shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800 leading-tight">
            Чат с <span className="text-indigo-600">{userName}</span>
          </h1>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Gemini 3 Flash</span>
          </div>
        </div>
        <button 
          onClick={() => setApiKeyStatus('missing')}
          className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
          title="Настройки ключа"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
        </button>
      </header>

      {/* Personality Selection */}
      <div className="px-4 py-4 personality-grid bg-slate-50/80 backdrop-blur-sm z-20 border-b border-slate-100 shrink-0">
        {PERSONALITIES.map(p => (
          <PersonalityCard 
            key={p.id} 
            personality={p} 
            isActive={currentPersonality.id === p.id}
            onClick={() => setCurrentPersonality(p)}
          />
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 hide-scrollbar">
        {messages.map((msg, i) => <ChatMessage key={`${msg.timestamp}-${i}`} message={msg} />)}
        
        {isTyping && (!messages[messages.length-1]?.text) && (
          <div className="flex justify-start mb-6 animate-fade-in">
            <div className="bg-white px-5 py-3 rounded-2xl rounded-tl-none border border-slate-100 shadow-sm">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <footer className="p-4 glass border-t border-slate-100 z-30 shrink-0 pb-safe">
        <form onSubmit={handleSendMessage} className="flex gap-3">
          <input 
            type="text"
            className="flex-1 bg-white border border-slate-200 rounded-2xl px-5 py-3.5 text-sm font-medium shadow-inner focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50/50 transition-all"
            placeholder="Спроси о чем-нибудь..."
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            disabled={isTyping}
          />
          <button 
            type="submit"
            disabled={!inputText.trim() || isTyping}
            className={`p-4 rounded-2xl transition-all active:scale-90 flex items-center justify-center ${
              !inputText.trim() || isTyping 
                ? 'bg-slate-100 text-slate-300' 
                : 'bg-indigo-600 text-white shadow-xl shadow-indigo-200 hover:bg-indigo-700'
            }`}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </form>
      </footer>
    </div>
  );
};

export default App;
