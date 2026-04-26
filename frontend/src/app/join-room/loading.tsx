import { Skeleton } from "@/components/ui/skeleton";

/**
 * SW-FE-036 — Join Room: CLS / LCP skeleton
 *
 * Rendered by Next.js on the first frame while the "use client" JoinRoomForm
 * hydrates. Dimensions mirror the real page shell so there is zero layout
 * shift when the real form replaces this skeleton.
 *
 * Layout contract (must stay in sync with join-room/page.tsx):
 *   outer card  : max-w-md, rounded-2xl, p-6
 *   h1 slot     : h-8 (text-2xl line-height)
 *   inner card  : rounded-lg, p-6
 *   label slot  : h-4
 *   hint slot   : h-3
 *   input slot  : h-9  (matches Input base height)
 *   error slot  : h-5  (min-h-[1.25rem] from FormField)
 *   button slot : h-9  (matches Button default size)
 */
export default function JoinRoomLoading() {
  return (
    <section
      aria-busy="true"
      aria-label="Loading join room form"
      className="min-h-screen w-full bg-[var(--tycoon-bg)] flex flex-col items-center justify-center px-4"
    >
      <div className="w-full max-w-md rounded-2xl border border-[var(--tycoon-border)] bg-[var(--tycoon-card-bg)] p-6 shadow-xl">
        {/* h1 slot */}
        <Skeleton className="mx-auto mb-6 h-8 w-36" />

        <div className="rounded-lg border border-[var(--tycoon-border)] bg-[var(--tycoon-bg)] p-6 space-y-5">
          {/* FormField skeleton */}
          <div className="space-y-1.5">
            {/* label */}
            <Skeleton className="h-4 w-24" />
            {/* hint */}
            <Skeleton className="h-3 w-56" />
            {/* input */}
            <Skeleton className="h-9 w-full" />
            {/* error slot — always reserved (min-h-[1.25rem]) */}
            <div className="min-h-[1.25rem]" />
          </div>

          {/* Button slot */}
          <Skeleton className="h-9 w-full" />
        </div>
      </div>
    </section>
  );
}
