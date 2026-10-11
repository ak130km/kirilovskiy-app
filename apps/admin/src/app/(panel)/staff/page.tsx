'use client';

import type { StaffDto, StaffRole } from '@kirilovskiy/shared';
import { formatDateTimeMsk, STAFF_ROLE_LABELS, STAFF_ROLES } from '@kirilovskiy/shared';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Field, Modal, PageHeader, Spinner, useToast } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useResource } from '@/lib/use-resource';

type Draft = { id?: string; email: string; name: string; role: StaffRole; password: string; isActive: boolean };

const ROLE_HINTS: Record<StaffRole, string> = {
  ADMIN: 'Всё, включая сотрудников и настройки',
  MANAGER: 'Заказы, каталог, промокоды, доставка, журнал',
  OPERATOR: 'Заказы и стоп-лист',
};

export default function StaffPage() {
  const { data, loading, reload } = useResource<StaffDto[]>('/admin/staff');
  const { can, staff: me } = useAuth();
  const [draft, setDraft] = useState<Draft | null>(null);
  const toast = useToast();
  const isAdmin = can('ADMIN');

  async function save() {
    if (!draft) return;
    try {
      if (draft.id) {
        await api.patch(`/admin/staff/${draft.id}`, {
          name: draft.name,
          role: draft.role,
          isActive: draft.isActive,
          password: draft.password || undefined,
        });
      } else {
        await api.post('/admin/staff', { email: draft.email, name: draft.name, role: draft.role, password: draft.password });
      }
      setDraft(null);
      void reload();
      toast('Сохранено', 'success');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  }

  return (
    <>
      <PageHeader title="Сотрудники" sub="Доступ к админ-панели и роли">
        {isAdmin ? (
          <button className="btn btn-primary" onClick={() => setDraft({ email: '', name: '', role: 'OPERATOR', password: '', isActive: true })}>
            <Plus size={16} /> Добавить сотрудника
          </button>
        ) : null}
      </PageHeader>
      {loading && !data ? <Spinner /> : null}
      <div className="card">
        <table className="table">
          <thead><tr><th>Имя</th><th>Email</th><th>Роль</th><th>Последний вход</th><th>Статус</th><th /></tr></thead>
          <tbody>
            {data?.map((s) => (
              <tr key={s.id}>
                <td className="strong">{s.name}{s.id === me?.id ? <span className="muted small"> (вы)</span> : null}</td>
                <td>{s.email}</td>
                <td>{STAFF_ROLE_LABELS[s.role]}</td>
                <td className="small">{s.lastLoginAt ? formatDateTimeMsk(s.lastLoginAt) : '—'}</td>
                <td>{s.isActive ? <span className="badge badge-green">Активен</span> : <span className="badge badge-gray">Заблокирован</span>}</td>
                <td className="right">
                  {isAdmin ? <button className="btn btn-sm" onClick={() => setDraft({ id: s.id, email: s.email, name: s.name, role: s.role, password: '', isActive: s.isActive })}>Изменить</button> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {draft ? (
        <Modal title={draft.id ? draft.name : 'Новый сотрудник'} onClose={() => setDraft(null)}
          footer={<><button className="btn" onClick={() => setDraft(null)}>Отмена</button><button className="btn btn-primary" onClick={save}>Сохранить</button></>}>
          <div className="stack">
            {!draft.id ? <Field label="Email"><input className="input" type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} autoFocus /></Field> : null}
            <Field label="Имя"><input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
            <Field label="Роль" hint={ROLE_HINTS[draft.role]}>
              <select className="select" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as StaffRole })}>
                {STAFF_ROLES.map((r) => <option key={r} value={r}>{STAFF_ROLE_LABELS[r]}</option>)}
              </select>
            </Field>
            <Field label={draft.id ? 'Новый пароль' : 'Пароль'} hint={draft.id ? 'Оставьте пустым, чтобы не менять' : 'Минимум 8 символов'}>
              <input className="input" type="password" autoComplete="new-password" value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} />
            </Field>
            {draft.id ? <label className="check"><input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} /> Доступ разрешён</label> : null}
          </div>
        </Modal>
      ) : null}
    </>
  );
}
