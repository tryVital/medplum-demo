import { useQuery } from '@tanstack/react-query';
import { PaginatedResponse, http } from '.';

export function useFetchUsers() {
  const { data, ...query } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
  });

  return {
    users: data?.users,
    ...query,
  };
}

async function fetchUsers(): Promise<UsersResponse> {
  const resp = await http.get<UsersResponse>('/v2/user');

  return resp.data;
}

type UsersResponse = PaginatedResponse & {
  users: Array<User>;
};

export type User = {
  user_id: string;
  team_id: string;
  client_user_id: string;
  connected_sources: Array<{
    source: {
      name: string;
      slug: string;
      logo: string;
    };
    created_on: string;
  }>;
};
