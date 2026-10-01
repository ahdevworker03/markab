import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListTasks,
  useGetTask,
  useCreateTask,
  useUpdateTask,
  useCompleteTask,
  useDeleteTask,
  getListTasksQueryKey,
  getGetTaskQueryKey,
} from "@workspace/api-client-react";

type QueryFreshness = Pick<
  NonNullable<NonNullable<Parameters<typeof useListTasks>[0]>["query"]>,
  "staleTime"
>;

export function useTasks(freshness?: QueryFreshness) {
  const query = useListTasks(
    freshness
      ? { query: { queryKey: getListTasksQueryKey(), ...freshness } }
      : undefined,
  );
  return query;
}

export function useTask(id: string) {
  const query = useGetTask(id);
  return query;
}

export function useTaskMutations() {
  const queryClient = useQueryClient();

  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
  };

  const create = useCreateTask({
    mutation: {
      onSuccess: () => invalidateAll(),
    },
  });

  const complete = useCompleteTask({
    mutation: {
      onSuccess: (_data, variables) => {
        invalidateAll();
        void queryClient.invalidateQueries({
          queryKey: getGetTaskQueryKey(variables.id),
        });
      },
    },
  });

  const update = useUpdateTask({
    mutation: {
      onSuccess: (_data, variables) => {
        invalidateAll();
        void queryClient.invalidateQueries({ queryKey: getGetTaskQueryKey(variables.id) });
      },
    },
  });

  const remove = useDeleteTask({
    mutation: {
      onSuccess: (_data, variables) => {
        invalidateAll();
        void queryClient.invalidateQueries({
          queryKey: getGetTaskQueryKey(variables.id),
        });
      },
    },
  });

  return { create, update, complete, remove };
}

export function useTasksList() {
  const query = useListTasks();

  const tasks = useMemo(() => query.data?.data ?? [], [query.data]);

  return { ...query, tasks };
}
