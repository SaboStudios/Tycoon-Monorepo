import React, { useMemo } from "react";
import Image from "next/image";
import { Property } from "@/types/game";
import { GrHelp } from "react-icons/gr";

type Position = "bottom" | "left" | "top" | "right";

interface SpecialCardProps {
  square: Property & { position: Position };
}

const SpecialCard = ({ square }: SpecialCardProps) => {
  const { position, name, type, price } = square;

  const isChance = type === "chance";
  const isCommunityChest = type === "community_chest";
  const isIncomeTax = type === "income_tax";
  const isLuxuryTax = type === "luxury_tax";
  const isTax = isIncomeTax || isLuxuryTax;

  const payText = `$${price}`;
  const taxName = name;

  const orientationRotation: Record<Position, string> = {
    bottom: "",
    left: "rotate-90",
    top: "",
    right: "-rotate-90",
  };

  const bgClass = useMemo(() => {
    if (isCommunityChest) return "bg-white";
    if (isTax) return "bg-amber-50";
    return "bg-[#0B191A]";
  }, [isCommunityChest, isTax]);

  const textClass = isTax || isCommunityChest ? "text-black" : "text-[#55656D]";
  const iconClass = isTax || isCommunityChest ? "text-gray-800" : "text-[#0FF0FC]";

  const positionClasses = {
    name: "top-[20%] left-0 right-0 text-center",
    dollar: "top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2",
    pay: "bottom-[20%] left-0 right-0 text-center",
  };

  const outerClasses = useMemo(
    () =>
      `relative w-full h-full ${bgClass} ${isCommunityChest ? "" : "p-0.5"} 
      rounded-[2.5px] ${orientationRotation[position]} shadow-sm ${textClass} 
      ${isCommunityChest ? "overflow-hidden" : ""}`,
    [bgClass, isCommunityChest, position, textClass]
  );

  if (isChance)
    return (
      <div className={outerClasses}>
        <GrHelp
          className={`${iconClass} size-5 md:size-6 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2`}
        />
        <p className="absolute bottom-0.5 left-0.5 right-0.5 text-center text-[3.5px] md:text-[4.5px] uppercase font-semibold tracking-wide">
          Chance
        </p>
      </div>
    );

  if (isCommunityChest)
    return (
      <div className={outerClasses}>
        <Image
          src="/game/communitychest.jpeg"
          alt="Community Chest"
          fill
          className="object-contain"
        />
        <p className="absolute top-0 left-0 right-0 text-center text-[3.5px] md:text-[4.5px] uppercase font-bold bg-white py-0.5">
          Community Chest
        </p>
      </div>
    );

  if (isTax)
    return (
      <div className={outerClasses}>
        <p
          className={`absolute text-[3px] md:text-[4px] uppercase font-bold ${positionClasses.name}`}
        >
          {taxName}
        </p>
        <div
          className={`absolute text-2xl font-black ${positionClasses.dollar}`}
        >
          $
        </div>
        <p
          className={`absolute text-[3px] md:text-[4px] font-bold text-center px-1 truncate leading-tight text-black ${positionClasses.pay}`}
        >
          {payText}
        </p>
      </div>
    );

  return (
    <div className={outerClasses}>
      <p className="text-[4px] md:text-[5px] uppercase font-semibold text-center px-1">
        {name}
      </p>
    </div>
  );
};

export default React.memo(SpecialCard);
