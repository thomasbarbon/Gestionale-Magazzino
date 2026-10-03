import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Light polling + focus refetch so changes made on one device appear on
      // the others within a few seconds without manual refresh.
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      staleTime: 2000,
    },
  },
});
