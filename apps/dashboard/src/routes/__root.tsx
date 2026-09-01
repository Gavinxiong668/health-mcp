import { AppShell } from '@/components/app-shell';
import { SetupScreen } from '@/components/setup-screen';
import { Spinner } from '@/components/ui/spinner';
import { ApiError, api } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { useQuery } from '@tanstack/react-query';
import { Outlet, createRootRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

const RootGate = () => {
  const [authReason, setAuthReason] = useState<'missing' | '401' | null>(null);

  useEffect(() => {
    const handler = () => setAuthReason('401');
    window.addEventListener('auth:expired', handler);
    return () => window.removeEventListener('auth:expired', handler);
  }, []);

  const probe = useQuery({
    queryKey: ['health'],
    queryFn: () => api.health(),
    staleTime: 60_000,
    retry: false,
    // Reachability gate, not page data: a transient poll failure would swap the
    // whole app for the "unreachable" screen, so opt out of the global interval.
    refetchInterval: false,
  });

  if (probe.isLoading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }
  if (probe.isError) {
    const err = probe.error;
    if (err instanceof ApiError && err.status === 401) {
      return <SetupScreen reason="401" />;
    }
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="space-y-1 text-center">
          <p className="text-sm font-medium">服务器无法连接</p>
          <p className="text-xs text-kumo-subtle">
            health-mcp 是否正在运行？默认地址为 http://localhost:7777
          </p>
        </div>
      </div>
    );
  }
  if (probe.data?.auth_required && !getToken()) {
    return <SetupScreen reason={authReason ?? 'missing'} />;
  }
  return <AppShell />;
};

export const Route = createRootRoute({
  component: RootGate,
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center">
      <p className="text-sm text-kumo-subtle">页面未找到。</p>
    </div>
  ),
});

export { Outlet };
