import { create } from "zustand";

type ThreadResponseStatusState = {
  pending: Record<string, number>;
  begin: (threadId: string) => void;
  end: (threadId: string) => void;
};

export const useThreadResponseStatus = create<ThreadResponseStatusState>((set) => ({
  pending: {},
  begin: (threadId) =>
    set((state) => ({
      pending: {
        ...state.pending,
        [threadId]: (state.pending[threadId] ?? 0) + 1,
      },
    })),
  end: (threadId) =>
    set((state) => {
      const current = state.pending[threadId] ?? 0;
      const nextCount = Math.max(0, current - 1);
      const pending = { ...state.pending };
      if (nextCount === 0) delete pending[threadId];
      else pending[threadId] = nextCount;
      return { pending };
    }),
}));
