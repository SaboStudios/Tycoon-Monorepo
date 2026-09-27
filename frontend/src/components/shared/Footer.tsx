import React from "react";
import Link from "next/link";
import Image from "next/image";
import { FiFacebook, FiGithub } from "react-icons/fi";
import { RiTwitterXFill } from "react-icons/ri";
import { RxDiscordLogo } from "react-icons/rx";

const Footer = () => {
  return (
    <footer className="w-full px-4 pb-8 md:pb-12 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-center gap-4 rounded-2xl bg-[#0B191A] p-5 md:flex-row md:justify-between md:gap-0">
        <Link href="/" className="md:w-[60px] w-[55px] block">
          <Image src="/footerLogo.svg" alt="Tycoon" width={60} height={55} className="md:w-[60px] w-[55px] h-auto" unoptimized />
        </Link>

        <p className="text-[#F0F7F7] text-[12px] font-dmSans font-[400]">
          ©{new Date().getFullYear()} Tycoon &bull; All rights reserved.
        </p>

        <div className="flex items-center gap-5">
          <Link
            href="https://facebook.com/ajidokwu"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#F0F7F7] hover:text-[#00F0FF] transition-colors duration-300 ease-in-out text-[20px]"
            aria-label="Facebook"
          >
            <FiFacebook />
          </Link>

          <Link
            href="https://x.com/blockopoly1"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#F0F7F7] hover:text-[#00F0FF] transition-colors duration-300 ease-in-out text-[20px]"
            aria-label="X (Twitter)"
          >
            <RiTwitterXFill />
          </Link>

          <Link
            href="https://github.com/Tyoon"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#F0F7F7] hover:text-[#00F0FF] transition-colors duration-300 ease-in-out text-[20px]"
            aria-label="GitHub"
          >
            <FiGithub />
          </Link>

          <Link
            href="https://t.me/+xJLEjw9tbyQwMGVk"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#F0F7F7] hover:text-[#00F0FF] transition-colors duration-300 ease-in-out text-[20px]"
            aria-label="Telegram"
          >
            {/* Note: react-icons doesn't have a Telegram icon in the free set, so keeping Discord as placeholder */}
            {/* If you install react-icons/tg or use a custom SVG, replace RxDiscordLogo with the correct icon */}
            <RxDiscordLogo />
          </Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;