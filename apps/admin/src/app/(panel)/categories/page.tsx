'use client';

import type { AdminCategoryDto } from '@kirilovskiy/shared';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Field, Modal, PageHeader, Spinner, useToast } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { mediaUrl } from '@/lib/config';
import { useResource } from '@/lib/use-resource';

type Draft = { id?: string; name: string; slug: string; description: string; sortOrder: string; isActive: boolean; imageUrl: string };

export default function CategoriesPage() {
  const { data, loading, error, reload } = useResource<AdminCategoryDto[]>('/admin/categories');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function save() {
    if (!draft) return;
    setBusy(true);
    const body = {
      name: draft.name,
      slug: draft.slug || undefined,
      description: draft.description,
      sortOrder: Number(draft.sortOrder) || 0,
      isActive: draft.isActive,
      imageUrl: draft.imageUrl,
    };
    try {
      if (draft.id) await api.patch(`/admin/categories/${draft.id}`, body);
      else await api.post('/admin/categories', body);
      toast('Сохранено', 'success');
      setDraft(null);
      void reload();
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function remove(c: AdminCategoryDto) {
    if (!confirm(`Удалить категорию «${c.name}»?`)) return;
    try {
      await api.delete(`/admin/categories/${c.id}`);
      void reload();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  }

  return (
    <>
      <PageHeader title="Категории" sub="Разделы каталога в приложении">
        <button className="btn btn-primary" onClick={() => setDraft({ name: '', slug: '', description: '', sortOrder: String((data?.length ?? 0) + 1), isActive: true, imageUrl: '' })}>
          <Plus size={16} /> Добавить
        </button>
      </PageHeader>
      {error ? <div className="alert alert-danger">{error}</div> : null}
      {loading && !data ? <Spinner /> : null}
      <div className="card">
        <table className="table">
          <thead><tr><th /><th>Название</th><th>Адрес (slug)</th><th>Товаров</th><th>Порядок</th><th>Статус</th><th /></tr></thead>
          <tbody>
            {data?.map((c) => (
              <tr key={c.id}>
                <td style={{ width: 60 }}>{c.imageUrl ? <img className="thumb" src={mediaUrl(c.imageUrl)!} alt="" /> : <div className="thumb" />}</td>
                <td><div className="strong">{c.name}</div><div className="small muted">{c.description}</div></td>
                <td className="muted">{c.slug}</td>
                <td>{c.productCount}</td>
                <td>{c.sortOrder}</td>
                <td>{c.isActive ? <span className="badge badge-green">Показана</span> : <span className="badge badge-gray">Скрыта</span>}</td>
                <td className="right nowrap">
                  <button className="btn btn-sm" onClick={() => setDraft({ id: c.id, name: c.name, slug: c.slug, description: c.description ?? '', sortOrder: String(c.sortOrder), isActive: c.isActive, imageUrl: c.imageUrl ?? '' })}>Изменить</button>{' '}
                  <button className="btn btn-sm btn-danger" onClick={() => remove(c)} disabled={c.productCount > 0} title={c.productCount > 0 ? 'Сначала перенесите товары' : undefined}>Удалить</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {draft ? (
        <Modal title={draft.id ? 'Категория' : 'Новая категория'} onClose={() => setDraft(null)}
          footer={<><button className="btn" onClick={() => setDraft(null)}>Отмена</button><button className="btn btn-primary" disabled={busy || draft.name.trim().length < 2} onClick={save}>Сохранить</button></>}>
          <div className="stack">
            <Field label="Название"><input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus /></Field>
            <Field label="Адрес (slug)" hint="Латиница и дефис. Пусто — сформируется из названия"><input className="input" value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} /></Field>
            <Field label="Описание"><input className="input" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></Field>
            <Field label="Картинка (URL)" hint="Необязательно"><input className="input" value={draft.imageUrl} onChange={(e) => setDraft({ ...draft, imageUrl: e.target.value })} /></Field>
            <Field label="Порядок"><input className="input" inputMode="numeric" value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value })} /></Field>
            <label className="check"><input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} /> Показывать в приложении</label>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
