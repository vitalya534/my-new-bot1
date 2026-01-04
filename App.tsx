
import React, { useState, useEffect, useRef } from 'react';
import { PERSONALITIES } from './constants';
import { Message, Personality } from './types';
import ChatMessage from './components/ChatMessage';
import { geminiService } from './services/geminiService';
import { deepseekService } from './services/deepseekService';

declare global {
  interface Window {
    Telegram?: any;
  }
}

type EngineType = 'gemini' | 'deepseek';

const App: React.FC = () => {
  // Устанавливаем Gemini как основной движок по умолчанию
  const [engine, setEngine] = useState<EngineType>('gemini');
  const [currentPersonality, setCurrentPersonality] = useState<Personality>(PERSONALITIES[0]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      tg.setHeaderColor('#0d1117');
    }
  }, []);

  // Инициализация чата при смене режима или движка
  useEffect(() => {
    const engineName = engine === 'gemini' ? 'Gemini 3 Pro' : 'DeepSeek V3';
    setMessages([{
      role: 'assistant',
      text: `Привет! Я твой продвинутый ассистент. Сейчас я использую движок **${engineName}** в режиме **${currentPersonality.name}**. Чем могу помочь?`,
      timestamp: Date.now()
    }]);
    setError(null);
  }, [currentPersonality, engine]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isTyping) return;

    setError(null);
    const userMessage: Message = {
      role: 'user',
      text: inputText,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputText;
    setInputText('');
    setIsTyping(true);

    const history = messages
      .filter(m => m.timestamp > 0)
      .slice(-10) 
      .map(m => ({
        role: m.role,
        content: m.text
      }));

    try {
      const activeService = engine === 'gemini' ? geminiService : deepseekService;
      const stream = activeService.sendMessageStream(
        userMessage.text, 
        history, 
        currentPersonality.instruction
      );
      
      let streamStarted = false;
      let fullText = '';
      let fullReasoning = '';

      for await (const chunk of (stream as any)) {
        if (!streamStarted) {
          streamStarted = true;
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            text: '', 
            reasoning: '', 
            timestamp: Date.now() 
          }]);
        }
        
        if (chunk.type === 'reasoning') {
          fullReasoning += chunk.content;
        } else {
          fullText += chunk.content;
        }

        setMessages(prev => {
          const newMessages = [...prev];
          const last = newMessages[newMessages.length - 1];
          if (last && last.role === 'assistant') {
            last.text = fullText;
            last.reasoning = fullReasoning;
          }
          return newMessages;
        });
      }
    } catch (err: any) {
      console.error("Chat Error:", err);
      const errorMessage = err.message || "Произошла ошибка при запросе к API.";
      setError(errorMessage);
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: `**Ошибка:** ${errorMessage}`,
        timestamp: Date.now()
      }]);
      setInputText(currentInput);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#0d1117] text-slate-200 font-sans">
      {/* Header */}
      <header className="px-5 py-3 bg-[#161b22]/90 backdrop-blur-md border-b border-[#30363d] flex items-center justify-between z-50">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transition-all border ${engine === 'gemini' ? 'bg-indigo-600 border-indigo-400' : 'bg-slate-700 border-slate-500'}`}>
             <span className="text-white text-xl font-black">{engine === 'gemini' ? 'G' : 'D'}</span>
          </div>
          <div>
            <h1 className="text-sm font-black uppercase tracking-wider text-white">
              {engine === 'gemini' ? 'Gemini 3 Pro' : 'DeepSeek V3'}
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`w-2 h-2 rounded-full ${isTyping ? 'bg-indigo-500 animate-pulse' : 'bg-green-500'}`}></span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {isTyping ? 'Thinking...' : 'Ready'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex bg-black/40 rounded-lg p-1 border border-[#30363d]">
          <button 
            onClick={() => setEngine('gemini')}
            className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${engine === 'gemini' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Gemini
          </button>
          <button 
            onClick={() => setEngine('deepseek')}
            className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${engine === 'deepseek' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
          >
            DeepSeek
          </button>
        </div>
      </header>

      {/* Warning if error exists */}
      {error && (
        <div className="bg-red-500/10 border-b border-red-500/30 p-2 text-center">
          <p className="text-[10px] text-red-400 font-bold uppercase tracking-widest">
            {error.includes('API_KEY') ? 'ВНИМАНИЕ: API_KEY НЕ НАЙДЕН В ПЕРЕМЕННЫХ ОКРУЖЕНИЯ VERCEL.' : error}
          </p>
        </div>
      )}

      {/* Personality Selector */}
      <div className="flex gap-2 p-3 bg-[#0d1117] border-b border-[#30363d] overflow-x-auto hide-scrollbar shrink-0">
        {PERSONALITIES.map(p => (
          <button
            key={p.id}
            onClick={() => setCurrentPersonality(p)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl transition-all border text-[11px] font-bold uppercase tracking-wider flex items-center gap-2 ${
              currentPersonality.id === p.id 
                ? 'bg-indigo-600/20 border-indigo-500 text-indigo-100' 
                : 'bg-slate-900/40 border-[#30363d] text-slate-500 hover:border-slate-500'
            }`}
          >
            <span>{p.emoji}</span>
            <span>{p.name}</span>
          </button>
        ))}
      </div>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto px-4 py-6 space-y-6 hide-scrollbar">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center opacity-20 grayscale">
             <div className="text-6xl mb-4">🤖</div>
             <p className="text-sm font-bold uppercase tracking-[0.3em]">Waiting for input</p>
          </div>
        )}
        {messages.map((msg, i) => <ChatMessage key={i} message={msg} />)}
        <div ref={chatEndRef} />
      </main>

      {/* Input Area */}
      <footer className="p-4 bg-[#161b22]/80 backdrop-blur-lg border-t border-[#30363d] pb-safe">
        <form onSubmit={handleSendMessage} className="flex gap-3 max-w-5xl mx-auto items-end">
          <div className="flex-1 relative">
            <textarea 
              rows={1}
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-2xl px-5 py-4 text-[15px] text-white placeholder-slate-600 transition-all outline-none resize-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20"
              placeholder="Напишите сообщение..."
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              disabled={isTyping}
            />
          </div>
          <button 
            type="submit"
            disabled={!inputText.trim() || isTyping}
            className={`w-14 h-14 shrink-0 rounded-2xl text-white flex items-center justify-center disabled:opacity-20 transition-all hover:scale-105 active:scale-95 shadow-xl ${engine === 'gemini' ? 'bg-indigo-600 shadow-indigo-500/20' : 'bg-slate-600 shadow-slate-500/20'}`}
          >
            <svg className="w-6 h-6 transform rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
      </footer>
    </div>
  );
};

export default App;
