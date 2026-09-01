import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { setToken } from '@/lib/auth';
import { Popover, Tooltip, TooltipProvider } from '@cloudflare/kumo';
import { ArrowRight, Eye, EyeOff, HelpCircle, KeyRound, ShieldCheck } from 'lucide-react';
import { type FormEvent, useRef, useState } from 'react';

type Status = 'idle' | 'checking' | 'success' | 'error';

// Validate a candidate token against an authed endpoint before committing it, so a
// bad paste gives instant feedback here instead of a reload bounce back to this screen.
const verifyToken = async (token: string): Promise<'ok' | 'rejected' | 'unreachable'> => {
  try {
    const res = await fetch('/api/goals', {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      credentials: 'same-origin',
    });
    if (res.ok) return 'ok';
    if (res.status === 401) return 'rejected';
    return 'unreachable';
  } catch {
    return 'unreachable';
  }
};

const SuccessCheck = () => (
  <span className="t-success-check" data-state="in" aria-hidden="true">
    <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
      <title>Unlocked</title>
      <path
        d="M14 24 L21 31 L35 17"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </span>
);

export const SetupScreen = ({ reason }: { reason: 'missing' | '401' }) => {
  const [value, setValue] = useState('');
  const [reveal, setReveal] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(
    reason === '401' ? '该令牌已被拒绝。请粘贴有效的令牌继续。' : null,
  );
  const inputRef = useRef<HTMLInputElement | null>(null);

  const shake = () => {
    const el = inputRef.current;
    if (!el) return;
    el.classList.remove('is-shaking');
    void el.offsetWidth;
    el.classList.add('is-shaking');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const token = value.trim();
    if (!token) {
      shake();
      inputRef.current?.focus();
      return;
    }
    setStatus('checking');
    setError(null);
    const result = await verifyToken(token);
    if (result === 'ok') {
      setToken(token);
      setStatus('success');
      window.setTimeout(() => window.location.reload(), 1000);
      return;
    }
    setStatus('error');
    setError(
      result === 'rejected'
        ? '该令牌已被拒绝。请仔细检查后重试。'
        : '无法连接到服务器。health-mcp 是否在运行？',
    );
    shake();
    inputRef.current?.focus();
  };

  const busy = status === 'checking' || status === 'success';

  return (
    <TooltipProvider delay={150}>
      <main className="relative grid min-h-screen place-items-center overflow-x-hidden px-4 py-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto h-[60vh] max-h-[560px] w-full max-w-3xl"
          style={{
            background:
              'radial-gradient(50% 60% at 50% 0%, color-mix(in oklab, var(--color-kumo-brand) 22%, transparent), transparent 70%)',
          }}
        />

        <div className="w-full max-w-[400px]">
          <div className="t-panel-reveal flex flex-col items-center text-center">
            <img
              src="/logo.webp"
              alt=""
              aria-hidden="true"
              width={72}
              height={72}
              className="h-[72px] w-[72px] rounded-[20px] object-cover shadow-xl shadow-black/5 ring-1 ring-kumo-line"
            />
            <h1 className="mt-6 text-balance text-2xl font-semibold tracking-tight text-kumo-strong">
              <span translate="no">health-mcp</span>
            </h1>
            <p className="mt-2 text-sm text-kumo-subtle">你的数据，你的模型</p>
          </div>

          <Card className="t-panel-reveal mt-9" style={{ animationDelay: '90ms' }}>
            <CardContent className="px-7 py-8 sm:px-8">
              <div className="flex flex-col items-center text-center">
                <div className="grid h-11 w-11 place-items-center rounded-full bg-kumo-brand/10 text-kumo-brand">
                  <KeyRound className="h-5 w-5" aria-hidden="true" />
                </div>
                <h2 className="mt-4 text-balance text-lg font-semibold tracking-tight text-kumo-strong">
                  解锁仪表盘
                </h2>
                <p className="mt-1.5 text-pretty text-sm text-kumo-subtle">
                  粘贴您的访问令牌以打开您的私人健康数据。
                </p>
              </div>

              <form onSubmit={handleSubmit} className="mt-7 space-y-2.5" noValidate>
                <div className="flex items-center justify-between">
                  <Label htmlFor="token">访问令牌</Label>
                  <Popover>
                    <Popover.Trigger
                      render={
                        <button
                          type="button"
                          aria-label="在哪里找到您的令牌"
                          className="inline-flex items-center gap-1 rounded text-xs text-kumo-subtle outline-none transition-colors hover:text-kumo-default focus-visible:ring-2 focus-visible:ring-kumo-focus"
                        >
                          <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
                          在哪里找到
                        </button>
                      }
                    />
                    <Popover.Content side="bottom" className="max-w-[260px]">
                      <Popover.Title>在哪里找到您的令牌</Popover.Title>
                      <Popover.Description>
                        这是您在启动服务器时设置的{' '}
                        <code className="rounded bg-kumo-control px-1 py-0.5 font-mono text-xs">
                          HEALTH_MCP_TOKEN
                        </code>{' '}
                        值 — 请检查您的终端日志或{' '}
                        <code className="rounded bg-kumo-control px-1 py-0.5 font-mono text-xs">
                          .env
                        </code>{' '}
                        文件。
                      </Popover.Description>
                    </Popover.Content>
                  </Popover>
                </div>

                <div className="relative">
                  <Input
                    id="token"
                    name="token"
                    ref={inputRef}
                    type={reveal ? 'text' : 'password'}
                    autoFocus
                    autoComplete="off"
                    spellCheck={false}
                    enterKeyHint="go"
                    value={value}
                    onChange={(e) => {
                      setValue(e.target.value);
                      if (status === 'error') setStatus('idle');
                    }}
                    placeholder="粘贴您的令牌…"
                    className="w-full pr-10 font-mono"
                    aria-invalid={status === 'error'}
                    aria-describedby={error ? 'token-error' : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setReveal((r) => !r)}
                    aria-label={reveal ? '隐藏令牌' : '显示令牌'}
                    aria-pressed={reveal}
                    className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-md text-kumo-subtle outline-none transition-colors hover:text-kumo-default focus-visible:ring-2 focus-visible:ring-kumo-focus"
                  >
                    <span className="t-icon-swap" data-state={reveal ? 'b' : 'a'}>
                      <span className="t-icon" data-icon="a" aria-hidden="true">
                        <Eye className="h-4 w-4" />
                      </span>
                      <span className="t-icon" data-icon="b" aria-hidden="true">
                        <EyeOff className="h-4 w-4" />
                      </span>
                    </span>
                  </button>
                </div>

                <div className="min-h-[1.25rem]">
                  {error ? (
                    <p id="token-error" role="alert" className="text-xs text-kumo-danger">
                      {error}
                    </p>
                  ) : null}
                </div>

                <Button type="submit" disabled={busy} className="w-full">
                  <span className="inline-flex items-center justify-center gap-2">
                    {status === 'checking' ? (
                      <>
                        <Spinner className="h-4 w-4" />
                        检查中…
                      </>
                    ) : status === 'success' ? (
                      <>
                        <SuccessCheck />
                        已解锁
                      </>
                    ) : (
                      <>
                        解锁仪表盘
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </>
                    )}
                  </span>
                </Button>
                <output className="sr-only" aria-live="polite">
                  {status === 'checking'
                    ? '正在检查令牌'
                    : status === 'success'
                      ? '已解锁'
                      : ''}
                </output>
              </form>

              <div className="mt-7 flex justify-center border-t border-kumo-line pt-5">
                <Tooltip
                  side="bottom"
                  content="仅保存在此浏览器的 localStorage 中，且仅发送到您自己的服务器。无账户，无云服务。"
                  render={
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded text-xs text-kumo-subtle outline-none transition-colors hover:text-kumo-default focus-visible:ring-2 focus-visible:ring-kumo-focus"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      对此浏览器私密
                    </button>
                  }
                />
              </div>
            </CardContent>
          </Card>

          <p className="mt-6 text-center text-xs text-kumo-subtle">
            无需账户 · 完全在您的设备上运行
          </p>
        </div>
      </main>
    </TooltipProvider>
  );
};
