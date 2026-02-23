"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";

const links = [
  { href: "/", label: "Home" },
  { href: "/play-ai", label: "Play AI" },
  { href: "/game-settings", label: "Game Settings" },
  { href: "/join-room", label: "Join Room" },
];

const Navbar = () => {
  const pathname = usePathname();

  return (
    <header className="hidden md:block w-full border-b border-[var(--tycoon-border)] bg-[#010F10]/95 backdrop-blur-md sticky top-0 z-30">
      <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="relative h-8 w-8">
            <Image
              src="/logo.png"
              alt="Tycoon"
              fill
              className="object-contain"
              priority
            />
          </div>
          <span className="font-orbitron text-sm font-semibold tracking-[0.18em] uppercase text-[var(--tycoon-text)]">
            Tycoon
          </span>
        </Link>

        <nav className="flex items-center gap-3 rounded-full border border-[var(--tycoon-border)] bg-[var(--tycoon-card-bg)] px-3 py-1.5">
          {links.map((link) => {
            const isActive =
              link.href === "/"
                ? pathname === "/" || pathname.startsWith("/(home)")
                : pathname === link.href || pathname.startsWith(`${link.href}/`);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative rounded-full px-4 py-1.5 text-xs font-dm-sans font-medium transition-colors duration-200 ${
                  isActive
                    ? "bg-[var(--tycoon-accent)] text-[#010F10]"
                    : "text-[var(--tycoon-text)]/70 hover:text-[var(--tycoon-accent)]"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
};

export default Navbar;
