"use client";

import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const ROOM_CODE_LENGTH = 6;
const ROOM_CODE_REGEX = /^[A-Za-z0-9]+$/;

function isValidRoomCode(value: string): boolean {
  const trimmed = value.trim();
  return (
    trimmed.length === ROOM_CODE_LENGTH && ROOM_CODE_REGEX.test(trimmed)
  );
}

export default function JoinRoomForm(): React.JSX.Element {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const normalizedCode = code.trim().toUpperCase();
  const isValid = isValidRoomCode(code);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCode(val.toUpperCase().slice(0, ROOM_CODE_LENGTH));
    setError(null);
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!isValid) {
        setError(`Room code must be ${ROOM_CODE_LENGTH} characters (letters or numbers).`);
        return;
      }
      console.log("Join room code:", normalizedCode);
      // Mock navigation to game waiting room
      router.push(`/game-waiting?gameCode=${encodeURIComponent(normalizedCode)}`);
    },
    [isValid, normalizedCode, router]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label
          htmlFor="room-code"
          className="text-[var(--tycoon-accent)] font-orbitron font-bold"
        >
          Room Code
        </Label>
        <Input
          id="room-code"
          type="text"
          value={code}
          onChange={handleChange}
          placeholder="e.g. TYCOON"
          maxLength={ROOM_CODE_LENGTH}
          autoComplete="off"
          className="bg-[var(--tycoon-bg)] border-[var(--tycoon-border)] text-[var(--tycoon-text)] placeholder:text-[var(--tycoon-text)]/40 focus-visible:ring-[var(--tycoon-accent)] font-orbitron tracking-widest uppercase"
        />
        {error && (
          <p className="text-red-400 text-sm">{error}</p>
        )}
      </div>
      <Button
        type="submit"
        disabled={!isValid}
        className="w-full bg-[var(--tycoon-accent)] text-[var(--tycoon-bg)] font-orbitron font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Join
      </Button>
    </form>
  );
}
