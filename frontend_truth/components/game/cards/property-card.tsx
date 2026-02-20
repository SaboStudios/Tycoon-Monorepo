import React from "react";
import Image from "next/image";
import { Property } from "@/types/game";

type Position = "bottom" | "left" | "top" | "right";

interface PropertyCardProps {
  square: Property & { position: Position }; // enforce correct keys
  owner: string | null;
}

const PropertyCard = ({ square, owner }: PropertyCardProps) => {
  const { name, price, rent_site_only, color, position, icon } = square;

  const orientationClasses: Record<Position, string> = {
    bottom: "border-t-8",
    left: "border-t-8 rotate-90",
    top: "border-b-8",
    right: "border-t-8 -rotate-90",
  };

  const priceOrientationClasses: Record<Position, string> = {
    bottom: "bottom-0.5 right-0.5",
    left: "bottom-[30%] right-0.5 transform -rotate-90 origin-right",
    top: "bottom-0.5 right-0.5",
    right: "top-[30%] left-0.5 transform -rotate-90 origin-left",
  };

  const rent_site_onlyOrientationClasses: Record<Position, string> = {
    bottom: "bottom-0.5 left-0.5",
    left: "bottom-[30%] left-0.5 transform -rotate-90 origin-left",
    top: "bottom-0.5 left-0.5",
    right: "top-[55%] left-0.5 transform -rotate-90 origin-left",
  };

  const imageOrientationClasses: Record<Position, string> = {
    bottom: "",
    left: "-rotate-90",
    top: "",
    right: "rotate-90",
  };

  const smallTextStyle = { fontSize: "clamp(4px, 1.1vw, 6px)", textSizeAdjust: "none" as const };

  return (
    <div
      className={`relative w-full h-full bg-[#F0F7F7] text-[#0B191A] p-1 flex flex-col justify-between rounded-[2.5px] ${orientationClasses[position]}`}
      style={{ borderColor: color, textSizeAdjust: "none" }}
    >
      <div className="flex flex-col items-center pt-1.5">
        <p className="font-bold uppercase text-center max-w-full truncate" style={{ ...smallTextStyle, fontSize: "clamp(4px, 1.2vw, 6px)" }}>
          {name}
        </p>
        {icon && (
          <Image
            src={icon}
            alt={name}
            width={25}
            height={25}
            className={`my-1 transform ${imageOrientationClasses[position]}`}
          />
        )}
      </div>

      <p
        className={`absolute font-semibold bg-[#F0F7F7] shadow-sm p-0.5 rounded-[3px] ${priceOrientationClasses[position]}`}
        style={smallTextStyle}
      >
        ${price}
      </p>

      {(rent_site_only !== undefined && rent_site_only !== null) && (
        <p
          className={`absolute font-semibold bg-[#F0F7F7] shadow-sm p-0.5 rounded-[3px] whitespace-nowrap ${rent_site_onlyOrientationClasses[position]}`}
          style={smallTextStyle}
        >
          ${rent_site_only}
        </p>
      )}

      {owner ? (
        <p className="absolute font-semibold bg-[#F0F7F7] shadow-sm p-0.5 rounded-[3px] bottom-0.5 right-0.5 text-amber-600" style={smallTextStyle}>
          {owner}
        </p>
      ) : (
        <p className="absolute font-semibold bg-[#F0F7F7] shadow-sm p-0.5 rounded-[3px] bottom-0.5 right-0.5 text-green-600" style={smallTextStyle}>
          Available
        </p>
      )}
    </div>
  );
};

export default PropertyCard;
