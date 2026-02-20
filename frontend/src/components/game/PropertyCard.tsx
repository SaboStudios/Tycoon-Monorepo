import React from 'react';

export interface PropertyCardProps {
    name: string;
    color?: string; // e.g., 'bg-red-500' or hex/tailwind class
    price?: number;
    rent?: number;
    houses?: number;
    owner?: string;
    isSelectable?: boolean;
    isSelected?: boolean;
    onSelect?: () => void;
    variant?: 'compact' | 'expanded';
    type?: 'property' | 'railroad' | 'utility';
}

export const PropertyCard: React.FC<PropertyCardProps> = ({
    name,
    color = 'bg-gray-300',
    price,
    rent,
    houses = 0,
    owner,
    isSelectable = false,
    isSelected = false,
    onSelect,
    variant = 'expanded',
    type = 'property',
}) => {
    const isCompact = variant === 'compact';

    const cardClasses = `flex flex-col border-2 rounded-lg overflow-hidden transition-all duration-200 bg-white
    ${isSelectable ? 'cursor-pointer hover:shadow-lg hover:-translate-y-1' : ''}
    ${isSelected ? 'border-blue-500 shadow-md ring-2 ring-blue-300' : 'border-gray-800 shadow-sm'}
    ${isCompact ? 'w-32 h-40' : 'w-48 h-64'}
  `;

    // Determine top section styling based on type
    const isSpecial = type === 'railroad' || type === 'utility';

    return (
        <div
            className={cardClasses}
            onClick={isSelectable ? onSelect : undefined}
            role={isSelectable ? 'button' : undefined}
            tabIndex={isSelectable ? 0 : undefined}
            onKeyDown={(e) => {
                if (isSelectable && onSelect && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    onSelect();
                }
            }}
        >
            {/* Property Color Header (for 'property' type) */}
            {!isSpecial && (
                <div className={`h-1/4 w-full border-b-2 border-gray-800 flex items-center justify-center p-1 ${color}`}>
                    {/* Empty or small decoration can go here */}
                </div>
            )}

            {/* Main Content Area */}
            <div className={`flex flex-col flex-grow items-center text-center p-2 ${isSpecial ? 'pt-4' : ''}`}>

                {/* Special Icon placeholder for railroads/utilities */}
                {isSpecial && (
                    <div className="mb-2 text-2xl text-gray-700">
                        {type === 'railroad' ? '🚂' : '💡'}
                    </div>
                )}

                <h3 className={`font-bold font-serif uppercase leading-tight text-gray-900 ${isCompact ? 'text-xs mb-1' : 'text-sm mb-2'}`}>
                    {name}
                </h3>

                {/* Expanded Details */}
                {!isCompact && (
                    <div className="flex flex-col justify-between flex-grow w-full mt-2 text-xs">
                        {rent !== undefined && (
                            <div className="mb-2">
                                <span className="text-gray-600 block mb-1">RENT ${rent}</span>
                                {houses > 0 && Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} className="flex justify-between w-full px-4 text-gray-500">
                                        <span>With {i + 1} House{i > 0 ? 's' : ''}</span>
                                        <span>${rent * (i + 2)}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="mt-auto border-t border-gray-200 pt-2 w-full space-y-1">
                            {houses > 0 && (
                                <div className="text-green-600 font-semibold">{houses} Houses</div>
                            )}
                            {price !== undefined && (
                                <div className="font-bold text-gray-800">${price}</div>
                            )}
                            {owner && (
                                <div className="text-gray-500 truncate text-[10px]" title={owner}>
                                    Owner: {owner === 'Bank' || !owner ? 'None' : owner.substring(0, 6) + '...'}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Compact Details */}
                {isCompact && (
                    <div className="mt-auto w-full text-xs font-bold text-gray-800">
                        {price !== undefined ? `$${price}` : ''}
                    </div>
                )}
            </div>
        </div>
    );
};
