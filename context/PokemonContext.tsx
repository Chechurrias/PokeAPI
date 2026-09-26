import React, { createContext, ReactNode, useContext, useState } from 'react';

// Tipado estructurado para Sprites
export type PokemonSprites = {
  front_default: string | null;
  front_shiny: string | null;
  other?: {
    'official-artwork'?: {
      front_default: string | null;
      front_shiny: string | null;
    };
  };
  versions?: {
    'generation-v'?: {
      'black-white'?: {
        animated?: {
          front_default: string | null;
          front_shiny: string | null;
        };
      };
      'icons'?: {
        animated?: {
          front_default: string | null;
        };
      };
    };
    'generation-viii'?: {
      'brilliant-diamond-shining-pearl'?: {
        front_default: string | null;
        front_shiny: string | null;
      };
    };
    'generation-ii'?: {
      'crystal'?: {
        animated?: {
          front_default: string | null;
          front_shiny: string | null;
        };
       
      };
    };
  };
};

export type Pokemon = {
  id: number;
  name: string;
  height: number;
  weight: number;
  types: { type: { name: string } }[];
  abilities: { ability: { name: string } }[];
  moves: { move: { name: string } }[];
  sprites: PokemonSprites;
};

type PokemonContextType = {
  pokemon: Pokemon | null;
  setPokemon: (pokemon: Pokemon | null) => void;
};

const PokemonContext = createContext<PokemonContextType | undefined>(undefined);

export function PokemonProvider({ children }: { children: ReactNode }) {
  const [pokemon, setPokemon] = useState<Pokemon | null>(null);

  return (
    <PokemonContext.Provider value={{ pokemon, setPokemon }}>
      {children}
    </PokemonContext.Provider>
  );
}

export function usePokemon() {
  const context = useContext(PokemonContext);
  if (!context) {
    throw new Error('usePokemon debe usarse dentro de un PokemonProvider');
  }
  return context;
}