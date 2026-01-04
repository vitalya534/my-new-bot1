
import React from 'react';
import { Message } from '../types';

interface ChatMessageProps {
  message: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';
  
  const content = typeof message.text === 'string' 
    ? message.text 
    : JSON.stringify(message.text);

  if (!content && message.role === 'model') return null;

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}>
      <div 
        className={`max-w-[92%] px-5 py-4 rounded-2xl shadow-2xl text-[14px] leading-relaxed relative border ${
          isUser 
            ? 'bg-cyan-600 text-white rounded-tr-none border-cyan-500' 
            : 'bg-slate-900 text-slate-200 rounded-tl-none border-slate-800'
        }`}
      >
        <p className="whitespace-pre-wrap font-medium">{content}</p>
        <div className={`text-[9px] mt-3 font-black tracking-widest uppercase opacity-40 ${isUser ? 'text-right' : 'text-left'}`}>
          {isUser ? 'User Terminal' : 'Reasoning Engine'} • {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
