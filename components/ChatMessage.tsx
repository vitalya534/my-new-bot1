
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
        
        {/* DeepSeek Reasoning Block (Hidden if empty in V3) */}
        {!isUser && message.reasoning && (
          <div className="mb-3 w-full animate-fade-in">
            <button 
              onClick={() => setShowReasoning(!showReasoning)}
              className="group flex items-center gap-2 px-2 py-1 rounded-md hover:bg-slate-800/50 transition-colors"
            >
              <div className={`text-[10px] font-black tracking-widest uppercase ${showReasoning ? 'text-[#4D6BFE]' : 'text-slate-500'}`}>
                {showReasoning ? 'Свернуть размышления' : 'Показать ход мыслей'}
              </div>
              <svg 
                className={`w-3 h-3 text-slate-500 transition-transform duration-300 ${showReasoning ? 'rotate-180' : ''}`} 
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {showReasoning && (
              <div className="mt-2 p-4 bg-[#161b22] border-l-2 border-[#4D6BFE] text-slate-400 text-[13px] italic font-light leading-relaxed rounded-r-xl shadow-inner overflow-hidden">
                <div className="flex items-center gap-2 mb-2 opacity-50">
                  <div className="w-1.5 h-1.5 bg-[#4D6BFE] rounded-full animate-pulse"></div>
                  <span className="text-[10px] font-bold uppercase tracking-tighter">DeepSeek V3 Core</span>
                </div>
                {message.reasoning}
              </div>
            )}
          </div>
        )}

        {/* Main Response */}
        <div 
          className={`px-5 py-4 rounded-2xl shadow-xl text-[15px] leading-relaxed border ${
            isUser 
              ? 'bg-[#4D6BFE] text-white rounded-tr-none border-[#6b85ff]' 
              : 'bg-[#1b2129] text-slate-200 rounded-tl-none border-[#30363d]'
          }`}
        >
          <div className="whitespace-pre-wrap">{message.text}</div>
          
          <div className={`text-[9px] mt-3 font-bold tracking-widest uppercase opacity-30 flex items-center gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
            <span>{isUser ? 'Вы' : 'DeepSeek V3'}</span>
            <span>•</span>
            <span>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
