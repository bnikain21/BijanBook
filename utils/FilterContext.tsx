import { createContext, useContext, useState, ReactNode } from "react";

interface FilterState {
  selectedCategory: number | null;
  selectedAccount: string | null;
  setSelectedCategory: (id: number | null) => void;
  setSelectedAccount: (account: string | null) => void;
}

const FilterContext = createContext<FilterState>({
  selectedCategory: null,
  selectedAccount: null,
  setSelectedCategory: () => {},
  setSelectedAccount: () => {},
});

export function FilterProvider({ children }: { children: ReactNode }) {
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);

  return (
    <FilterContext.Provider
      value={{ selectedCategory, selectedAccount, setSelectedCategory, setSelectedAccount }}
    >
      {children}
    </FilterContext.Provider>
  );
}

export function useFilters() {
  return useContext(FilterContext);
}
