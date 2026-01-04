
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

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isTyping) return;

    const userMessage: Message = {
      role: 'user',
      text: inputText,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    const originalInput = inputText;
    setInputText('');
    setIsTyping(true);

    let streamStarted = false;

    try {
      const stream = geminiService.sendMessageStream(userMessage.text);
      let fullResponseText = '';

      for await (const chunk of stream) {
        if (!streamStarted) {
          streamStarted = true;
          // Add the model message placeholder only when we actually get data
          setMessages(prev => [...prev, {
            role: 'model',
            text: '',
            timestamp: Date.now()
          }]);
        }

        fullResponseText += chunk;
        setMessages(prev => {
          const newHistory = [...prev];
          const lastMsg = newHistory[newHistory.length - 1];
          if (lastMsg && lastMsg.role === 'model') {
            lastMsg.text = fullResponseText;
          }
          return newHistory;
        });
      }
    } catch (error: any) {
      console.error("Chat error:", error);
      
      // Remove placeholder if it was added but empty
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'model' && last.text === '') {
          return prev.slice(0, -1);
        }
        return prev;
      });

      const errorMessage = error.message?.includes('403') || error.message?.includes('API_KEY') 
        ? "Ошибка доступа: проверьте API-ключ."
        : `Ошибка: ${error.message || "не удалось получить ответ"}`;

      setMessages(prev => [...prev, {
        role: 'model',
        text: `⚠️ ${errorMessage}`,
        timestamp: Date.now()
      }]);
      
      // Restore input text so user doesn't lose it
      setInputText(originalInput);
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

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto overflow-hidden bg-slate-50 relative">
      <header className="px-6 py-4 glass z-20 border-b border-slate-200 shrink-0">
        <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">
          Привет, <span className="text-indigo-600">{userName}</span>!
        </h1>
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
        {isTyping && !messages[messages.length-1]?.text && messages[messages.length-1]?.role === 'model' && (
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
            placeholder={`Напиши ${currentPersonality.name.toLowerCase()}у...`}
            className="flex-1 bg-slate-100 border-none rounded-full px-5 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            disabled={isTyping}
          />
          <button 
            type="submit"
            disabled={!inputText.trim() || isTyping}
            className={`p-3 rounded-full transition-all flex items-center justify-center ${
              !inputText.trim() || isTyping 
              ? 'bg-slate-200 text-slate-400' 
              : 'bg-indigo-600 text-white hover:scale-105 active:scale-95 shadow-md shadow-indigo-200'
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
