import { Spinner } from "@/components/ui/spinner";

export default function AiPlayGameLoading() {
  return (
    <section className="w-full min-h-[calc(100dvh-87px)] flex flex-col items-center justify-center bg-[#010F10] px-4">
      <div className="flex flex-col items-center gap-4">
        <Spinner size="lg" />
        <p className="text-[#00F0FF] text-lg font-semibold font-orbitron animate-pulse">
          Loading game...
        </p>
      </div>
    </section>
  );
}
