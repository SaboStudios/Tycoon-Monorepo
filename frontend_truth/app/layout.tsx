import { dmSans, kronaOne, orbitron } from "@/components/shared/fonts";
import NavBar from "@/components/shared/navbar"; // Remove if not used elsewhere
import ScrollToTopBtn from "@/components/shared/scroll-to-top-btn";
import "@/styles/globals.css";
import { getMetadata } from "@/utils/getMeatadata";
import { headers } from "next/headers";
import ContextProvider from "@/context";
import AppKitProviderWrapper from "@/components/AppKitProviderWrapper";
import { TycoonProvider } from "@/context/ContractProvider";
import { GuestAuthProvider } from "@/context/GuestAuthContext";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { SocketProvider } from "@/context/SocketContext";
import { Toaster } from "react-hot-toast";
import FarcasterReady from "@/components/FarcasterReady"; 
import { minikitConfig } from "../minikit.config";
import type { Metadata } from "next";
import ClientLayout from "../clients/ClientLayout"; // ← Import the new wrapper
import QueryProvider from "./QueryProvider";

// Remove the duplicate 'cookies' global variable—it's not needed

export async function generateMetadata(): Promise<Metadata> {
  const headersObj = await headers();
  const cookies = headersObj.get("cookie"); // Local var is fine here
  return {
    title: "Tycoon",
    description:
      "Tycoon is a decentralized on-chain game inspired by the classic Monopoly game, built on Celo. It allows players to buy, sell, and trade digital properties in a trustless gaming environment.",
    other: {
      "base:app_id": "695d328c3ee38216e9af4359", 
      "fc:frame": JSON.stringify({
        version: minikitConfig.miniapp.version,
        imageUrl: minikitConfig.miniapp.heroImageUrl,
        images: {
          url: minikitConfig.miniapp.heroImageUrl,
          alt: "Tycoon - Monopoly Game Onchain",
        },
        button: {
          title: `Play ${minikitConfig.miniapp.name} `,
          action: {
            name: `Launch ${minikitConfig.miniapp.name}`,
            type: "launch_frame",
          },
        },
      }),
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersObj = await headers();
  const cookies = headersObj.get("cookie"); // Local var—no need for global

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased bg-[#010F10] w-full">
        <FarcasterReady />
        <ContextProvider cookies={cookies}>
          <TycoonProvider>
            <GuestAuthProvider>
            <AppKitProviderWrapper>
              {/* SocketProvider commented out as in your code */}
              {/* <SocketProvider serverUrl="https://base-monopoly-production.up.railway.app/api"> */}
              
              {/* ← Use the client wrapper here—no more useMediaQuery! */}
              <QueryProvider>
              <ClientLayout cookies={cookies}>
                {children}
              </ClientLayout>
              
              <ScrollToTopBtn />
              <ToastContainer
                position="top-right"
                autoClose={5000}
                hideProgressBar={false}
                newestOnTop
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="dark"
                toastStyle={{
                  fontFamily: "Orbitron, sans-serif",
                  background: "#0E1415",
                  color: "#00F0FF",
                  border: "1px solid #003B3E",
                }}
              />
              <Toaster position="top-center" />
              </QueryProvider>
              
              {/* </SocketProvider> */}
            </AppKitProviderWrapper>
            </GuestAuthProvider>
          </TycoonProvider>
        </ContextProvider>
      </body>
    </html>
  );
}