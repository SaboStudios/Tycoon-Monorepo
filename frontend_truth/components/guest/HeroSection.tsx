"use client";
import React, { useEffect, useState, useMemo } from "react";
import herobg from "@/public/heroBg.png";
import Image from "next/image";
import { Dices, Gamepad2, Wallet } from "lucide-react";
import { TypeAnimation } from "react-type-animation";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import {
  useIsRegistered,
  useGetUsername,
  useRegisterPlayer,
  usePreviousGameCode,
  useGetGameByCode,
} from "@/context/ContractProvider";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";
import { toast } from "react-toastify";
import { apiClient } from "@/lib/api";
import { User as UserType } from "@/lib/types/users";
import { ApiResponse } from "@/types/api";

const HeroSection: React.FC = () => {
  const router = useRouter();
  const { address, isConnecting } = useAccount();
  const guestAuth = useGuestAuthOptional();
  const guestUser = guestAuth?.guestUser ?? null;

  const [loading, setLoading] = useState(false);
  const [inputUsername, setInputUsername] = useState("");
  const [localRegistered, setLocalRegistered] = useState(false);
  const [localUsername, setLocalUsername] = useState("");
  const [guestUsername, setGuestUsername] = useState("");
  const [guestPassword, setGuestPassword] = useState("");
  const [guestLoading, setGuestLoading] = useState(false);

  const {
    write: registerPlayer,
    isPending: registerPending,
  } = useRegisterPlayer();

  const {
    data: isUserRegistered,
    isLoading: isRegisteredLoading,
    error: registeredError,
  } = useIsRegistered(address);

  const { data: fetchedUsername } = useGetUsername(address);

  const { data: gameCode } = usePreviousGameCode(address);

  const { data: contractGame } = useGetGameByCode(gameCode);

  const [backendGame, setBackendGame] = useState<{ status: string } | null>(null);
  const [guestLastGame, setGuestLastGame] = useState<{ code: string; status: string } | null>(null);

  useEffect(() => {
    if (!gameCode || typeof gameCode !== "string") {
      setBackendGame(null);
      return;
    }
    let cancelled = false;
    apiClient
      .get<ApiResponse>(`/games/code/${encodeURIComponent(gameCode.trim().toUpperCase())}`)
      .then((res) => {
        if (cancelled || !res?.data?.success || !res.data.data) return;
        setBackendGame(res.data.data as { status: string });
      })
      .catch(() => {
        if (!cancelled) setBackendGame(null);
      });
    return () => {
      cancelled = true;
    };
  }, [gameCode]);

  // Guest: fetch "my games" so they can continue their last game
  useEffect(() => {
    if (!guestUser || address) {
      setGuestLastGame(null);
      return;
    }
    let cancelled = false;
    apiClient
      .get<ApiResponse>("/games/my-games", { params: { limit: 10 } })
      .then((res) => {
        if (cancelled || !res?.data?.success || !Array.isArray(res.data.data)) return;
        const games = res.data.data as { code: string; status: string }[];
        const active = games.find((g) => g.status === "RUNNING");
        setGuestLastGame(active ? { code: active.code, status: active.status } : null);
      })
      .catch(() => {
        if (!cancelled) setGuestLastGame(null);
      });
    return () => {
      cancelled = true;
    };
  }, [guestUser, address]);

  const [user, setUser] = useState<UserType | null>(null);

  // Reset on disconnect
  useEffect(() => {
    if (!address) {
      setUser(null);
      setLocalRegistered(false);
      setLocalUsername("");
      setInputUsername("");
    }
  }, [address]);

  // Fetch backend user
  useEffect(() => {
    if (!address) return;

    let isActive = true;

    const fetchUser = async () => {
      try {
        const res = await apiClient.get<ApiResponse>(
          `/users/by-address/${address}?chain=Base`
        );

        if (!isActive) return;

        if (res.success && res.data) {
          setUser(res.data as UserType);
        } else {
          setUser(null);
        }
      } catch (error: any) {
        if (!isActive) return;
        if (error?.response?.status === 404) {
          setUser(null);
        } else {
          console.error("Error fetching user:", error);
        }
      }
    };

    fetchUser();

    return () => {
      isActive = false;
    };
  }, [address]);

  const registrationStatus = useMemo(() => {
    if (address) {
      const hasBackend = !!user;
      const hasOnChain = !!isUserRegistered || localRegistered;
      if (hasBackend && hasOnChain) return "fully-registered";
      if (hasBackend && !hasOnChain) return "backend-only";
      return "none";
    }
    if (guestUser) return "guest";
    return "disconnected";
  }, [address, user, isUserRegistered, localRegistered, guestUser]);

  const displayUsername = useMemo(() => {
    if (guestUser) return guestUser.username;
    return (
      user?.username ||
      localUsername ||
      fetchedUsername ||
      inputUsername ||
      "Player"
    );
  }, [guestUser, user, localUsername, fetchedUsername, inputUsername]);

  // Handle registration (on-chain + backend if needed)
  const handleRegister = async () => {
    if (!address) {
      toast.error("Please connect your wallet");
      return;
    }

    let finalUsername = inputUsername.trim();

    // If backend user exists but not on-chain → use backend username
    if (registrationStatus === "backend-only" && user?.username) {
      finalUsername = user.username.trim();
    }

    if (!finalUsername) {
      toast.warn("Please enter a username");
      return;
    }

    setLoading(true);
    const toastId = toast.loading("Processing registration...");

    try {
      // Register on-chain if not already
      if (!isUserRegistered && !localRegistered) {
        await registerPlayer(finalUsername);
      }

      // Create backend user if doesn't exist
      if (!user) {
        const res = await apiClient.post<ApiResponse>("/users", {
          username: finalUsername,
          address,
          chain: "Base",
        });

        if (!res?.success) throw new Error("Failed to save user on backend");
        setUser({ username: finalUsername } as UserType); // optimistic
      }

      // Optimistic updates
      setLocalRegistered(true);
      setLocalUsername(finalUsername);

      toast.update(toastId, {
        render: "Welcome to Tycoon!",
        type: "success",
        isLoading: false,
        autoClose: 4000,
      });

      router.refresh();
    } catch (err: any) {
      if (
        err?.code === 4001 ||
        err?.message?.includes("User rejected") ||
        err?.message?.includes("User denied")
      ) {
        toast.update(toastId, {
          render: "Transaction cancelled",
          type: "info",
          isLoading: false,
          autoClose: 3500,
        });
        return;
      }

      let message = "Registration failed. Try again.";
      if (err?.shortMessage) message = err.shortMessage;
      if (err?.message?.includes("insufficient funds")) message = "Insufficient gas funds";

      toast.update(toastId, {
        render: message,
        type: "error",
        isLoading: false,
        autoClose: 6000,
      });
    } finally {
      setLoading(false);
    }
  };

const handleContinuePrevious = () => {
  if (guestUser && guestLastGame) {
    if (guestLastGame.status === "PENDING") {
      router.push(`/game-waiting?gameCode=${encodeURIComponent(guestLastGame.code)}`);
    } else {
      router.push(`/game-play?gameCode=${encodeURIComponent(guestLastGame.code)}`);
    }
    return;
  }
  if (!gameCode) return;

  if (contractGame?.ai) {
    router.push(`/ai-play?gameCode=${gameCode}`);
  } else {
    router.push(`/game-play?gameCode=${gameCode}`);
  }
};

  if (isConnecting) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <p className="font-orbitron text-[#00F0FF] text-[16px]">
          Connecting to wallet...
        </p>
      </div>
    );
  }

  return (
    <section className="z-0 w-full lg:h-screen md:h-[calc(100vh-87px)] h-screen relative overflow-x-hidden md:mb-20 mb-10 bg-[#010F10]">
      <div className="w-full h-full overflow-hidden">
        <Image
          src={herobg}
          alt="Hero Background"
          className="w-full h-full object-cover hero-bg-zoom"
          width={1440}
          height={1024}
          priority
          quality={100}
        />
      </div>

      <div className="w-full h-auto absolute top-0 left-0 flex items-center justify-center">
        <h1 className="text-center uppercase font-kronaOne font-normal text-transparent big-hero-text w-full text-[40px] sm:text-[40px] md:text-[80px] lg:text-[135px] relative before:absolute before:content-[''] before:w-full before:h-full before:bg-gradient-to-b before:from-transparent lg:before:via-[#010F10]/80 before:to-[#010F10] before:top-0 before:left-0 before:z-1">
          TYCOON
        </h1>
      </div>

      <main className="w-full h-full absolute top-0 left-0 z-2 bg-transparent flex flex-col lg:justify-center items-center gap-1">
        {/* Welcome Message */}
        {(registrationStatus === "fully-registered" || registrationStatus === "backend-only" || registrationStatus === "guest") && !loading && (
          <div className="mt-20 md:mt-28 lg:mt-0">
            <p className="font-orbitron lg:text-[24px] md:text-[20px] text-[16px] font-[700] text-[#00F0FF] text-center">
              Welcome back, {displayUsername}!
            </p>
          </div>
        )}

        {loading && (
          <div className="mt-20 md:mt-28 lg:mt-0">
            <p className="font-orbitron lg:text-[24px] md:text-[20px] text-[16px] font-[700] text-[#00F0FF] text-center">
              Registering... Please wait.
            </p>
          </div>
        )}

        <div className="flex justify-center items-center md:gap-6 gap-3 mt-4 md:mt-6 lg:mt-4">
          <TypeAnimation
            sequence={[
              "Conquer",
              1200,
              "Conquer • Build",
              1200,
              "Conquer • Build • Trade On",
              1800,
              "Play Solo vs AI",
              2000,
              "Conquer • Build",
              1000,
              "Conquer",
              1000,
              "",
              500,
            ]}
            wrapper="span"
            speed={40}
            repeat={Infinity}
            className="font-orbitron lg:text-[40px] md:text-[30px] text-[20px] font-[700] text-[#F0F7F7] text-center block"
          />
        </div>

        <h1 className="block-text font-[900] font-orbitron lg:text-[116px] md:text-[98px] text-[54px] lg:leading-[120px] md:leading-[100px] leading-[60px] tracking-[-0.02em] uppercase text-[#17ffff] relative">
          TYCOON
          <span className="absolute top-0 left-[69%] text-[#0FF0FC] font-dmSans font-[700] md:text-[27px] text-[18px] rotate-12 animate-pulse">
            ?
          </span>
        </h1>

        <div className="w-full px-4 md:w-[70%] lg:w-[55%] text-center text-[#F0F7F7] -tracking-[2%]">
          <TypeAnimation
            sequence={[
              "Roll the dice",
              2000,
              "Buy properties",
              2000,
              "Collect rent",
              2000,
              "Play against AI opponents",
              2200,
              "Become the top tycoon",
              2000,
            ]}
            wrapper="span"
            speed={50}
            repeat={Infinity}
            className="font-orbitron lg:text-[40px] md:text-[30px] text-[20px] font-[700] text-[#F0F7F7] text-center block"
          />
          <p className="font-dmSans font-[400] md:text-[18px] text-[14px] text-[#F0F7F7] mt-4">
            Step into Tycoon — the Web3 twist on the classic game of strategy,
            ownership, and fortune. Play solo against AI, compete in multiplayer
            rooms, collect tokens, complete quests, and become the ultimate
            blockchain tycoon.
          </p>
        </div>

        <div className="z-1 w-full flex flex-col justify-center items-center mt-6 gap-4">
          {/* Wallet: username input for new users */}
          {address && registrationStatus === "none" && !loading && (
            <input
              type="text"
              value={inputUsername}
              onChange={(e) => setInputUsername(e.target.value)}
              placeholder="Choose your tycoon name"
              className="w-[80%] md:w-[260px] h-[45px] bg-[#0E1415] rounded-[12px] border-[1px] border-[#003B3E] outline-none px-3 text-[#17ffff] font-orbitron font-[400] text-[16px] text-center placeholder:text-[#455A64] placeholder:font-dmSans"
            />
          )}

          {/* Guest: login/register form when no wallet and not guest yet */}
          {!address && registrationStatus === "disconnected" && !loading && (
            <div className="w-[80%] md:w-[320px] flex flex-col gap-3 p-4 rounded-xl bg-[#0E1415]/90 border border-[#003B3E]">
              <p className="text-[#00F0FF] font-orbitron text-sm font-bold text-center">Play without a wallet</p>
              <input
                type="text"
                value={guestUsername}
                onChange={(e) => setGuestUsername(e.target.value)}
                placeholder="Username"
                className="h-[42px] bg-[#010F10] rounded-lg border border-[#003B3E] px-3 text-[#17ffff] font-orbitron text-sm placeholder:text-[#455A64]"
              />
              <input
                type="password"
                value={guestPassword}
                onChange={(e) => setGuestPassword(e.target.value)}
                placeholder="Password"
                className="h-[42px] bg-[#010F10] rounded-lg border border-[#003B3E] px-3 text-[#17ffff] font-orbitron text-sm placeholder:text-[#455A64]"
              />
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    if (!guestUsername.trim() || !guestPassword) {
                      toast.warn("Enter username and password");
                      return;
                    }
                    setGuestLoading(true);
                    const r = await guestAuth?.registerGuest(guestUsername.trim(), guestPassword);
                    setGuestLoading(false);
                    if (r?.success) {
                      toast.success("Account created! You can play until you connect a wallet.");
                    } else {
                      toast.error(r?.message ?? "Registration failed");
                    }
                  }}
                  disabled={guestLoading}
                  className="flex-1 h-[42px] rounded-lg bg-[#003B3E] text-[#00F0FF] font-orbitron text-sm font-bold hover:bg-[#004B4F] disabled:opacity-60"
                >
                  {guestLoading ? "..." : "Register"}
                </button>
                <button
                  onClick={async () => {
                    if (!guestUsername.trim() || !guestPassword) {
                      toast.warn("Enter username and password");
                      return;
                    }
                    setGuestLoading(true);
                    const r = await guestAuth?.loginGuest(guestUsername.trim(), guestPassword);
                    setGuestLoading(false);
                    if (r?.success) {
                      toast.success("Welcome back!");
                    } else {
                      toast.error(r?.message ?? "Login failed");
                    }
                  }}
                  disabled={guestLoading}
                  className="flex-1 h-[42px] rounded-lg bg-[#00F0FF] text-[#010F10] font-orbitron text-sm font-bold hover:opacity-90 disabled:opacity-60"
                >
                  {guestLoading ? "..." : "Login"}
                </button>
              </div>
            </div>
          )}

          {/* "Let's Go!" for wallet users (backend-only or none) */}
          {address && registrationStatus !== "fully-registered" && !loading && (
            <button
              onClick={handleRegister}
              disabled={
                loading ||
                registerPending ||
                (registrationStatus === "none" && !inputUsername.trim())
              }
              className="relative group w-[260px] h-[52px] bg-transparent border-none p-0 overflow-hidden cursor-pointer disabled:opacity-60"
            >
              <svg
                width="260"
                height="52"
                viewBox="0 0 260 52"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="absolute top-0 left-0 w-full h-full transform scale-x-[-1]"
              >
                <path
                  d="M10 1H250C254.373 1 256.996 6.85486 254.601 10.5127L236.167 49.5127C235.151 51.0646 233.42 52 231.565 52H10C6.96244 52 4.5 49.5376 4.5 46.5V9.5C4.5 6.46243 6.96243 4 10 4Z"
                  fill="#00F0FF"
                  stroke="#0E282A"
                  strokeWidth={1}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[#010F10] text-[18px] -tracking-[2%] font-orbitron font-[700] z-2">
                {loading || registerPending ? "Registering..." : "Let's Go!"}
              </span>
            </button>
          )}

          {/* Action buttons: wallet registered OR guest */}
          {(address && registrationStatus === "fully-registered") || (registrationStatus === "guest" && guestUser) ? (
            <div className="flex flex-wrap justify-center items-center gap-4">
              {/* Continue Previous Game - Highlighted (wallet: from contract; guest: from my-games) */}
              {((address && gameCode && (contractGame?.status == 1) && (!backendGame || (backendGame.status !== "FINISHED" && backendGame.status !== "COMPLETED" && backendGame.status !== "CANCELLED"))) ||
                (guestUser && guestLastGame && guestLastGame.status !== "COMPLETED" && guestLastGame.status !== "CANCELLED")) && (
                <button
                  onClick={handleContinuePrevious}
                  className="relative group w-[300px] h-[56px] bg-transparent border-none p-0 overflow-hidden cursor-pointer transition-transform group-hover:scale-105"
                >
                  <svg
                    width="300"
                    height="56"
                    viewBox="0 0 300 56"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="absolute top-0 left-0 w-full h-full transform scale-x-[-1] group-hover:animate-pulse"
                  >
                    <path
                      d="M12 1H288C293.373 1 296 7.85486 293.601 12.5127L270.167 54.5127C269.151 56.0646 267.42 57 265.565 57H12C8.96244 57 6.5 54.5376 6.5 51.5V9.5C6.5 6.46243 8.96243 4 12 4Z"
                      fill="#00F0FF"
                      stroke="#0E282A"
                      strokeWidth={2}
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[#010F10] text-[20px] font-orbitron font-[700] z-2">
                    <Gamepad2 className="mr-2 w-7 h-7" />
                    Continue Game
                  </span>
                </button>
              )}

              {/* Play with Friends */}
              <button
                onClick={() => router.push("/game-settings")}
                className="relative group w-[227px] h-[40px] bg-transparent border-none p-0 overflow-hidden cursor-pointer"
              >
                <svg
                  width="227"
                  height="40"
                  viewBox="0 0 227 40"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="absolute top-0 left-0 w-full h-full transform scale-x-[-1] scale-y-[-1]"
                >
                  <path
                    d="M6 1H221C225.373 1 227.996 5.85486 225.601 9.5127L207.167 37.5127C206.151 39.0646 204.42 40 202.565 40H6C2.96244 40 0.5 37.5376 0.5 34.5V6.5C0.5 3.46243 2.96243 1 6 1Z"
                    fill="#003B3E"
                    stroke="#003B3E"
                    strokeWidth={1}
                    className="group-hover:stroke-[#00F0FF] transition-all duration-300"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[#00F0FF] capitalize text-[12px] font-dmSans font-medium z-2">
                  <Gamepad2 className="mr-1.5 w-[16px] h-[16px]" />
                  Multiplayer
                </span>
              </button>

              {/* Join Room */}
              <button
                onClick={() => router.push("/join-room")}
                className="relative group w-[140px] h-[40px] bg-transparent border-none p-0 overflow-hidden cursor-pointer"
              >
                <svg
                  width="140"
                  height="40"
                  viewBox="0 0 140 40"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="absolute top-0 left-0 w-full h-full"
                >
                  <path
                    d="M6 1H134C138.373 1 140.996 5.85486 138.601 9.5127L120.167 37.5127C119.151 39.0646 117.42 40 115.565 40H6C2.96244 40 0.5 37.5376 0.5 34.5V6.5C0.5 3.46243 2.96243 1 6 1Z"
                    fill="#0E1415"
                    stroke="#003B3E"
                    strokeWidth={1}
                    className="group-hover:stroke-[#00F0FF] transition-all duration-300"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[#0FF0FC] capitalize text-[12px] font-dmSans font-medium z-2">
                  <Dices className="mr-1.5 w-[16px] h-[16px]" />
                  Join Room
                </span>
              </button>

              {guestUser && (
                <button
                  onClick={() => guestAuth?.logoutGuest()}
                  className="text-[#869298] hover:text-[#00F0FF] font-dmSans text-xs"
                >
                  Sign out (guest)
                </button>
              )}

              {/* Challenge AI */}
              <button
                onClick={() => router.push("/play-ai")}
                className="relative group w-[260px] h-[52px] bg-transparent border-none p-0 overflow-hidden cursor-pointer transition-transform duration-300 group-hover:scale-105"
              >
                <svg
                  width="260"
                  height="52"
                  viewBox="0 0 260 52"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="absolute top-0 left-0 w-full h-full transform scale-x-[-1] group-hover:animate-pulse"
                >
                  <path
                    d="M10 1H250C254.373 1 256.996 6.85486 254.601 10.5127L236.167 49.5127C235.151 51.0646 233.42 52 231.565 52H10C6.96244 52 4.5 49.5376 4.5 46.5V9.5C4.5 6.46243 6.96243 4 10 4Z"
                    fill="#00F0FF"
                    stroke="#0E282A"
                    strokeWidth={1}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[#010F10] uppercase text-[16px] -tracking-[2%] font-orbitron font-[700] z-2">
                  Challenge AI!
                </span>
              </button>
            </div>
          ) : null}

          {!address && !guestUser && (
            <p className="text-gray-400 text-sm text-center mt-4">
              Connect your wallet or play without a wallet above.
            </p>
          )}
        </div>
      </main>
    </section>
  );
};

export default HeroSection;