"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/components/providers/auth-provider";
import { NearWalletConnect } from "@/components/wallet/NearWalletConnect";

const links = [
  { href: "/", label: "Home" },
  { href: "/play-ai", label: "Play AI" },
  { href: "/game-settings", label: "Game Settings" },
  { href: "/join-room", label: "Join Room" },
];

const Navbar = () => {
  const pathname = usePathname();
  const { user, logout } = useAuth();

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
          <Link
            href="/settings"
            className={`relative rounded-full px-3 py-1.5 text-xs font-dm-sans font-medium transition-colors duration-200 flex items-center gap-1 ${
              pathname === "/settings" || pathname.startsWith("/settings/")
                ? "bg-[var(--tycoon-accent)] text-[#010F10]"
                : "text-[var(--tycoon-text)]/70 hover:text-[var(--tycoon-accent)]"
            }`}
          >
            <Settings className="h-4 w-4" />
          </Link>
        </nav>

        <div className="flex items-center gap-4">
          <NearWalletConnect />
          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-[var(--tycoon-text)]/70 font-dm-sans">
                {user.email}
              </span>
              <button
                onClick={logout}
                className="rounded-full bg-[var(--tycoon-card-bg)] border border-[var(--tycoon-border)] px-4 py-1.5 text-xs font-dm-sans font-medium text-[var(--tycoon-text)] hover:bg-[var(--tycoon-accent)] hover:text-[#010F10] transition-colors"
              >
                Logout
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-[var(--tycoon-accent)] px-4 py-1.5 text-xs font-dm-sans font-medium text-[#010F10] hover:opacity-90 transition-opacity"
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
