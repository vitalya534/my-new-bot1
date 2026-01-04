
import React, { useState, useEffect, useRef } from 'react';
import { PERSONALITIES } from './constants';
import { Message, Personality } from './types';
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

  useEffect(() => {
    setMessages([{
      role: 'assistant',
      text: `Система активна. Движок: **Gemini 3 Pro** (Advanced Reasoning). Режим: **${currentPersonality.name}**. Чем могу помочь?`,
      timestamp: Date.now()
    }]);
    setError(null);
  }, [currentPersonality]);

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
      .filter(m => m.timestamp > 0 && !m.text.includes('Ошибка')) 
      .slice(-10) 
      .map(m => ({
        role: m.role,
        content: m.text
      }));

    try {
      const stream = geminiService.sendMessageStream(
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
      console.error("API Error:", err);
      const errorMessage = err.message || "Ошибка соединения с сервером.";
      setError(errorMessage);
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: `**Ошибка:** ${errorMessage}. Пожалуйста, проверьте настройки подключения.`,
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
      <header className="px-5 py-4 bg-[#161b22]/95 backdrop-blur-md border-b border-[#30363d] flex items-center justify-between z-50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-[0_0_15px_rgba(79,70,229,0.4)]">
             <span className="text-white text-xl font-black">G</span>
          </div>
          <div>
            <h1 className="text-base font-black uppercase tracking-widest text-white leading-none">
              Gemini 3 Pro
            </h1>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className={`w-2 h-2 rounded-full ${isTyping ? 'bg-indigo-400 animate-pulse' : 'bg-green-500'}`}></span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                {isTyping ? 'Анализ данных...' : 'Система готова'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Personality Selector */}
      <div className="flex gap-2 p-3 bg-[#0d1117] border-b border-[#30363d] overflow-x-auto hide-scrollbar shrink-0">
        {PERSONALITIES.map(p => (
          <button
            key={p.id}
            onClick={() => setCurrentPersonality(p)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl transition-all border text-[11px] font-bold uppercase tracking-wider flex items-center gap-2 ${
              currentPersonality.id === p.id 
                ? 'bg-indigo-600/20 border-indigo-500 text-indigo-100 shadow-[0_0_10px_rgba(79,70,229,0.1)]' 
                : 'bg-slate-900/40 border-[#30363d] text-slate-500 hover:border-slate-600'
            }`}
          >
            <span className="text-lg leading-none">{p.emoji}</span>
            <span>{p.name}</span>
          </button>
        ))}
      </div>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto px-4 py-6 space-y-6 hide-scrollbar">
        {messages.map((msg, i) => <ChatMessage key={i} message={msg} />)}
        <div ref={chatEndRef} />
      </main>

      {/* Input Area */}
      <footer className="p-4 bg-[#161b22]/90 backdrop-blur-lg border-t border-[#30363d] pb-safe">
        <form onSubmit={handleSendMessage} className="flex gap-3 max-w-5xl mx-auto items-end">
          <div className="flex-1 relative">
            <textarea 
              rows={1}
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-2xl px-5 py-4 text-[15px] text-white placeholder-slate-600 transition-all outline-none resize-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/10 shadow-inner"
              placeholder="Спросите о чем угодно..."
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
            className="w-14 h-14 shrink-0 rounded-2xl bg-indigo-600 text-white flex items-center justify-center disabled:opacity-20 transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(79,70,229,0.3)]"
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
