'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';
import Logo from './logo';
import LogoIcon from '@/public/logo.png';
import Link from 'next/link';
import { House, Volume2, VolumeOff, Globe, Menu, X, User, ShoppingBag } from 'lucide-react';
import useSound from 'use-sound';
import { useAppKitAccount, useAppKitNetwork } from '@reown/appkit/react';
import { useConnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import Image from 'next/image';
import avatar from '@/public/avatar.jpg';
import WalletConnectModal from './wallet-connect-modal';
import WalletDisconnectModal from './wallet-disconnect-modal';
import NetworkSwitcherModal from './network-switcher-modal';
import { useGetUsername } from '@/context/ContractProvider';
import { useProfileAvatar } from '@/context/ProfileContext';
import { isAddress } from 'viem';

const SCROLL_TOP_THRESHOLD = 40;
const SCROLL_SENSITIVITY = 8;

const NavBarMobile = () => {
  const { scrollY, scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  const [navVisible, setNavVisible] = useState(false);
  const lastScrollY = useRef(0);
  const hasScrolled = useRef(false);

  useEffect(() => {
    const y = typeof window !== 'undefined' ? window.scrollY ?? 0 : 0;
    lastScrollY.current = y;
    setNavVisible(y < SCROLL_TOP_THRESHOLD);
    hasScrolled.current = y > 0;
  }, []);

  useEffect(() => {
    const unsubscribe = scrollY.on('change', (latest) => {
      const diff = latest - lastScrollY.current;
      if (latest < SCROLL_TOP_THRESHOLD) {
        setNavVisible(true);
        hasScrolled.current = true;
      } else if (hasScrolled.current) {
        if (diff < -SCROLL_SENSITIVITY) setNavVisible(true);
        else if (diff > SCROLL_SENSITIVITY) setNavVisible(false);
      }
      lastScrollY.current = latest;
    });
    return () => unsubscribe();
  }, [scrollY]);

  const { address, isConnected } = useAppKitAccount();
  const { caipNetwork, chainId } = useAppKitNetwork();
  const { connect } = useConnect();

  const networkDisplay = caipNetwork?.name ?? (chainId ? `Chain ${chainId}` : 'Change Network');

  const [isSoundPlaying, setIsSoundPlaying] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNetworkModalOpen, setIsNetworkModalOpen] = useState(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false);
  const [isMiniPay, setIsMiniPay] = useState(false);

  const [play, { pause }] = useSound('/sound/monopoly-theme.mp3', {
    volume: 0.5,
    loop: true,
  });

const safeAddress = address && isAddress(address) 
  ? address as `0x${string}` 
  : undefined;

const { data: fetchedUsername } = useGetUsername(safeAddress);
  const profileAvatar = useProfileAvatar();

  // MiniPay detection + auto-connect attempt
  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum?.isMiniPay) {
      setIsMiniPay(true);
      if (!isConnected) {
        connect({ connector: injected() });
      }
    }
  }, [connect, isConnected]);

  const toggleSound = () => {
    if (isSoundPlaying) {
      pause();
      setIsSoundPlaying(false);
    } else {
      play();
      setIsSoundPlaying(true);
    }
  };

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <>
      {/* Mobile Fixed Header - slides up off-screen when scrolling down */}
      <motion.header
        initial={false}
        animate={{ y: navVisible ? 0 : -100 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed top-0 left-0 right-0 h-[80px] pt-safe flex flex-col z-[1000]"
      >
        {/* Scroll Progress Bar */}
        <motion.div
          className="w-full bg-[#0FF0FC] h-[3px] origin-left shrink-0"
          style={{ scaleX }}
        />
        <div className="flex-1 flex items-center justify-between px-5 bg-[#010F10]/80 backdrop-blur-xl border-b border-[#003B3E]/50">
        <Logo className="w-[42px]" image={LogoIcon} href="/" />

        <div className="flex items-center gap-4">
          <button
            onClick={toggleSound}
            className="w-12 h-12 rounded-2xl bg-[#011112]/90 border border-[#003B3E] flex items-center justify-center text-white hover:bg-[#003B3E]/50 transition"
          >
            {isSoundPlaying ? <Volume2 size={22} /> : <VolumeOff size={22} />}
          </button>

          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="w-12 h-12 rounded-2xl bg-[#011112]/90 border border-[#003B3E] flex items-center justify-center text-[#00F0FF] hover:bg-[#003B3E]/50 transition"
          >
            <Menu size={24} />
          </button>
        </div>
      </div>
      </motion.header>

      {/* Floating Menu Button - visible when navbar is hidden */}
      <motion.button
        initial={false}
        animate={{
          opacity: navVisible ? 0 : 1,
          pointerEvents: navVisible ? 'none' : 'auto',
          scale: navVisible ? 0.9 : 1,
        }}
        transition={{ duration: 0.2 }}
        onClick={() => setIsMobileMenuOpen(true)}
        className="fixed top-[calc(env(safe-area-inset-top)+0.5rem)] right-5 z-[999] w-12 h-12 rounded-2xl bg-[#011112]/95 border border-[#003B3E] flex items-center justify-center text-[#00F0FF] hover:bg-[#003B3E]/50 shadow-lg backdrop-blur-sm transition"
        aria-label="Open menu"
      >
        <Menu size={24} />
      </motion.button>

      {/* Mobile Bottom Sheet Menu */}
      {isMobileMenuOpen && (
        <>
          <div className="fixed inset-0 bg-black/70 z-[55]" onClick={closeMobileMenu} />

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 pb-safe bg-[#010F10]/98 backdrop-blur-2xl rounded-t-3xl border-t border-[#003B3E] z-[60] max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6 pb-10">
              {/* Drag Handle */}
              <div className="w-14 h-1.5 bg-[#00F0FF]/50 rounded-full mx-auto mb-8" />

              {/* Wallet Section */}
              <div className="mb-8 space-y-5">
                {/* Connected wallet info - only when connected */}
                {isConnected && (
                  <div className="p-5 rounded-2xl bg-[#011112]/80 border border-[#003B3E] flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full border-2 border-[#0FF0FC] overflow-hidden shadow-lg shrink-0">
                        {profileAvatar ? (
                          <img src={profileAvatar} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                          <Image src={avatar} alt="Avatar" width={48} height={48} className="object-cover w-full h-full" />
                        )}
                      </div>
                      <span className="text-[#00F0FF] font-orbitron text-lg">
                        {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Connected'}
                      </span>
                    </div>
                  </div>
                )}

                {/* MiniPay connection feedback */}
                {isMiniPay && !isConnected && (
                  <p className="text-center text-xs text-[#00F0FF]/50 mt-4">
                    Connecting via MiniPay...
                  </p>
                )}
              </div>

              {/* Navigation Links */}
              <nav className="space-y-4 mb-10">
                <Link
                  href="/"
                  onClick={closeMobileMenu}
                  className="flex items-center gap-5 py-5 px-6 rounded-2xl bg-[#011112]/60 hover:bg-[#011112] text-white text-lg font-medium transition"
                >
                  <House size={24} />
                  Home
                </Link>

                {isConnected && (
                  <>
                    <Link
                      href="/profile"
                      onClick={closeMobileMenu}
                      className="flex items-center gap-5 py-5 px-6 rounded-2xl bg-[#011112]/60 hover:bg-[#011112] text-[#00F0FF] text-lg font-medium transition"
                    >
                      <User size={24} />
                      {fetchedUsername || 'Profile'}
                    </Link>

                    <Link
                      href="/game-shop"
                      onClick={closeMobileMenu}
                      className="flex items-center gap-5 py-5 px-6 rounded-2xl bg-[#011112]/60 hover:bg-[#011112] text-[#0FF0FC] text-lg font-medium transition"
                    >
                      <ShoppingBag size={24} />
                      Shop
                    </Link>
                  </>
                )}
              </nav>


                {/* Network Switcher - ONLY visible when NOT in MiniPay */}
                {!isMiniPay && (
                  <button
                    onClick={() => {
                      setIsNetworkModalOpen(true);
                      closeMobileMenu();
                    }}
                    className={`w-full py-5 rounded-2xl flex items-center justify-center gap-4 font-orbitron text-lg transition ${
                      isConnected
                        ? 'bg-[#003B3E]/70 hover:bg-[#003B3E] border border-[#00F0FF]/40 text-[#00F0FF]'
                        : 'bg-[#011112]/80 hover:bg-[#011112]/90 border border-[#003B3E]/60 text-[#00F0FF]/90'
                    }`}
                  >
                    <Globe size={24} />
                    <span className="truncate max-w-[220px]">{networkDisplay}</span>
                  </button>
                )}

                {/* Connect / Disconnect buttons - ONLY outside MiniPay */}
                {!isMiniPay && (
                  <div className="mt-6">
                    {!isConnected ? (
                      <button
                        onClick={() => {
                          setIsConnectModalOpen(true);
                          closeMobileMenu();
                        }}
                        className="w-full py-5 rounded-2xl bg-gradient-to-r from-[#00F0FF]/20 to-[#0FF0FC]/20 border border-[#00F0FF]/60 text-[#00F0FF] font-orbitron text-xl font-bold tracking-wide hover:from-[#00F0FF]/30 hover:to-[#0FF0FC]/30 transition"
                      >
                        Connect Wallet
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setIsDisconnectModalOpen(true);
                          closeMobileMenu();
                        }}
                        className="w-full py-5 rounded-2xl bg-red-900/40 hover:bg-red-900/60 border border-red-600/50 text-red-400 font-orbitron text-lg font-medium transition"
                      >
                        Disconnect Wallet
                      </button>
                    )}
                  </div>
                )}

              {/* Close Button */}
              <button
                onClick={closeMobileMenu}
                className="absolute top-5 right-5 w-10 h-10 rounded-full bg-[#011112]/70 flex items-center justify-center text-white hover:bg-[#003B3E]/50 transition"
              >
                <X size={26} />
              </button>
            </div>
          </motion.div>
        </>
      )}

      {/* Modals */}
      <NetworkSwitcherModal
        isOpen={isNetworkModalOpen}
        onClose={() => setIsNetworkModalOpen(false)}
      />
      <WalletConnectModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
      />
      <WalletDisconnectModal
        isOpen={isDisconnectModalOpen}
        onClose={() => setIsDisconnectModalOpen(false)}
      />
    </>
  );
};

export default NavBarMobile;