
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
      className={`relative flex flex-col items-center justify-center p-4 rounded-2xl transition-all duration-300 transform border-2 ${
        isActive 
          ? `scale-105 border-slate-900 shadow-xl z-10 ${personality.color} text-white` 
          : 'border-transparent bg-white shadow-md hover:shadow-lg hover:-translate-y-1 text-slate-700'
      }`}
    >
      <span className="text-4xl mb-2 drop-shadow-sm">{personality.emoji}</span>
      <span className="font-bold text-sm tracking-tight">{personality.name}</span>
      <span className={`text-[10px] mt-1 leading-tight opacity-80 ${isActive ? 'text-white' : 'text-slate-500'}`}>
        {personality.description}
      </span>
      
      {isActive && (
        <div className="absolute -top-1 -right-1 flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
          <span className="relative inline-flex rounded-full h-4 w-4 bg-white border-2 border-slate-900"></span>
        </div>
      )}
    </button>
  );
};

export default PersonalityCard;
