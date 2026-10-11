'use client';

import type { AdminCategoryDto, AdminProductDto } from '@kirilovskiy/shared';
import { formatRub, formatWeight } from '@kirilovskiy/shared';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { PageHeader, Spinner } from '@/components/ui';
import { mediaUrl } from '@/lib/config';
import { useResource } from '@/lib/use-resource';

export default function ProductsPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [archived, setArchived] = useState(false);
  const { data: categories } = useResource<AdminCategoryDto[]>('/admin/categories');
  const path = useMemo(() => {
    const p = new URLSearchParams();
    if (categoryId) p.set('categoryId', categoryId);
    if (archived) p.set('includeArchived', 'true');
    return `/admin/products?${p}`;
  }, [categoryId, archived]);
  const { data, loading, error } = useResource<AdminProductDto[]>(path);

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((p) => !q || p.name.toLowerCase().includes(q));
  }, [data, search]);

  return (
    <>
      <PageHeader title="Товары" sub="Цены, описание, состав, аллергены и фотографии">
        <Link href="/products/new" className="btn btn-primary"><Plus size={16} /> Добавить товар</Link>
      </PageHeader>
      <div className="row" style={{ marginBottom: 16 }}>
        <input className="input" style={{ width: 260 }} placeholder="Поиск по названию" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="select" style={{ width: 220 }} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Все категории</option>
          {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <label className="check"><input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} /> Показать архив</label>
      </div>
      {error ? <div className="alert alert-danger">{error}</div> : null}
      {loading && !data ? <Spinner /> : null}
      <div className="card">
        <table className="table">
          <thead>
            <tr><th /><th>Товар</th><th>Категория</th><th>Вес</th><th className="right">Цена</th><th>Статус</th></tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} className="clickable" onClick={() => router.push(`/products/${p.id}`)}>
                <td style={{ width: 60 }}>{p.imageUrl ? <img className="thumb" src={mediaUrl(p.imageUrl)!} alt="" /> : <div className="thumb" />}</td>
                <td>
                  <div className="strong">{p.name}</div>
                  <div className="small muted">{p.allergens.map((a) => a.name).join(', ') || 'Без аллергенов'}</div>
                </td>
                <td>{p.category.name}</td>
                <td className="nowrap">{formatWeight(p.weightGrams)}</td>
                <td className="right nowrap">
                  <div className="strong">{formatRub(p.price)}</div>
                  {p.oldPrice ? <div className="small muted" style={{ textDecoration: 'line-through' }}>{formatRub(p.oldPrice)}</div> : null}
                </td>
                <td>
                  <div className="row" style={{ gap: 4 }}>
                    {p.archivedAt ? <span className="badge badge-gray">Архив</span> : !p.isActive ? <span className="badge badge-gray">Скрыт</span> : <span className="badge badge-green">В продаже</span>}
                    {p.inStopList ? <span className="badge badge-red">Стоп-лист</span> : null}
                    {p.isFeatured ? <span className="badge badge-amber">Популярное</span> : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && items.length === 0 ? <div className="empty">Товары не найдены</div> : null}
      </div>
    </>
  );
}
