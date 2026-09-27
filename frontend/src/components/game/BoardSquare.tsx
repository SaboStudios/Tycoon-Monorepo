import React from 'react';

export type SquareType = 
  | 'property' 
  | 'chance' 
  | 'community' 
  | 'corner' 
  | 'tax' 
  | 'go' 
  | 'jail';

export interface BoardSquareProps {
  name: string;
  position?: number;
  type?: SquareType;
  color?: string; // For future property color support (e.g., 'bg-red-500')
}

export const BoardSquare: React.FC<BoardSquareProps> = ({
  name,
  position,
  type = 'property',
  color = 'bg-gray-300',
}) => {
  // Type-based styling
  const getSquareStyles = () => {
    const baseStyles = 'flex flex-col border-2 rounded overflow-hidden transition-all duration-200';
    
    switch (type) {
      case 'go':
        return `${baseStyles} border-[#00F0FF] bg-[#00F0FF]/10 shadow-lg shadow-[#00F0FF]/20`;
      
      case 'jail':
        return `${baseStyles} border-red-500 bg-[#0E1415] shadow-md`;
      
      case 'corner':
        return `${baseStyles} border-[#00F0FF] bg-[#0E1415] shadow-md`;
      
      case 'chance':
        return `${baseStyles} border-[#003B3E] bg-[#0E1415]`;
      
      case 'community':
        return `${baseStyles} border-[#003B3E] bg-[#0E1415]`;
      
      case 'tax':
        return `${baseStyles} border-yellow-500 bg-[#0E1415]`;
      
      case 'property':
      default:
        return `${baseStyles} border-gray-800 bg-white shadow-sm`;
    }
  };

  const getTextColor = () => {
    switch (type) {
      case 'go':
      case 'jail':
      case 'corner':
      case 'chance':
      case 'community':
      case 'tax':
        return 'text-[#00F0FF]';
      default:
        return 'text-gray-900';
    }
  };

  const isDarkTheme = ['go', 'jail', 'corner', 'chance', 'community', 'tax'].includes(type);

  return (
    <div 
      className={`${getSquareStyles()} w-20 h-28 sm:w-24 sm:h-32 md:w-28 md:h-36`}
      data-position={position}
      data-type={type}
    >
      {/* Property color header - only for property type */}
      {type === 'property' && (
        <div className={`h-6 w-full border-b-2 border-gray-800 ${color}`} />
      )}

      {/* Main content area */}
      <div className={`flex flex-col flex-grow items-center justify-center text-center p-2 ${isDarkTheme ? 'pt-3' : ''}`}>
        {/* Type indicator icons */}
        {type === 'chance' && (
          <div className="text-xl mb-1">?</div>
        )}
        {type === 'community' && (
          <div className="text-xl mb-1">📦</div>
        )}
        {type === 'tax' && (
          <div className="text-xl mb-1">💰</div>
        )}
        {type === 'jail' && (
          <div className="text-xl mb-1">🔒</div>
        )}

        {/* Square name */}
        <h3 className={`font-bold font-serif uppercase leading-tight text-xs ${getTextColor()}`}>
          {name}
        </h3>

        {/* Position indicator (optional) */}
        {position !== undefined && (
          <div className={`text-[10px] mt-1 opacity-60 ${getTextColor()}`}>
            #{position}
          </div>
        )}
      </div>
    </div>
  );
};
