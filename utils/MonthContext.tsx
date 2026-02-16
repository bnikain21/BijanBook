import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getSelectedMonth, setSelectedMonth as persistMonth } from "../db/queries";

interface MonthContextType {
  month: string;
  setMonth: (m: string) => void;
  monthLabel: string;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatMonthLabel(month: string): string {
  const [year, mm] = month.split("-");
  const idx = parseInt(mm, 10) - 1;
  return `${MONTH_NAMES[idx]} ${year}`;
}

const MonthContext = createContext<MonthContextType>({
  month: "",
  setMonth: () => {},
  monthLabel: "",
});

export function MonthProvider({ children }: { children: ReactNode }) {
  const [month, setMonthState] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getSelectedMonth().then((m) => {
      setMonthState(m);
      setReady(true);
    });
  }, []);

  function setMonth(m: string) {
    setMonthState(m);
    persistMonth(m);
  }

  if (!ready) return null;

  return (
    <MonthContext.Provider
      value={{
        month,
        setMonth,
        monthLabel: formatMonthLabel(month),
      }}
    >
      {children}
    </MonthContext.Provider>
  );
}

export function useMonth() {
  return useContext(MonthContext);
}
