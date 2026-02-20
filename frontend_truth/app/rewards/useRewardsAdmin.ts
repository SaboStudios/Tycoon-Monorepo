"use client";

import { useState, useEffect } from "react";
import {
  useAccount,
  useChainId,
  useReadContract,
  useReadContracts,
} from "wagmi";
import { parseUnits, formatUnits, type Address, type Abi } from "viem";
import RewardABI from "@/context/abi/rewardabi.json";
import {
  REWARD_CONTRACT_ADDRESSES,
  USDC_TOKEN_ADDRESS,
  TYC_TOKEN_ADDRESS,
} from "@/constants/contracts";
import {
  useRewardSetBackendMinter,
  useRewardMintVoucher,
  useRewardMintCollectible,
  useRewardStockShop,
  useRewardRestockCollectible,
  useRewardUpdateCollectiblePrices,
  useRewardPause,
  useRewardWithdrawFunds,
  useTycoonAdminReads,
  useTycoonSetMinStake,
  useTycoonSetMinTurnsForPerks,
  useTycoonSetBackendGameController,
} from "@/context/ContractProvider";
import { apiClient } from "@/lib/api";
import { ApiResponse } from "@/types/api";
import {
  CollectiblePerk,
  PERK_NAMES,
  ERC20_ABI,
  INITIAL_COLLECTIBLES,
} from "@/components/rewards/rewardsConstants";

export type RewardsSection = "overview" | "mint" | "stock" | "manage" | "funds" | "tycoon";

export interface RewardsAdminState {
  activeSection: RewardsSection;
  status: { type: "success" | "error" | "info"; message: string } | null;
  isPaused: boolean;
  backendMinter: Address | null;
  owner: Address | null;
  totalGames: number;
  totalUsers: number;
  newMinter: string;
  voucherRecipient: string;
  voucherValue: string;
  collectibleRecipient: string;
  selectedPerk: CollectiblePerk;
  collectibleStrength: string;
  restockTokenId: string;
  restockAmount: string;
  updateTokenId: string;
  updateTycPrice: string;
  updateUsdcPrice: string;
  withdrawToken: "TYC" | "USDC";
  withdrawAmount: string;
  withdrawTo: string;
  tycoonMinStake: string;
  tycoonMinTurnsForPerks: string;
  tycoonGameController: string;
}

export interface TokenDisplayItem {
  tokenId: bigint;
  perk?: CollectiblePerk;
  name: string;
  type: "voucher" | "collectible";
  tycPrice: bigint;
  usdcPrice: bigint;
  stock: bigint;
}

export function useRewardsAdmin() {
  const { address: userAddress, isConnected } = useAccount();
  const chainId = useChainId();

  const contractAddress = REWARD_CONTRACT_ADDRESSES[
    chainId as keyof typeof REWARD_CONTRACT_ADDRESSES
  ] as Address | undefined;
  const usdcAddress = USDC_TOKEN_ADDRESS[
    chainId as keyof typeof USDC_TOKEN_ADDRESS
  ] as Address | undefined;
  const tycAddress = TYC_TOKEN_ADDRESS[
    chainId as keyof typeof TYC_TOKEN_ADDRESS
  ] as Address | undefined;

  const [activeSection, setActiveSection] = useState<RewardsSection>("overview");
  const [status, setStatus] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [backendMinter, setBackendMinter] = useState<Address | null>(null);
  const [owner, setOwner] = useState<Address | null>(null);
  const [totalGames, setTotalGames] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);

  const [newMinter, setNewMinter] = useState("");
  const [voucherRecipient, setVoucherRecipient] = useState("");
  const [voucherValue, setVoucherValue] = useState("");
  const [collectibleRecipient, setCollectibleRecipient] = useState("");
  const [selectedPerk, setSelectedPerk] = useState<CollectiblePerk>(
    CollectiblePerk.EXTRA_TURN
  );
  const [collectibleStrength, setCollectibleStrength] = useState("1");
  const [restockTokenId, setRestockTokenId] = useState("");
  const [restockAmount, setRestockAmount] = useState("50");
  const [updateTokenId, setUpdateTokenId] = useState("");
  const [updateTycPrice, setUpdateTycPrice] = useState("");
  const [updateUsdcPrice, setUpdateUsdcPrice] = useState("");
  const [withdrawToken, setWithdrawToken] = useState<"TYC" | "USDC">("TYC");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawTo, setWithdrawTo] = useState("");
  const [tycoonMinStake, setTycoonMinStake] = useState("");
  const [tycoonMinTurnsForPerks, setTycoonMinTurnsForPerks] = useState("");
  const [tycoonGameController, setTycoonGameController] = useState("");

  const setMinterHook = useRewardSetBackendMinter();
  const tycoonReads = useTycoonAdminReads();
  const tycoonSetMinStakeHook = useTycoonSetMinStake();
  const tycoonSetMinTurnsHook = useTycoonSetMinTurnsForPerks();
  const tycoonSetControllerHook = useTycoonSetBackendGameController();
  const mintVoucherHook = useRewardMintVoucher();
  const mintCollectibleHook = useRewardMintCollectible();
  const stockShopHook = useRewardStockShop();
  const restockHook = useRewardRestockCollectible();
  const updateHook = useRewardUpdateCollectiblePrices();
  const pauseHook = useRewardPause();
  const withdrawHook = useRewardWithdrawFunds();

  const pausedResult = useReadContract({
    address: contractAddress,
    abi: RewardABI,
    functionName: "paused",
    query: { enabled: !!contractAddress },
  });

  const backendMinterResult = useReadContract({
    address: contractAddress,
    abi: RewardABI,
    functionName: "backendMinter",
    query: { enabled: !!contractAddress },
  });

  const ownerResult = useReadContract({
    address: contractAddress,
    abi: RewardABI,
    functionName: "owner",
    query: { enabled: !!contractAddress },
  });

  const tycBalance = useReadContract({
    address: tycAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: contractAddress ? [contractAddress] : undefined,
    query: { enabled: !!contractAddress && !!tycAddress },
  });

  const usdcBalance = useReadContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: contractAddress ? [contractAddress] : undefined,
    query: { enabled: !!contractAddress && !!usdcAddress },
  });

  const contractTokenCount = useReadContract({
    address: contractAddress,
    abi: RewardABI,
    functionName: "ownedTokenCount",
    args: contractAddress ? [contractAddress] : undefined,
    query: { enabled: !!contractAddress },
  });

  const tokenCount = Number(contractTokenCount.data ?? 0);

  const tokenOfOwnerCalls = Array.from({ length: tokenCount }, (_, i) => ({
    address: contractAddress!,
    abi: RewardABI as Abi,
    functionName: "tokenOfOwnerByIndex",
    args: [contractAddress!, BigInt(i)],
  } as const));

  const tokenIdResults = useReadContracts({
    contracts: tokenOfOwnerCalls,
    allowFailure: true,
    query: { enabled: !!contractAddress && tokenCount > 0 },
  });

  const allTokenIds =
    tokenIdResults.data
      ?.map((res) =>
        res.status === "success" ? res.result : undefined
      )
      .filter((id): id is bigint => id !== undefined) ?? [];

  const collectibleInfoCalls = allTokenIds.map((tokenId) => ({
    address: contractAddress!,
    abi: RewardABI as Abi,
    functionName: "getCollectibleInfo",
    args: [tokenId],
  } as const));

  const tokenInfoResults = useReadContracts({
    contracts: collectibleInfoCalls,
    allowFailure: true,
    query: { enabled: !!contractAddress && allTokenIds.length > 0 },
  });

  const allTokens: TokenDisplayItem[] =
    (tokenInfoResults.data
      ?.map((result, index) => {
        if (result?.status !== "success") return null;
        const [perk, , tycPrice, usdcPrice, stock] = result.result as [
          number,
          bigint,
          bigint,
          bigint,
          bigint
        ];
        const tokenId = allTokenIds[index];
        const isVoucher = tokenId < 2_000_000_000;

        return {
          tokenId,
          perk: !isVoucher ? (perk as CollectiblePerk) : undefined,
          name: isVoucher
            ? `Voucher #${tokenId.toString()}`
            : PERK_NAMES[perk as CollectiblePerk] || `Collectible #${perk}`,
          type: isVoucher ? "voucher" : "collectible",
          tycPrice,
          usdcPrice,
          stock,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null) ?? []) as TokenDisplayItem[];

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const gamesRes = await apiClient.get<ApiResponse>("/games");
        setTotalGames(gamesRes.data?.data.length ?? 0);
        const usersRes = await apiClient.get<unknown[]>("/users");
        setTotalUsers(Array.isArray(usersRes.data) ? usersRes.data.length : 0);
      } catch (error) {
        console.error("Failed to fetch platform stats:", error);
      }
    };
    fetchStats();
  }, []);

  useEffect(() => {
    setIsPaused(!!pausedResult.data);
    setBackendMinter((backendMinterResult.data as Address) ?? null);
    setOwner((ownerResult.data as Address) ?? null);
    setWithdrawTo((ownerResult.data as string) ?? "");
  }, [pausedResult.data, backendMinterResult.data, ownerResult.data]);

  useEffect(() => {
    if (tycoonReads.minStake != null) setTycoonMinStake(formatUnits(tycoonReads.minStake, 6));
    if (tycoonReads.minTurnsForPerks != null) setTycoonMinTurnsForPerks(tycoonReads.minTurnsForPerks.toString());
    if (tycoonReads.backendGameController != null)
      setTycoonGameController(tycoonReads.backendGameController === "0x0000000000000000000000000000000000000000" ? "" : tycoonReads.backendGameController);
  }, [tycoonReads.minStake, tycoonReads.minTurnsForPerks, tycoonReads.backendGameController]);

  useEffect(() => {
    const successes = [
      setMinterHook.isSuccess,
      mintVoucherHook.isSuccess,
      mintCollectibleHook.isSuccess,
      stockShopHook.isSuccess,
      restockHook.isSuccess,
      updateHook.isSuccess,
      pauseHook.isSuccess,
      withdrawHook.isSuccess,
      tycoonSetMinStakeHook.isSuccess,
      tycoonSetMinTurnsHook.isSuccess,
      tycoonSetControllerHook.isSuccess,
    ];
    if (successes.some(Boolean)) {
      setStatus({ type: "success", message: "Transaction successful!" });
      setMinterHook.reset?.();
      mintVoucherHook.reset?.();
      mintCollectibleHook.reset?.();
      stockShopHook.reset?.();
      restockHook.reset?.();
      updateHook.reset?.();
      pauseHook.reset?.();
      withdrawHook.reset?.();
      tycoonSetMinStakeHook.reset?.();
      tycoonSetMinTurnsHook.reset?.();
      tycoonSetControllerHook.reset?.();
    }
  }, [
    setMinterHook.isSuccess,
    mintVoucherHook.isSuccess,
    mintCollectibleHook.isSuccess,
    stockShopHook.isSuccess,
    restockHook.isSuccess,
    updateHook.isSuccess,
    pauseHook.isSuccess,
    withdrawHook.isSuccess,
    tycoonSetMinStakeHook.isSuccess,
    tycoonSetMinTurnsHook.isSuccess,
    tycoonSetControllerHook.isSuccess,
  ]);

  useEffect(() => {
    const errors = [
      setMinterHook.error,
      mintVoucherHook.error,
      mintCollectibleHook.error,
      stockShopHook.error,
      restockHook.error,
      updateHook.error,
      pauseHook.error,
      withdrawHook.error,
      tycoonSetMinStakeHook.error,
      tycoonSetMinTurnsHook.error,
      tycoonSetControllerHook.error,
    ].filter(Boolean);
    if (errors.length > 0) {
      setStatus({
        type: "error",
        message: (errors[0] as Error)?.message || "Transaction failed",
      });
    }
  }, [
    setMinterHook.error,
    mintVoucherHook.error,
    mintCollectibleHook.error,
    stockShopHook.error,
    restockHook.error,
    updateHook.error,
    pauseHook.error,
    withdrawHook.error,
    tycoonSetMinStakeHook.error,
    tycoonSetMinTurnsHook.error,
    tycoonSetControllerHook.error,
  ]);

  const handleSetBackendMinter = async () => {
    if (!newMinter) return;
    await setMinterHook.setMinter(newMinter as Address);
    setNewMinter("");
  };

  const handleMintVoucher = async () => {
    if (!voucherRecipient || !voucherValue) return;
    const valueWei = parseUnits(voucherValue, 18);
    await mintVoucherHook.mint(voucherRecipient as Address, valueWei);
    setVoucherRecipient("");
    setVoucherValue("");
  };

  const handleMintCollectible = async () => {
    if (!collectibleRecipient) return;
    await mintCollectibleHook.mint(
      collectibleRecipient as Address,
      selectedPerk,
      Number(collectibleStrength || 1)
    );
    setCollectibleRecipient("");
    setCollectibleStrength("1");
  };

  const handleStockShop = async (perk: CollectiblePerk, strength: number) => {
    const selectedItem = INITIAL_COLLECTIBLES.find(
      (item) => item.perk === perk && item.strength === strength
    );
    const tycPrice = selectedItem
      ? parseUnits(selectedItem.tycPrice, 18)
      : parseUnits("1.0", 18);
    const usdcPrice = selectedItem
      ? parseUnits(selectedItem.usdcPrice, 6)
      : parseUnits("0.20", 6);
    await stockShopHook.stock(
      50,
      perk,
      strength,
      Number(tycPrice),
      Number(usdcPrice)
    );
  };

  const handleRestock = async () => {
    if (!restockTokenId || !restockAmount) return;
    await restockHook.restock(
      BigInt(restockTokenId),
      BigInt(restockAmount)
    );
    setRestockTokenId("");
    setRestockAmount("50");
  };

  const handleUpdatePrices = async () => {
    if (!updateTokenId) return;
    const tycWei = updateTycPrice ? parseUnits(updateTycPrice, 18) : BigInt(0);
    const usdcWei = updateUsdcPrice ? parseUnits(updateUsdcPrice, 6) : BigInt(0);
    await updateHook.update(BigInt(updateTokenId), tycWei, usdcWei);
    setUpdateTokenId("");
    setUpdateTycPrice("");
    setUpdateUsdcPrice("");
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || !withdrawTo || !tycAddress || !usdcAddress) return;
    const tokenAddr = withdrawToken === "TYC" ? tycAddress : usdcAddress;
    const decimals = withdrawToken === "TYC" ? 18 : 6;
    const amountWei = parseUnits(withdrawAmount, decimals);
    await withdrawHook.withdraw(tokenAddr, withdrawTo as Address, amountWei);
    setWithdrawAmount("");
  };

  const handleSetTycoonMinStake = async () => {
    if (!tycoonMinStake) return;
    const wei = parseUnits(tycoonMinStake, 6);
    await tycoonSetMinStakeHook.setMinStake(wei);
  };

  const handleSetTycoonMinTurnsForPerks = async () => {
    if (tycoonMinTurnsForPerks === "") return;
    await tycoonSetMinTurnsHook.setMinTurnsForPerks(BigInt(tycoonMinTurnsForPerks));
  };

  const handleSetTycoonGameController = async () => {
    const addr = tycoonGameController.trim();
    if (!addr) return;
    await tycoonSetControllerHook.setBackendGameController(addr as Address);
  };

  const anyPending =
    setMinterHook.isPending ||
    mintVoucherHook.isPending ||
    mintCollectibleHook.isPending ||
    stockShopHook.isPending ||
    restockHook.isPending ||
    updateHook.isPending ||
    pauseHook.isPending ||
    withdrawHook.isPending ||
    tycoonSetMinStakeHook.isPending ||
    tycoonSetMinTurnsHook.isPending ||
    tycoonSetControllerHook.isPending;

  const currentTxHash =
    setMinterHook.txHash ||
    mintVoucherHook.txHash ||
    mintCollectibleHook.txHash ||
    stockShopHook.txHash ||
    restockHook.txHash ||
    updateHook.txHash ||
    pauseHook.txHash ||
    withdrawHook.txHash ||
    tycoonSetMinStakeHook.txHash ||
    tycoonSetMinTurnsHook.txHash ||
    tycoonSetControllerHook.txHash;

  return {
    auth: {
      isConnected: !!isConnected && !!userAddress,
      userAddress,
      contractAddress,
      chainId,
      owner,
      isOwner: !owner || (userAddress && owner.toLowerCase() === userAddress.toLowerCase()),
    },
    state: {
      activeSection,
      setActiveSection,
      status,
      isPaused,
      backendMinter,
      owner,
      totalGames,
      totalUsers,
      newMinter,
      setNewMinter,
      voucherRecipient,
      setVoucherRecipient,
      voucherValue,
      setVoucherValue,
      collectibleRecipient,
      setCollectibleRecipient,
      selectedPerk,
      setSelectedPerk,
      collectibleStrength,
      setCollectibleStrength,
      restockTokenId,
      setRestockTokenId,
      restockAmount,
      setRestockAmount,
      updateTokenId,
      setUpdateTokenId,
      updateTycPrice,
      setUpdateTycPrice,
      updateUsdcPrice,
      setUpdateUsdcPrice,
      withdrawToken,
      setWithdrawToken,
      withdrawAmount,
      setWithdrawAmount,
      withdrawTo,
      setWithdrawTo,
      tycoonMinStake,
      setTycoonMinStake,
      tycoonMinTurnsForPerks,
      setTycoonMinTurnsForPerks,
      tycoonGameController,
      setTycoonGameController,
      tycoonReads,
    },
    contract: {
      tycBalance: tycBalance.data,
      usdcBalance: usdcBalance.data,
      tokenCount,
      allTokens,
    },
    handlers: {
      handleSetBackendMinter,
      handleMintVoucher,
      handleMintCollectible,
      handleStockShop,
      handleRestock,
      handleUpdatePrices,
      handleWithdraw,
      handleSetTycoonMinStake,
      handleSetTycoonMinTurnsForPerks,
      handleSetTycoonGameController,
      pause: pauseHook.pause,
      unpause: pauseHook.unpause,
    },
    pending: {
      anyPending,
      currentTxHash,
      pendingMinter: setMinterHook.isPending,
      pendingVoucher: mintVoucherHook.isPending,
      pendingCollectible: mintCollectibleHook.isPending,
      pendingStock: stockShopHook.isPending,
      pendingRestock: restockHook.isPending,
      pendingUpdate: updateHook.isPending,
      pendingPause: pauseHook.isPending,
      pendingWithdraw: withdrawHook.isPending,
      pendingTycoonMinStake: tycoonSetMinStakeHook.isPending,
      pendingTycoonMinTurns: tycoonSetMinTurnsHook.isPending,
      pendingTycoonController: tycoonSetControllerHook.isPending,
    },
  };
}
