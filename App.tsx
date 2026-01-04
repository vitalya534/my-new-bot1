
import React, { useState, useEffect, useRef } from 'react';
import { PERSONALITIES } from './constants';
import { Message, Personality } from './types';
import PersonalityCard from './components/PersonalityCard';
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
    
    // Check key
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
    
    setMessages([{
      role: 'assistant',
      text: `DeepSeek-R1 подключен. Движок: DeepSeek-V3-Reasoner. Режим: ${currentPersonality.name}. Все системы функционируют.`,
      timestamp: Date.now()
    }]);
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
      role: m.role === 'assistant' ? 'model' : m.role,
      parts: [{ text: String(m.text) }]
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
          setMessages(prev => [...prev, { role: 'assistant', text: '', reasoning: '', timestamp: Date.now() }]);
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
      console.error("DeepSeek API Error:", error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: `Error: ${error.message}. Убедитесь, что ваш API-ключ DeepSeek действителен.`,
        timestamp: Date.now()
      }]);
      setInputText(currentInput);
    } finally {
      setIsTyping(false);
    }
  };

  if (apiKeyStatus === 'checking') {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#0d1117]">
        <div className="w-12 h-12 border-2 border-slate-800 border-t-[#4D6BFE] rounded-full animate-spin"></div>
      </div>
    );
  }

  if (apiKeyStatus === 'missing') {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#0d1117] p-10 text-center animate-fade-in">
        <div className="mb-8 space-y-4">
          <div className="text-6xl">🌌</div>
          <h2 className="text-2xl font-black text-white tracking-tight">DeepSeek API</h2>
          <p className="text-slate-500 text-sm max-w-xs mx-auto">
            Для работы приложения на "нормальном движке" необходимо предоставить ваш персональный API-ключ DeepSeek.
          </p>
        </div>
        <button 
          onClick={handleSetupKey}
          className="w-full max-w-xs bg-[#4D6BFE] hover:bg-[#3b57e6] text-white font-black py-4 rounded-2xl shadow-xl transition-all active:scale-95"
        >
          ВВЕСТИ API КЛЮЧ
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-[#0d1117] text-slate-200">
      {/* Header */}
      <header className="px-5 py-4 bg-[#161b22]/95 backdrop-blur-xl border-b border-[#30363d] z-30 shrink-0 flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#4D6BFE] flex items-center justify-center shadow-lg">
             <span className="text-white text-lg font-black italic">D</span>
          </div>
          <div>
            <h1 className="text-sm font-black text-white uppercase tracking-wider">
              DeepSeek <span className="text-[#4D6BFE]">R1</span>
            </h1>
            <div className="flex items-center gap-1.5">
              <span className="w-1 h-1 bg-green-400 rounded-full animate-pulse"></span>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Live Engine</span>
            </div>
          </div>
        </div>
        <button 
          onClick={() => setApiKeyStatus('missing')}
          className="p-2.5 text-slate-500 hover:text-white transition-colors bg-[#21262d] rounded-xl border border-[#30363d]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
        </button>
      </header>

      {/* Personality Selector */}
      <div className="px-4 py-3 grid grid-cols-4 gap-2 bg-[#0d1117] border-b border-[#30363d] shrink-0">
        {PERSONALITIES.map(p => (
          <button
            key={p.id}
            onClick={() => setCurrentPersonality(p)}
            className={`flex flex-col items-center p-2 rounded-xl transition-all border ${
              currentPersonality.id === p.id 
                ? 'bg-[#161b22] border-[#4D6BFE] shadow-lg shadow-blue-900/10' 
                : 'bg-transparent border-transparent grayscale opacity-30 hover:opacity-100 hover:grayscale-0'
            }`}
          >
            <span className="text-xl mb-1">{p.emoji}</span>
            <span className="text-[7px] font-black uppercase tracking-tighter truncate w-full text-center text-slate-400">
              {p.name.split(' ')[1] || p.name}
            </span>
          </button>
        ))}
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 hide-scrollbar">
        {messages.map((msg, i) => <ChatMessage key={`${msg.timestamp}-${i}`} message={msg} />)}
        
        {isTyping && (!messages[messages.length-1]?.text) && (
          <div className="flex justify-start mb-6 animate-fade-in">
            <div className="bg-[#161b22] px-5 py-4 rounded-2xl rounded-tl-none border border-[#30363d] shadow-xl flex flex-col gap-3 min-w-[240px]">
              <div className="flex items-center gap-3">
                 <div className="w-2 h-2 bg-[#4D6BFE] rounded-full animate-pulse"></div>
                 <div className="text-[10px] text-[#4D6BFE] font-black uppercase tracking-widest">
                   System Thinking...
                 </div>
              </div>
              <div className="h-1 w-full bg-[#30363d] rounded-full overflow-hidden">
                <div className="h-full bg-[#4D6BFE] w-1/3 animate-loading"></div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <footer className="p-4 bg-[#161b22] border-t border-[#30363d] shrink-0 pb-safe">
        <form onSubmit={handleSendMessage} className="flex gap-3">
          <input 
            type="text"
            className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-xl px-5 py-4 text-sm font-medium text-white placeholder-slate-600 focus:border-[#4D6BFE] transition-all outline-none"
            placeholder="Запрос к DeepSeek R1..."
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            disabled={isTyping}
          />
          <button 
            type="submit"
            disabled={!inputText.trim() || isTyping}
            className={`p-4 rounded-xl transition-all active:scale-90 flex items-center justify-center ${
              !inputText.trim() || isTyping 
                ? 'bg-[#21262d] text-slate-600' 
                : 'bg-[#4D6BFE] text-white shadow-lg shadow-blue-900/20 hover:bg-[#3b57e6]'
            }`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </form>
      </footer>

      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
        .animate-loading {
          animation: loading 1.5s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default App;
