
import React, { useState, useEffect, useRef } from 'react';
import { PERSONALITIES } from './constants';
import { Message, Personality } from './types';
import ChatMessage from './components/ChatMessage';
import { deepseekService } from './services/deepseekService';

declare global {
  interface Window {
    Telegram?: any;
    process?: any;
  }
}

const App: React.FC = () => {
  const [currentPersonality, setCurrentPersonality] = useState<Personality>(PERSONALITIES[0]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
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
      text: `DeepSeek-R1 активен. Режим: ${currentPersonality.name}. Чем я могу помочь сегодня?`,
      timestamp: Date.now()
    }]);
  }, [currentPersonality]);

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
      const stream = deepseekService.sendMessageStream(
        userMessage.text, 
        history, 
        currentPersonality.instruction
      );
      
      let streamStarted = false;
      let fullText = '';
      let fullReasoning = '';

      for await (const chunk of stream) {
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
    } catch (error: any) {
      console.error("DeepSeek Error:", error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: `Ошибка API: ${error.message}. Убедитесь, что ваш ключ API от DeepSeek корректен.`,
        timestamp: Date.now()
      }]);
      setInputText(currentInput);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#0d1117] text-slate-200 font-sans">
      <header className="px-5 py-3.5 bg-[#161b22]/95 backdrop-blur-md border-b border-[#30363d] flex items-center justify-between z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#4D6BFE] flex items-center justify-center shadow-[0_0_20px_rgba(77,107,254,0.3)]">
             <span className="text-white text-xl font-black italic">D</span>
          </div>
          <div>
            <h1 className="text-sm font-black uppercase tracking-[0.2em] text-white">
              DeepSeek <span className="text-[#4D6BFE]">R1</span>
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Reasoning Active</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex gap-2 p-3 bg-[#0d1117] border-b border-[#30363d] overflow-x-auto hide-scrollbar shrink-0">
        {PERSONALITIES.map(p => (
          <button
            key={p.id}
            onClick={() => setCurrentPersonality(p)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl transition-all border text-[10px] font-black uppercase tracking-widest ${
              currentPersonality.id === p.id 
                ? 'bg-[#4D6BFE] border-transparent text-white shadow-lg' 
                : 'bg-[#161b22] border-[#30363d] text-slate-500 hover:text-slate-300'
            }`}
          >
            {p.emoji} {p.name}
          </button>
        ))}
      </div>

      <main className="flex-1 overflow-y-auto px-4 py-8 space-y-6 hide-scrollbar">
        {messages.map((msg, i) => <ChatMessage key={i} message={msg} />)}
        
        {isTyping && !messages[messages.length-1]?.text && !messages[messages.length-1]?.reasoning && (
          <div className="flex items-center gap-4 p-5 bg-[#161b22] rounded-2xl border border-[#30363d] w-fit shadow-xl border-l-[#4D6BFE] border-l-4">
            <div className="flex gap-1.5">
              <div className="w-2 h-2 bg-[#4D6BFE] rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-[#4D6BFE] rounded-full animate-bounce [animation-delay:0.2s]"></div>
              <div className="w-2 h-2 bg-[#4D6BFE] rounded-full animate-bounce [animation-delay:0.4s]"></div>
            </div>
            <span className="text-xs font-black text-[#4D6BFE] uppercase tracking-[0.3em]">Neural Think...</span>
          </div>
        )}
        <div ref={chatEndRef} />
      </main>

      <footer className="p-4 bg-[#161b22] border-t border-[#30363d] pb-safe">
        <form onSubmit={handleSendMessage} className="flex gap-3 max-w-5xl mx-auto items-end">
          <div className="flex-1">
            <textarea 
              rows={1}
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-2xl px-6 py-4 text-sm text-white placeholder-slate-600 focus:border-[#4D6BFE] transition-all outline-none resize-none hide-scrollbar"
              placeholder="Введите сообщение..."
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
            className="w-14 h-14 shrink-0 rounded-2xl bg-[#4D6BFE] text-white flex items-center justify-center disabled:opacity-20 transition-all active:scale-95 shadow-xl shadow-blue-900/40"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="m22 2-7 20-4-9-9-4Z"/>
              <path d="M22 2 11 13"/>
            </svg>
          </button>
        </form>
      </footer>
    </div>
  );
};

export default App;
