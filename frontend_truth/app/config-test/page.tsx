"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";

type ConfigTest = {
  CELO_RPC_URL: string | null;
  TYCOON_CELO_CONTRACT_ADDRESS: string | null;
  BACKEND_GAME_CONTROLLER_PRIVATE_KEY: string | null;
  connectionTest?: { ok: boolean; error?: string; blockNumber?: number; walletAddress?: string; balance?: string };
};

type ReadFnSpec = {
  fn: string;
  params: { name: string; placeholder: string; type: "string" | "number" | "address" | "boolean" }[];
};

const READ_FUNCTIONS: ReadFnSpec[] = [
  { fn: "owner", params: [] },
  { fn: "backendGameController", params: [] },
  { fn: "minStake", params: [] },
  { fn: "minTurnsForPerks", params: [] },
  { fn: "totalGames", params: [] },
  { fn: "totalUsers", params: [] },
  { fn: "TOKEN_REWARD", params: [] },
  { fn: "rewardSystem", params: [] },
  { fn: "houseUSDC", params: [] },
  { fn: "getUser", params: [{ name: "username", placeholder: "e.g. alice", type: "string" }] },
  { fn: "getGame", params: [{ name: "gameId", placeholder: "1", type: "number" }] },
  { fn: "getGameByCode", params: [{ name: "code", placeholder: "e.g. ABC123", type: "string" }] },
  { fn: "getGamePlayer", params: [{ name: "gameId", placeholder: "1", type: "number" }, { name: "player", placeholder: "0x...", type: "address" }] },
  { fn: "getPlayersInGame", params: [{ name: "gameId", placeholder: "1", type: "number" }] },
  { fn: "getLastGameCode", params: [{ name: "user", placeholder: "0x...", type: "address" }] },
  { fn: "getGameSettings", params: [{ name: "gameId", placeholder: "1", type: "number" }] },
  { fn: "registered", params: [{ name: "address", placeholder: "0x...", type: "address" }] },
  { fn: "addressToUsername", params: [{ name: "address", placeholder: "0x...", type: "address" }] },
  { fn: "turnsPlayed", params: [{ name: "gameId", placeholder: "1", type: "number" }, { name: "player", placeholder: "0x...", type: "address" }] },
];

const WRITE_FUNCTIONS: ReadFnSpec[] = [
  { fn: "registerPlayer", params: [{ name: "username", placeholder: "e.g. testuser", type: "string" }] },
  { fn: "transferPropertyOwnership", params: [{ name: "sellerUsername", placeholder: "seller", type: "string" }, { name: "buyerUsername", placeholder: "buyer", type: "string" }] },
  { fn: "setTurnCount", params: [{ name: "gameId", placeholder: "1", type: "number" }, { name: "player", placeholder: "0x...", type: "address" }, { name: "count", placeholder: "20", type: "number" }] },
  { fn: "removePlayerFromGame", params: [{ name: "gameId", placeholder: "1", type: "number" }, { name: "player", placeholder: "0x...", type: "address" }, { name: "turnCount", placeholder: "5", type: "number" }] },
  { fn: "createGame", params: [
    { name: "creatorUsername", placeholder: "alice", type: "string" },
    { name: "gameType", placeholder: "PUBLIC or PRIVATE", type: "string" },
    { name: "playerSymbol", placeholder: "hat, car, dog...", type: "string" },
    { name: "numberOfPlayers", placeholder: "2-8", type: "number" },
    { name: "code", placeholder: "ABC123", type: "string" },
    { name: "startingBalance", placeholder: "1500", type: "number" },
    { name: "stakeAmount", placeholder: "0", type: "number" },
  ]},
  { fn: "createAIGame", params: [
    { name: "creatorUsername", placeholder: "alice", type: "string" },
    { name: "gameType", placeholder: "PUBLIC", type: "string" },
    { name: "playerSymbol", placeholder: "hat", type: "string" },
    { name: "numberOfAI", placeholder: "1-7", type: "number" },
    { name: "code", placeholder: "AI1", type: "string" },
    { name: "startingBalance", placeholder: "1500", type: "number" },
  ]},
  { fn: "joinGame", params: [
    { name: "gameId", placeholder: "1", type: "number" },
    { name: "playerUsername", placeholder: "bob", type: "string" },
    { name: "playerSymbol", placeholder: "car", type: "string" },
    { name: "joinCode", placeholder: "ABC123", type: "string" },
  ]},
  { fn: "leavePendingGame", params: [{ name: "gameId", placeholder: "1", type: "number" }] },
  { fn: "exitGame", params: [{ name: "gameId", placeholder: "1", type: "number" }] },
  { fn: "endAIGame", params: [
    { name: "gameId", placeholder: "1", type: "number" },
    { name: "finalPosition", placeholder: "1=win", type: "number" },
    { name: "finalBalance", placeholder: "1500", type: "number" },
    { name: "isWin", placeholder: "true/false", type: "boolean" },
  ]},
  { fn: "setBackendGameController", params: [{ name: "newController", placeholder: "0x...", type: "address" }] },
  { fn: "setMinTurnsForPerks", params: [{ name: "newMin", placeholder: "20", type: "number" }] },
  { fn: "setMinStake", params: [{ name: "newMinStake", placeholder: "0", type: "number" }] },
  { fn: "withdrawHouse", params: [{ name: "amount", placeholder: "0", type: "number" }] },
  { fn: "drainContract", params: [] },
];

export default function ConfigTestPage() {
  const [data, setData] = useState<ConfigTest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [callResult, setCallResult] = useState<{ fn: string; result?: unknown; error?: string } | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, Record<string, string>>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get<ConfigTest & { isConfigured?: boolean; connectionTest?: { ok: boolean; error?: string; blockNumber?: number; walletAddress?: string; balance?: string } }>("config/test", { params: { test_connection: "1" } });
        if (!cancelled && res.data) {
          const d = res.data as ConfigTest & { isConfigured?: boolean };
          setData({
            CELO_RPC_URL: d.CELO_RPC_URL ?? null,
            TYCOON_CELO_CONTRACT_ADDRESS: d.TYCOON_CELO_CONTRACT_ADDRESS ?? null,
            BACKEND_GAME_CONTROLLER_PRIVATE_KEY: d.BACKEND_GAME_CONTROLLER_PRIVATE_KEY ?? null,
            connectionTest: d.connectionTest,
          });
        }
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to fetch");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCall(fn: string, params: ReadFnSpec["params"], write = false) {
    setCallResult(null);
    const vals = params.map((p) => {
      const v = (paramValues[fn] ?? {})[p.name] ?? "";
      if (p.type === "number") return v ? Number(v) : 0;
      if (p.type === "boolean") return v === "true" || v === "1";
      return v;
    });
    try {
      const res = await apiClient.post<{ success: boolean; result?: unknown; error?: string }>("config/call-contract", { fn, params: vals, write });
      const body = res.data as { success: boolean; result?: unknown; error?: string };
      if (body.success) {
        setCallResult({ fn, result: body.result });
      } else {
        setCallResult({ fn, error: body.error });
      }
    } catch (e: unknown) {
      let msg = "Request failed";
      if (e && typeof e === "object" && "response" in e) {
        const res = (e as { response?: { data?: { error?: string } } }).response;
        if (res?.data?.error) msg = res.data.error;
        else if (e instanceof Error) msg = e.message;
      } else if (e instanceof Error) {
        msg = e.message;
      }
      setCallResult({ fn, error: msg });
    }
  }

  function setParam(fn: string, name: string, value: string) {
    setParamValues((prev) => ({ ...prev, [fn]: { ...(prev[fn] ?? {}), [name]: value } }));
  }

  if (loading) {
    return (
      <main className="min-h-screen w-full bg-[#010F10] p-6 text-white">
        <p>Loading...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen w-full bg-[#010F10] p-6 text-white">
        <p className="text-red-400">{error}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full bg-[#010F10] p-6 text-white max-w-2xl">
      <div className="space-y-4">
        <div>
          <span className="text-gray-400 block text-sm mb-1">CELO_RPC_URL</span>
          <code className="block bg-black/30 px-3 py-2 rounded break-all">
            {data?.CELO_RPC_URL ?? "(not set)"}
          </code>
        </div>
        <div>
          <span className="text-gray-400 block text-sm mb-1">TYCOON_CELO_CONTRACT_ADDRESS</span>
          <code className="block bg-black/30 px-3 py-2 rounded break-all">
            {data?.TYCOON_CELO_CONTRACT_ADDRESS ?? "(not set)"}
          </code>
        </div>
        <div>
          <span className="text-gray-400 block text-sm mb-1">BACKEND_GAME_CONTROLLER_PRIVATE_KEY</span>
          <code className="block bg-black/30 px-3 py-2 rounded break-all">
            {data?.BACKEND_GAME_CONTROLLER_PRIVATE_KEY ?? "(not set)"}
          </code>
        </div>
        {data?.connectionTest && (
          <div className="border-t border-gray-700 pt-4 mt-4">
            <span className="text-gray-400 block text-sm mb-2">Connection test</span>
            {data.connectionTest.ok ? (
              <div className="space-y-1 text-green-400 text-sm">
                <p>OK — Block: {data.connectionTest.blockNumber}, Wallet: {data.connectionTest.walletAddress?.slice(0, 10)}...</p>
                <p>Balance: {data.connectionTest.balance} wei</p>
              </div>
            ) : (
              <p className="text-red-400 text-sm">{data.connectionTest.error}</p>
            )}
          </div>
        )}

        <div className="border-t border-gray-700 pt-6 mt-6">
          <h2 className="text-lg font-medium text-gray-200 mb-4">Contract read functions</h2>
          <p className="text-gray-500 text-sm mb-4">Call read-only contract functions via the backend. Enter params where required.</p>
          <div className="space-y-4">
            {READ_FUNCTIONS.map((spec) => (
              <div key={spec.fn} className="bg-black/20 rounded-lg p-3 space-y-2">
                <div className="flex flex-wrap items-end gap-2">
                  <span className="text-amber-400 font-mono text-sm">{spec.fn}</span>
                  {spec.params.map((p) => (
                    <input
                      key={p.name}
                      type="text"
                      placeholder={p.placeholder}
                      value={(paramValues[spec.fn] ?? {})[p.name] ?? ""}
                      onChange={(e) => setParam(spec.fn, p.name, e.target.value)}
                      className="bg-black/40 border border-gray-600 rounded px-2 py-1 text-sm min-w-[120px] focus:border-amber-500 focus:outline-none"
                    />
                  ))}
                  <button
                    onClick={() => handleCall(spec.fn, spec.params, false)}
                    className="px-3 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium"
                  >
                    Call
                  </button>
                </div>
                {callResult?.fn === spec.fn && (
                  <div className="mt-2 p-2 rounded bg-black/40 text-sm font-mono overflow-x-auto">
                    {callResult.error ? (
                      <span className="text-red-400">{callResult.error}</span>
                    ) : (
                      <pre className="text-green-400 whitespace-pre-wrap break-all">
                        {JSON.stringify(callResult.result, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-gray-700 pt-6 mt-6">
          <h2 className="text-lg font-medium text-amber-400/90 mb-2">Contract write functions</h2>
          <p className="text-amber-200/70 text-sm mb-4">
            Sends real transactions — uses gas. Errors will appear below on revert.
          </p>
          <div className="space-y-4">
            {WRITE_FUNCTIONS.map((spec) => (
              <div key={spec.fn} className="bg-black/20 border border-amber-900/50 rounded-lg p-3 space-y-2">
                <div className="flex flex-wrap items-end gap-2">
                  <span className="text-amber-400 font-mono text-sm">{spec.fn}</span>
                  {spec.params.map((p) => (
                    <input
                      key={p.name}
                      type="text"
                      placeholder={p.placeholder}
                      value={(paramValues[spec.fn] ?? {})[p.name] ?? ""}
                      onChange={(e) => setParam(spec.fn, p.name, e.target.value)}
                      className="bg-black/40 border border-gray-600 rounded px-2 py-1 text-sm min-w-[120px] focus:border-amber-500 focus:outline-none"
                    />
                  ))}
                  <button
                    onClick={() => handleCall(spec.fn, spec.params, true)}
                    className="px-3 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-sm font-medium"
                  >
                    Send
                  </button>
                </div>
                {callResult?.fn === spec.fn && (
                  <div className="mt-2 p-2 rounded bg-black/40 text-sm font-mono overflow-x-auto">
                    {callResult.error ? (
                      <span className="text-red-400">{callResult.error}</span>
                    ) : (
                      <pre className="text-green-400 whitespace-pre-wrap break-all">
                        {JSON.stringify(callResult.result, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
