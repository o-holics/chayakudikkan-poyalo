"use client";

import { useCallback, useMemo, useState } from "react";
import { Doodle, type DoodleName } from "@/components/Doodle";

const FACES: DoodleName[] = ["cup", "kettle", "moon", "chair", "table", "pin"];

type Card = { id: number; face: DoodleName; done: boolean };

function shuffled(): Card[] {
  const deck = [...FACES, ...FACES].map((face, i) => ({ id: i, face, done: false }));
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/** A quiet memory game — pair the doodles while you wait. */
export function TeaGame() {
  const [cards, setCards] = useState<Card[]>(shuffled);
  const [up, setUp] = useState<number[]>([]);
  const [flips, setFlips] = useState(0);
  const [locked, setLocked] = useState(false);

  const cleared = useMemo(() => cards.every((c) => c.done), [cards]);

  const flip = useCallback(
    (idx: number) => {
      if (locked || up.includes(idx) || cards[idx].done) return;
      const next = [...up, idx];
      setUp(next);
      if (next.length < 2) return;

      setFlips((n) => n + 1);
      const [a, b] = next;
      if (cards[a].face === cards[b].face) {
        setCards((cs) => cs.map((c, i) => (i === a || i === b ? { ...c, done: true } : c)));
        setUp([]);
      } else {
        setLocked(true);
        setTimeout(() => {
          setUp([]);
          setLocked(false);
        }, 750);
      }
    },
    [cards, up, locked],
  );

  const reset = () => {
    setCards(shuffled());
    setUp([]);
    setFlips(0);
    setLocked(false);
  };

  return (
    <div>
      <div className="grid grid-cols-4 gap-2">
        {cards.map((c, i) => {
          const faceUp = c.done || up.includes(i);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => flip(i)}
              className={`flex aspect-square items-center justify-center rounded-xl border transition-colors ${
                faceUp ? "border-line bg-paper-raised text-ink" : "border-line bg-paper text-transparent"
              } ${c.done ? "opacity-40" : ""}`}
              aria-label={faceUp ? c.face : "hidden card"}
            >
              {faceUp ? <Doodle name={c.face} size={26} strokeWidth={4} /> : <span className="text-ink-soft">·</span>}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-ink-soft">
        <span>{cleared ? `cleared in ${flips}` : `${flips} flips`}</span>
        <button type="button" onClick={reset} className="underline decoration-line underline-offset-4">
          {cleared ? "again" : "shuffle"}
        </button>
      </div>
    </div>
  );
}
