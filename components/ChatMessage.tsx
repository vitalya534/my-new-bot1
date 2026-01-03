
import React from 'react';
import { Message } from '../types';

interface ChatMessageProps {
  message: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';
  
  return (
    <div className={`flex w-full mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div 
        className={`max-w-[85%] px-4 py-2.5 rounded-2xl shadow-sm text-sm leading-relaxed ${
          isUser 
            ? 'bg-slate-900 text-white rounded-tr-none' 
            : 'bg-white text-slate-800 rounded-tl-none border border-slate-100'
        }`}
      >
        <p className="whitespace-pre-wrap">{message.text}</p>
        <div className={`text-[10px] mt-1 opacity-40 ${isUser ? 'text-right' : 'text-left'}`}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
