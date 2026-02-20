// context/SocketContext.tsx
"use client";
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { socketService } from "@/lib/socket";
import { Game, Player } from "@/types/game";

interface SocketContextType {
  socket: typeof socketService;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

interface SocketProviderProps {
  children: ReactNode;
  serverUrl: string;
}

export const useSocket = (): SocketContextType => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
};

export const SocketProvider: React.FC<SocketProviderProps> = ({
  children,
  serverUrl,
}) => {
  const [isConnected, setIsConnected] = useState<boolean>(false);

  useEffect(() => {
    // Connect to socket server
    const socket = socketService.connect(serverUrl);

    const handleConnect = () => {
      setIsConnected(true);
      console.log("Socket connected");
    };

    const handleDisconnect = () => {
      setIsConnected(false);
      console.log("Socket disconnected");
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socketService.disconnect();
    };
  }, [serverUrl]);

  const value: SocketContextType = {
    socket: socketService,
    isConnected,
  };

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
};
