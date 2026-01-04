
import React from 'react';
import { Personality } from '../types';

interface PersonalityCardProps {
  personality: Personality;
  isActive: boolean;
  onClick: () => void;
}

const PersonalityCard: React.FC<PersonalityCardProps> = ({ personality, isActive, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-300 transform border-2 ${
        isActive 
          ? `scale-105 border-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.3)] z-10 bg-slate-800 text-white` 
          : 'border-transparent bg-slate-900/50 text-slate-500 hover:bg-slate-800'
      }`}
    >
      <span className={`text-2xl mb-1 transition-transform ${isActive ? 'scale-110 rotate-3' : 'grayscale opacity-50'}`}>
        {personality.emoji}
      </span>
      <span className={`font-black text-[10px] uppercase tracking-tighter ${isActive ? 'text-cyan-400' : 'text-slate-600'}`}>
        {personality.name}
      </span>
      
      {isActive && (
        <div className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
        </div>
      )}
    </button>
  );
};

export default PersonalityCard;
