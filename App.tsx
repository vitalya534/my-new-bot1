
import React, { useState, useEffect, useRef } from 'react';
import { PERSONALITIES } from './constants';
import { Message, Personality } from './types';
import ChatMessage from './components/ChatMessage';
import { deepseekService } from './services/deepseekService';
import { geminiService } from './services/geminiService';

declare global {
  interface Window {
    Telegram?: any;
    process?: any;
  }
}

type EngineType = 'deepseek' | 'gemini';

const App: React.FC = () => {
  const [currentPersonality, setCurrentPersonality] = useState<Personality>(PERSONALITIES[0]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [engine, setEngine] = useState<EngineType>('deepseek');
  const [authError, setAuthError] = useState<string | null>(null);
  const [botAuth, setBotAuth] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const env = (window as any).process?.env || {};
    const dsKey = (process.env?.DEEPSEEK_API_KEY || env.DEEPSEEK_API_KEY)?.trim();
    const gKey = (process.env?.API_KEY || env.API_KEY)?.trim();
    const botToken = (process.env?.BOT_TOKEN || env.BOT_TOKEN)?.trim();

    // Проверка наличия BOT_TOKEN для Telegram интеграции
    if (botToken) {
      setBotAuth(true);
      console.log("BOT_TOKEN detected. Telegram integration active.");
    }

    // Автоматический выбор движка на основе форматов ключей
    if (gKey?.startsWith('AIza') && (!dsKey || dsKey.startsWith('AIza'))) {
      setEngine('gemini');
    } else {
      setEngine('deepseek');
    }

    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      tg.setHeaderColor('#0d1117');
    }
  }, []);

  useEffect(() => {
    const engineName = engine === 'deepseek' ? 'DeepSeek R1' : 'Gemini 3 Pro';
    setMessages([{
      role: 'assistant',
      text: `Система готова. Движок: ${engineName}. Режим: ${currentPersonality.name}.`,
      timestamp: Date.now()
    }]);
    setAuthError(null);
  }, [currentPersonality, engine]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isTyping) return;

    setAuthError(null);
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
      const activeService = engine === 'deepseek' ? deepseekService : geminiService;
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
    } catch (error: any) {
      console.error("Engine Error:", error);
      const msg = error.message || "Unknown error";
      setAuthError(msg);
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: `Ошибка выполнения: ${msg}`,
        timestamp: Date.now()
      }]);
      setInputText(currentInput);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#0d1117] text-slate-200 font-sans">
      <header className="px-5 py-3 bg-[#161b22]/95 backdrop-blur-md border-b border-[#30363d] flex items-center justify-between z-50">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-lg transition-all ${engine === 'deepseek' ? 'bg-[#4D6BFE]' : 'bg-cyan-600'}`}>
             <span className="text-white text-lg font-black italic">{engine === 'deepseek' ? 'D' : 'G'}</span>
          </div>
          <div>
            <h1 className="text-xs font-black uppercase tracking-[0.2em] text-white">
              {engine === 'deepseek' ? 'DeepSeek' : 'Gemini'} <span className={engine === 'deepseek' ? 'text-[#4D6BFE]' : 'text-cyan-400'}>{engine === 'deepseek' ? 'R1' : '3 PRO'}</span>
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`w-1 h-1 rounded-full ${authError ? 'bg-red-500' : 'bg-green-500'} ${isTyping ? 'animate-pulse' : ''}`}></span>
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                {authError ? 'Error' : botAuth ? 'Bot Linked' : 'Online'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex bg-[#0d1117] rounded-lg p-1 border border-[#30363d] scale-90">
          <button 
            onClick={() => setEngine('deepseek')}
            className={`px-3 py-1 rounded-md text-[9px] font-black uppercase transition-all ${engine === 'deepseek' ? 'bg-[#4D6BFE] text-white' : 'text-slate-500'}`}
          >
            DeepSeek
          </button>
          <button 
            onClick={() => setEngine('gemini')}
            className={`px-3 py-1 rounded-md text-[9px] font-black uppercase transition-all ${engine === 'gemini' ? 'bg-cyan-600 text-white' : 'text-slate-500'}`}
          >
            Gemini
          </button>
        </div>
      </header>

      {authError && (
        <div className="bg-red-900/20 border-b border-red-500/40 p-3 text-center animate-fade-in flex flex-col items-center gap-2">
          <p className="text-[10px] text-red-400 font-bold uppercase tracking-wider leading-tight">
            {authError.includes('401') 
              ? '⚠️ DEEPSEEK_API_KEY не авторизован или баланс пуст.' 
              : `⚠️ ${authError}`}
          </p>
        </div>
      )}

      <div className="flex gap-2 p-2 bg-[#0d1117] border-b border-[#30363d] overflow-x-auto hide-scrollbar shrink-0">
        {PERSONALITIES.map(p => (
          <button
            key={p.id}
            onClick={() => setCurrentPersonality(p)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg transition-all border text-[9px] font-black uppercase tracking-widest ${
              currentPersonality.id === p.id 
                ? `${engine === 'deepseek' ? 'bg-[#4D6BFE]' : 'bg-cyan-600'} border-transparent text-white` 
                : 'bg-[#161b22] border-[#30363d] text-slate-500'
            }`}
          >
            {p.emoji} {p.name}
          </button>
        ))}
      </div>

      <main className="flex-1 overflow-y-auto px-4 py-6 space-y-6 hide-scrollbar relative">
        {messages.map((msg, i) => <ChatMessage key={i} message={msg} />)}
        
        {isTyping && !messages[messages.length-1]?.text && !messages[messages.length-1]?.reasoning && (
          <div className={`flex items-center gap-4 p-4 bg-[#161b22] rounded-2xl border border-[#30363d] w-fit shadow-xl border-l-4 animate-pulse ${engine === 'deepseek' ? 'border-l-[#4D6BFE]' : 'border-l-cyan-500'}`}>
            <div className="flex gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full animate-bounce ${engine === 'deepseek' ? 'bg-[#4D6BFE]' : 'bg-cyan-500'}`}></div>
              <div className={`w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:0.2s] ${engine === 'deepseek' ? 'bg-[#4D6BFE]' : 'bg-cyan-500'}`}></div>
              <div className={`w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:0.4s] ${engine === 'deepseek' ? 'bg-[#4D6BFE]' : 'bg-cyan-500'}`}></div>
            </div>
            <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${engine === 'deepseek' ? 'text-[#4D6BFE]' : 'text-cyan-500'}`}>
              Reasoning...
            </span>
          </div>
        )}
        <div ref={chatEndRef} />
      </main>

      <footer className="p-4 bg-[#161b22] border-t border-[#30363d] pb-safe">
        <form onSubmit={handleSendMessage} className="flex gap-2 max-w-5xl mx-auto items-end">
          <div className="flex-1">
            <textarea 
              rows={1}
              className={`w-full bg-[#0d1117] border border-[#30363d] rounded-2xl px-5 py-3.5 text-sm text-white placeholder-slate-600 transition-all outline-none resize-none hide-scrollbar focus:border-${engine === 'deepseek' ? '[#4D6BFE]' : 'cyan-500'}`}
              placeholder={engine === 'deepseek' ? "Запрос к R1..." : "Запрос к Gemini..."}
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
            className={`w-12 h-12 shrink-0 rounded-xl text-white flex items-center justify-center disabled:opacity-20 transition-all active:scale-95 shadow-lg ${engine === 'deepseek' ? 'bg-[#4D6BFE]' : 'bg-cyan-600'}`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
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
