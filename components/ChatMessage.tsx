
import React from 'react';
import { Message } from '../types';

interface ChatMessageProps {
  message: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';
  
  // Safety check to ensure we only try to render strings or primitives
  const content = typeof message.text === 'string' 
    ? message.text 
    : JSON.stringify(message.text);

  if (!content && message.role === 'model') return null;

  return (
    <div className={`flex w-full mb-5 ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}>
      <div 
        className={`max-w-[88%] px-5 py-3.5 rounded-2xl shadow-sm text-[15px] leading-relaxed relative ${
          isUser 
            ? 'bg-slate-900 text-white rounded-tr-none' 
            : 'bg-white text-slate-800 rounded-tl-none border border-slate-100'
        }`}
      >
        <p className="whitespace-pre-wrap">{content}</p>
        <div className={`text-[10px] mt-2 font-bold tracking-tight uppercase opacity-30 ${isUser ? 'text-right' : 'text-left'}`}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
