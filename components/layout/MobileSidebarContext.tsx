"use client";

import { createContext, useContext, useState } from "react";

interface MobileSidebarCtx {
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
}

const MobileSidebarContext = createContext<MobileSidebarCtx>({
  isOpen: false,
  toggle: () => {},
  close: () => {},
});

export function MobileSidebarProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <MobileSidebarContext.Provider
      value={{ isOpen, toggle: () => setIsOpen((v) => !v), close: () => setIsOpen(false) }}
    >
      {children}
    </MobileSidebarContext.Provider>
  );
}

export const useMobileSidebar = () => useContext(MobileSidebarContext);
