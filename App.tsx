
import React, { useState, useEffect, useRef } from 'react';
import { PERSONALITIES } from './constants';
import { Message, Personality } from './types';
import ChatMessage from './components/ChatMessage';
import { deepseekService } from './services/deepseekService';

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
  const [apiKeyStatus, setApiKeyStatus] = useState<'checking' | 'missing' | 'ready'>('checking');
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      tg.setHeaderColor('#0d1117');
    }
    
    const checkKey = async () => {
      // Small delay to let environment variables inject
      setTimeout(() => {
        setApiKeyStatus(process.env.API_KEY ? 'ready' : 'missing');
      }, 500);
    };
    checkKey();
  }, []);

  useEffect(() => {
    if (apiKeyStatus !== 'ready') return;
    
    setMessages([{
      role: 'assistant',
      text: `DeepSeek R1 (Reasoner) активен. Профиль: ${currentPersonality.name}. Готов к глубокому анализу.`,
      timestamp: Date.now()
    }]);
  }, [currentPersonality, apiKeyStatus]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

    const history = messages
      .filter(m => m.timestamp > 0)
      .slice(-6) // Send last 6 messages for context
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
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last && last.role === 'assistant') {
            last.text = fullText;
            last.reasoning = fullReasoning;
          }
          return updated;
        });
      }
    } catch (error: any) {
      console.error("DeepSeek Execution Error:", error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: `Критическая ошибка: ${error.message}. Проверьте лимиты DeepSeek API.`,
        timestamp: Date.now()
      }]);
      setInputText(currentInput);
    } finally {
      setIsTyping(false);
    }
  };

  if (apiKeyStatus === 'missing') {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#0d1117] p-8 text-center">
        <div className="w-20 h-20 bg-[#4D6BFE] rounded-3xl flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(77,107,254,0.3)]">
          <span className="text-white text-4xl font-black italic">D</span>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">DeepSeek API Key Missing</h2>
        <p className="text-slate-500 text-sm mb-8 max-w-xs">
          Пожалуйста, установите API_KEY в настройках окружения для работы с моделью R1.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-[#0d1117] text-slate-200">
      <header className="px-6 py-4 bg-[#161b22]/80 backdrop-blur-md border-b border-[#30363d] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#4D6BFE] flex items-center justify-center">
             <span className="text-white text-sm font-black italic">D</span>
          </div>
          <h1 className="text-sm font-black uppercase tracking-widest text-white">
            DeepSeek <span className="text-[#4D6BFE]">R1</span>
          </h1>
        </div>
        <div className="px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
          <span className="text-[10px] font-bold text-green-400 uppercase">Online</span>
        </div>
      </header>

      <div className="flex gap-2 p-4 bg-[#0d1117] border-b border-[#30363d] overflow-x-auto hide-scrollbar">
        {PERSONALITIES.map(p => (
          <button
            key={p.id}
            onClick={() => setCurrentPersonality(p)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl transition-all border text-xs font-bold uppercase tracking-tight ${
              currentPersonality.id === p.id 
                ? 'bg-[#4D6BFE] border-transparent text-white shadow-lg' 
                : 'bg-[#161b22] border-[#30363d] text-slate-500 hover:text-slate-300'
            }`}
          >
            {p.emoji} {p.name}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 hide-scrollbar space-y-6">
        {messages.map((msg, i) => <ChatMessage key={i} message={msg} />)}
        {isTyping && !messages[messages.length-1]?.text && !messages[messages.length-1]?.reasoning && (
          <div className="flex items-center gap-3 text-slate-500 animate-pulse">
            <div className="w-2 h-2 bg-[#4D6BFE] rounded-full"></div>
            <span className="text-xs font-bold uppercase tracking-widest">DeepSeek is thinking...</span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <footer className="p-4 bg-[#161b22] border-t border-[#30363d]">
        <form onSubmit={handleSendMessage} className="flex gap-3 max-w-4xl mx-auto">
          <input 
            type="text"
            className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-2xl px-5 py-4 text-sm text-white focus:border-[#4D6BFE] transition-all outline-none"
            placeholder="Спросите DeepSeek R1 о чем угодно..."
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            disabled={isTyping}
          />
          <button 
            type="submit"
            disabled={!inputText.trim() || isTyping}
            className="w-14 h-14 rounded-2xl bg-[#4D6BFE] text-white flex items-center justify-center disabled:opacity-30 disabled:grayscale transition-all active:scale-90"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </form>
      </footer>
    </div>
  );
};

export default App;
