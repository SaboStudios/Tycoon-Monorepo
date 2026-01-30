import React from "react";
import logo from "@/public/footerLogo.svg";
import Logo from "./logo";
import Link from "next/link";
import { FiFacebook, FiGithub } from "react-icons/fi";
import { RiTwitterXFill } from "react-icons/ri";
import { RxDiscordLogo } from "react-icons/rx";

const Footer = () => {
  return (
    <footer className="w-full md:pb-12 pb-8 px-4">
      <div className="w-full max-w-[1120px] mx-auto flex flex-col md:flex-row items-center md:justify-between justify-center md:gap-0 gap-4 bg-[#0B191A] rounded-[16px] p-[20px]">
        <Logo className="md:w-[60px] w-[55px]" image={logo} href="/" />

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