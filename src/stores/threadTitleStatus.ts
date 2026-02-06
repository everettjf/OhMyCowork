import { create } from "zustand";

type ThreadTitleStatusState = {
  pending: Record<string, boolean>;
  setPending: (threadId: string, value: boolean) => void;
};

export const useThreadTitleStatus = create<ThreadTitleStatusState>((set) => ({
  pending: {},
  setPending: (threadId, value) =>
    set((state) => ({
      pending: {
        ...state.pending,
        [threadId]: value,
      },
    })),
}));
