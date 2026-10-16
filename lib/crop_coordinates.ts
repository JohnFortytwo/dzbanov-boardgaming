// lib/crop_coordinates.ts

export interface CropRegion {
  x: number;      // Relativní X (0.0 až 1.0)
  y: number;      // Relativní Y (0.0 až 1.0)
  width: number;  // Relativní šířka
  height: number; // Relativní výška
}

export const GAME_CARD_CROPS: Record<string, CropRegion> = {
  // Datum (horní vlevo)
  played_at: { x: 0.00, y: 0.00, width: 0.32, height: 0.22 },
  
  // Tabulka Hráči & Role (levá část pod datem)
  players_table: { x: 0.00, y: 0.22, width: 0.32, height: 0.78 },
  
  // Výsledek hry - Výhra / Prohra (horní vpravo)
  result: { x: 0.33, y: 0.00, width: 0.67, height: 0.22 },
  
  // Výzvy / Výzvy moduly (střed vpravo)
  challenges: { x: 0.33, y: 0.22, width: 0.67, height: 0.28 },
  
  // Obtížnost (pod výzvami)
  difficulty: { x: 0.33, y: 0.50, width: 0.67, height: 0.20 },
  
  // Nemoci a stavy (dole uprostřed)
  diseases: { x: 0.33, y: 0.70, width: 0.40, height: 0.30 },
  
  // Poznámka (dole vpravo)
  note: { x: 0.74, y: 0.70, width: 0.26, height: 0.30 },
};