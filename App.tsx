
import React, { useState, useEffect, useRef } from 'react';
import { PERSONALITIES } from './constants';
import { Message, Personality } from './types';
import PersonalityCard from './components/PersonalityCard';
import ChatMessage from './components/ChatMessage';
import { geminiService } from './services/geminiService';

declare global {
  interface Window {
    Telegram?: any;
  }
}

const App: React.FC = () => {
  const [currentPersonality, setCurrentPersonality] = useState<Personality>(PERSONALITIES[0]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [userName, setUserName] = useState('Друг');
  const [hasApiKey, setHasApiKey] = useState(true);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check for API key availability
    if (!process.env.API_KEY) {
      console.warn("Warning: API_KEY is missing from environment.");
      setHasApiKey(false);
    }

    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      if (tg.initDataUnsafe?.user) {
        setUserName(tg.initDataUnsafe.user.first_name);
      }
    }
  }, []);

  useEffect(() => {
    try {
      geminiService.initChat(currentPersonality.instruction);
      const welcomeMsg: Message = {
        role: 'model',
        text: `Привет, ${userName}! Теперь я в режиме "${currentPersonality.name}". О чем поболтаем?`,
        timestamp: Date.now()
      };
      setMessages([welcomeMsg]);
    } catch (e) {
      console.error("Chat init failed", e);
    }
  }, [currentPersonality, userName]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isTyping) return;

    const userMessage: Message = {
      role: 'user',
      text: inputText,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    try {
      let fullResponseText = '';
      const modelMessage: Message = {
        role: 'model',
        text: '',
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, modelMessage]);

      const stream = geminiService.sendMessageStream(userMessage.text);
      
      for await (const chunk of stream) {
        if (chunk) {
          fullResponseText += chunk;
          setMessages(prev => {
            const newHistory = [...prev];
            newHistory[newHistory.length - 1].text = fullResponseText;
            return newHistory;
          });
        }
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      setMessages(prev => [...prev, {
        role: 'model',
        text: "Ой, что-то пошло не так. Попробуй еще раз!",
        timestamp: Date.now()
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handlePersonalityChange = (personality: Personality) => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
    }
    setCurrentPersonality(personality);
  };

  if (!hasApiKey) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-6 text-center bg-white text-slate-900">
        <div className="text-6xl mb-4">🔑</div>
        <h2 className="text-xl font-bold mb-2">API Ключ не найден</h2>
        <p className="text-slate-500 text-sm mb-6">Пожалуйста, убедитесь, что API_KEY настроен в переменных окружения вашего проекта.</p>
        <button onClick={() => window.location.reload()} className="bg-slate-900 text-white px-6 py-2 rounded-full font-medium">Попробовать снова</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto overflow-hidden bg-slate-50 relative">
      <header className="px-6 py-4 glass z-20 border-b border-slate-200 shrink-0">
        <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">
          Привет, <span className="text-indigo-600">{userName}</span>!
        </h1>
        <p className="text-xs text-slate-500 font-medium">Выбери мой стиль общения:</p>
      </header>

      <div className="p-4 grid grid-cols-2 gap-3 z-10 shrink-0 bg-slate-50/80 backdrop-blur-sm">
        {PERSONALITIES.map(p => (
          <PersonalityCard 
            key={p.id} 
            personality={p} 
            isActive={currentPersonality.id === p.id}
            onClick={() => handlePersonalityChange(p)}
          />
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 hide-scrollbar bg-slate-50">
        {messages.map((msg, idx) => (
          <ChatMessage key={idx} message={msg} />
        ))}
        {isTyping && (
          <div className="flex justify-start mb-4">
            <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.4s]"></div>
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="p-4 glass border-t border-slate-200 sticky bottom-0 shrink-0">
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <input 
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={`Спроси у ${currentPersonality.name.toLowerCase()}а...`}
            className="flex-1 bg-slate-100 border-none rounded-full px-5 py-3 text-sm focus:ring-2 focus:ring-slate-900 outline-none transition-all"
            disabled={isTyping}
          />
          <button 
            type="submit"
            disabled={!inputText.trim() || isTyping}
            className={`p-3 rounded-full transition-all flex items-center justify-center ${
              !inputText.trim() || isTyping 
              ? 'bg-slate-200 text-slate-400' 
              : 'bg-slate-900 text-white hover:scale-105 active:scale-95'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
};

export default App;
