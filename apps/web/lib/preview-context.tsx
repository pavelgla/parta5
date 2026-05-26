'use client';

import { createContext, useContext } from 'react';

export const PreviewContext = createContext(false);

export function usePreviewMode(): boolean {
  return useContext(PreviewContext);
}

export function PreviewProvider({ children }: { children: React.ReactNode }) {
  return <PreviewContext.Provider value={true}>{children}</PreviewContext.Provider>;
}
