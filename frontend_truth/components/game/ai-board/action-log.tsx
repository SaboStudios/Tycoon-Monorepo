import { useEffect, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import { Game } from "@/types/game";

type ActionLogProps = {
  history: Game["history"];
};

/** Dedupe entries: remove duplicates where same comment appears for different players (e.g., rent payments create entries for both payer and receiver). */
function dedupeHistory(history: Game["history"]): Game["history"] {
  if (!history?.length) return history ?? [];
  const out: Game["history"] = [];
  const seenComments = new Set<string>();
  
  for (const entry of history) {
    const name = typeof entry === "object" && entry !== null && "player_name" in entry ? String((entry as { player_name?: string }).player_name ?? "") : "";
    const comment = typeof entry === "object" && entry !== null && "comment" in entry ? String((entry as { comment?: string }).comment ?? "") : String(entry ?? "");
    const rolled = typeof entry === "object" && entry !== null && "rolled" in entry ? (entry as { rolled?: number }).rolled : undefined;
    
    // Create a key from comment + rolled to identify duplicate actions
    const commentKey = `${comment}|${rolled ?? ""}`;
    
      // Check if this comment+rolled combination was already seen
      if (seenComments.has(commentKey)) {
        // If we've seen this comment before, check if this entry makes logical sense
        // Filter out entries where player_name matches the recipient in "paid X to Y" patterns
        const paidToMatch = comment.match(/paid\s+\d+\s+(?:rent\s+)?to\s+([^\s]+(?:\s+[^\s]+)*?)(?:\s+for|\s*$)/i);
        if (paidToMatch && paidToMatch[1]) {
          const recipient = paidToMatch[1].trim();
          if (name.toLowerCase() === recipient.toLowerCase()) {
            // This is a duplicate where the recipient is shown as the payer (e.g., "OG paid 8 rent to OG")
            continue;
          }
        }
        // For other duplicates, skip them
        continue;
      }
    
    seenComments.add(commentKey);
    out.push(entry);
  }
  
  return out;
}

export default function ActionLog({ history }: ActionLogProps) {
  const logRef = useRef<HTMLDivElement>(null);
  const deduped = useMemo(() => dedupeHistory(history), [history]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [deduped?.length]);

  return (
    <div
      ref={logRef}
      className="mt-6 w-full max-w-md bg-gray-900/95 backdrop-blur-md rounded-xl border border-cyan-500/30 shadow-2xl overflow-hidden flex flex-col h-48"
    >
      <div className="p-3 border-b border-cyan-500/20 bg-gray-800/80">
        <h3 className="text-sm font-bold text-cyan-300 tracking-wider">Action Log</h3>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 scrollbar-thin scrollbar-thumb-cyan-600">
        {(!deduped || deduped.length === 0) ? (
          <p className="text-center text-gray-500 text-xs italic py-8">No actions yet</p>
        ) : (
          deduped.map((h, i) => {
            const name = typeof h === "object" && h !== null && "player_name" in h ? (h as { player_name?: string }).player_name : "";
            const comment = typeof h === "object" && h !== null && "comment" in h ? (h as { comment?: string }).comment : String(h ?? "");
            const rolled = typeof h === "object" && h !== null && "rolled" in h ? (h as { rolled?: number }).rolled : undefined;
            return (
              <motion.p
                key={`${h && typeof h === "object" && "id" in h ? (h as { id?: number }).id : i}-${String(name).slice(0, 20)}-${String(comment).slice(0, 30)}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs text-gray-300"
              >
                <span className="font-medium text-cyan-200">{name}</span> {comment}
                {rolled != null && <span className="text-cyan-400 font-bold ml-1">[Rolled {rolled}]</span>}
              </motion.p>
            );
          })
        )}
      </div>
    </div>
  );
}