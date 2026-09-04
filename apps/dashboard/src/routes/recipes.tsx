import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { api } from '@/lib/api';
import { fmtNum } from '@/lib/format';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { ChefHat, Search } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';

const RecipeDetail = ({ id }: { id: string }) => {
  const detail = useQuery({
    queryKey: ['recipe', id],
    queryFn: () => api.recipes.get(id),
  });
  if (detail.isLoading) return <Spinner />;
  if (!detail.data) return null;
  const { recipe, ingredients, total, per_serving } = detail.data;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{recipe.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {recipe.notes ? (
          <div className="rounded-md border border-kumo-line/60 bg-kumo-fill/50 p-3 text-xs leading-relaxed text-kumo-default whitespace-pre-line">
            {recipe.notes}
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-3 rounded-md bg-kumo-fill p-4 text-xs">
          <div>
            <div className="uppercase tracking-wide text-kumo-subtle">总计</div>
            <div className="mt-0.5 font-semibold tabular-nums">
              {fmtNum(total.kcal, 0)} kcal · P {fmtNum(total.protein_g, 1)} · C{' '}
              {fmtNum(total.carb_g, 1)} · F {fmtNum(total.fat_g, 1)}
            </div>
          </div>
          <div>
            <div className="uppercase tracking-wide text-kumo-subtle">
              每份 ({recipe.servings} 份)
            </div>
            <div className="mt-0.5 font-semibold tabular-nums">
              {fmtNum(per_serving.kcal, 0)} kcal · P {fmtNum(per_serving.protein_g, 1)} · C{' '}
              {fmtNum(per_serving.carb_g, 1)} · F {fmtNum(per_serving.fat_g, 1)}
            </div>
          </div>
        </div>
        <ul className="divide-y divide-kumo-line">
          {ingredients.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="truncate">
                {i.food_name ?? i.free_text_name ?? (
                  <span className="text-kumo-subtle italic">未命名食材</span>
                )}
              </span>
              <span className="shrink-0 text-xs tabular-nums text-kumo-subtle">
                {fmtNum(i.grams, 0)} g
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};

const Recipes = () => {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const list = useQuery({
    queryKey: ['recipes', 'list'],
    queryFn: () => api.recipes.list({ limit: 100 }),
  });
  const [selected, setSelected] = useState<string | null>(null);
  const filtered = useMemo(() => {
    const all = list.data ?? [];
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return all;
    return all.filter((r) => r.name.toLowerCase().includes(q));
  }, [list.data, deferredQuery]);
  const isStale = query !== deferredQuery;
  return (
    <>
      <PageHeader
        title="食谱"
        description="可复用的模板，按份自动计算宏量营养素。目前通过 MCP 创建。"
      />
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-3">
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-kumo-subtle">
              <Search className="h-4 w-4" aria-hidden="true" />
            </span>
            <Input
              aria-label="筛选食谱"
              placeholder="筛选食谱…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9"
            />
          </div>
          {list.isLoading ? (
            <Spinner />
          ) : !filtered.length ? (
            <Empty
              icon={ChefHat}
              title={query.trim() ? '无匹配结果' : '暂无食谱'}
              description={query.trim() ? '试试其他筛选条件。' : undefined}
            />
          ) : (
            <Card>
              <CardContent
                className={`p-1.5 transition-opacity duration-150 ${isStale ? 'opacity-70' : 'opacity-100'}`}
              >
                <ul className="space-y-0.5">
                  {filtered.map((r) => (
                    <li key={r.id}>
                      <Button
                        variant={selected === r.id ? 'secondary' : 'ghost'}
                        size="sm"
                        className="w-full justify-between font-normal"
                        onClick={() => setSelected(r.id)}
                      >
                        <span className="truncate">{r.name}</span>
                        <span className="ml-2 shrink-0 text-xs text-kumo-subtle">
                          {r.servings} 份
                        </span>
                      </Button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
        <div>
          {selected ? (
            <RecipeDetail id={selected} />
          ) : (
            <Empty
              icon={ChefHat}
              title="选择一个食谱"
              description="点击左侧任意食谱查看食材和宏量营养素。"
            />
          )}
        </div>
      </div>
    </>
  );
};

export const Route = createFileRoute('/recipes')({ component: Recipes });
