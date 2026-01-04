
import React, { useState } from 'react';
import { Message } from '../types';

interface ChatMessageProps {
  message: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const [showReasoning, setShowReasoning] = useState(true);

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}>
      <div className={`max-w-[95%] sm:max-w-[85%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        
        {/* Reasoning Block (DeepSeek R1 characteristic) */}
        {!isUser && message.reasoning && (
          <div className="mb-2 w-full">
            <button 
              onClick={() => setShowReasoning(!showReasoning)}
              className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 hover:text-cyan-400 transition-colors"
            >
              <span className={`transform transition-transform ${showReasoning ? 'rotate-90' : ''}`}>▶</span>
              Процесс размышления (DeepSeek R1)
            </button>
            {showReasoning && (
              <div className="mt-2 p-3 bg-slate-900/50 border-l-2 border-slate-700 text-slate-400 text-xs italic font-light leading-relaxed rounded-r-xl">
                {message.reasoning}
              </div>
            )}
          </div>
        )}

        {/* Main Content */}
        <div 
          className={`px-5 py-4 rounded-2xl shadow-lg text-[15px] leading-relaxed border ${
            isUser 
              ? 'bg-[#4D6BFE] text-white rounded-tr-none border-[#6b85ff]' 
              : 'bg-[#161b22] text-slate-200 rounded-tl-none border-[#30363d]'
          }`}
        >
          <div className="whitespace-pre-wrap">{message.text}</div>
          
          <div className={`text-[9px] mt-3 font-bold tracking-widest uppercase opacity-40 flex items-center gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
            <span>{isUser ? 'User' : 'DeepSeek-R1'}</span>
            <span>•</span>
            <span>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
