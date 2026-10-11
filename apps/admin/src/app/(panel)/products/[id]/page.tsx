'use client';

import type { AdminCategoryDto, AdminProductDto, AllergenDto } from '@kirilovskiy/shared';
import { ArrowLeft, ChevronLeft, ChevronRight, ImagePlus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { Field, PageHeader, Spinner, useToast } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { mediaUrl } from '@/lib/config';
import { kopecksToInput, parseRubles } from '@/lib/format';
import { useResource } from '@/lib/use-resource';

interface FormState {
  name: string;
  categoryId: string;
  description: string;
  composition: string;
  price: string;
  oldPrice: string;
  weightGrams: string;
  caloriesKcal: string;
  proteins: string;
  fats: string;
  carbohydrates: string;
  storageConditions: string;
  leadTimeHours: string;
  sortOrder: string;
  externalId: string;
  isActive: boolean;
  isFeatured: boolean;
  allergenIds: string[];
}

const EMPTY: FormState = {
  name: '', categoryId: '', description: '', composition: '', price: '', oldPrice: '', weightGrams: '',
  caloriesKcal: '', proteins: '', fats: '', carbohydrates: '', storageConditions: '', leadTimeHours: '0',
  sortOrder: '0', externalId: '', isActive: true, isFeatured: false, allergenIds: [],
};

const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));

function toForm(p: AdminProductDto): FormState {
  return {
    name: p.name,
    categoryId: p.categoryId,
    description: p.description ?? '',
    composition: p.composition ?? '',
    price: kopecksToInput(p.price),
    oldPrice: kopecksToInput(p.oldPrice),
    weightGrams: String(p.weightGrams),
    caloriesKcal: p.caloriesKcal?.toString() ?? '',
    proteins: p.proteins?.toString() ?? '',
    fats: p.fats?.toString() ?? '',
    carbohydrates: p.carbohydrates?.toString() ?? '',
    storageConditions: p.storageConditions ?? '',
    leadTimeHours: String(p.leadTimeHours),
    sortOrder: String(p.sortOrder),
    externalId: p.externalId ?? '',
    isActive: p.isActive,
    isFeatured: p.isFeatured,
    allergenIds: p.allergens.map((a) => a.id),
  };
}

export default function ProductEditPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'new';
  const router = useRouter();
  const toast = useToast();
  const { data: product, setData: setProduct } = useResource<AdminProductDto>(isNew ? null : `/admin/products/${id}`);
  const { data: categories } = useResource<AdminCategoryDto[]>('/admin/categories');
  const { data: allergens } = useResource<AllergenDto[]>('/admin/allergens');
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (product) setForm(toForm(product));
  }, [product]);

  useEffect(() => {
    if (isNew && categories?.length && !form.categoryId) setForm((f) => ({ ...f, categoryId: categories[0].id }));
  }, [isNew, categories, form.categoryId]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function save(e: FormEvent) {
    e.preventDefault();
    const price = parseRubles(form.price);
    if (price === null) return toast('Укажите цену в рублях', 'error');
    const body = {
      name: form.name,
      categoryId: form.categoryId,
      description: form.description,
      composition: form.composition,
      price,
      oldPrice: parseRubles(form.oldPrice),
      weightGrams: Number(form.weightGrams),
      caloriesKcal: num(form.caloriesKcal),
      proteins: num(form.proteins),
      fats: num(form.fats),
      carbohydrates: num(form.carbohydrates),
      storageConditions: form.storageConditions,
      leadTimeHours: Number(form.leadTimeHours) || 0,
      sortOrder: Number(form.sortOrder) || 0,
      externalId: form.externalId,
      isActive: form.isActive,
      isFeatured: form.isFeatured,
      allergenIds: form.allergenIds,
    };
    setBusy(true);
    try {
      if (isNew) {
        const created = await api.post<AdminProductDto>('/admin/products', body);
        toast('Товар создан. Добавьте фотографии.', 'success');
        router.replace(`/products/${created.id}`);
      } else {
        setProduct(await api.patch<AdminProductDto>(`/admin/products/${id}`, body));
        toast('Сохранено', 'success');
      }
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append('file', file);
      try {
        setProduct(await api.upload<AdminProductDto>(`/admin/products/${id}/images`, fd));
      } catch (err) {
        toast(`${file.name}: ${errorMessage(err)}`, 'error');
      }
    }
    if (fileRef.current) fileRef.current.value = '';
  }

  async function removeImage(imageId: string) {
    try {
      setProduct(await api.delete<AdminProductDto>(`/admin/products/${id}/images/${imageId}`));
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  }

  async function moveImage(index: number, dir: -1 | 1) {
    if (!product) return;
    const ids = product.images.map((i) => i.id);
    const target = index + dir;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    try {
      setProduct(await api.patch<AdminProductDto>(`/admin/products/${id}/images/order`, { imageIds: ids }));
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  }

  async function archive() {
    if (!confirm('Перенести товар в архив? Он исчезнет из приложения, но останется в истории заказов.')) return;
    try {
      await api.delete(`/admin/products/${id}`);
      toast('Товар в архиве', 'success');
      router.push('/products');
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  }

  async function restore() {
    try {
      setProduct(await api.post<AdminProductDto>(`/admin/products/${id}/restore`));
      toast('Товар восстановлен (скрыт — включите «Показывать в приложении»)', 'success');
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  }

  if (!isNew && !product) return <Spinner />;

  return (
    <form onSubmit={save}>
      <Link href="/products" className="row muted" style={{ marginBottom: 12 }}><ArrowLeft size={16} /> Все товары</Link>
      <PageHeader title={isNew ? 'Новый товар' : form.name || 'Товар'} sub={product?.archivedAt ? 'Товар в архиве' : undefined}>
        {!isNew && product?.archivedAt ? <button type="button" className="btn" onClick={restore}>Восстановить</button> : null}
        {!isNew && !product?.archivedAt ? <button type="button" className="btn btn-danger" onClick={archive}>В архив</button> : null}
        <button className="btn btn-primary" disabled={busy} type="submit">{busy ? 'Сохраняем…' : 'Сохранить'}</button>
      </PageHeader>

      <div className="grid grid-2">
        <div className="stack">
          <div className="card"><div className="card-body stack">
            <Field label="Название"><input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} required /></Field>
            <Field label="Категория">
              <select className="select" value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)} required>
                {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <div className="grid grid-3">
              <Field label="Цена, ₽"><input className="input" inputMode="decimal" value={form.price} onChange={(e) => set('price', e.target.value)} required /></Field>
              <Field label="Старая цена, ₽" hint="Зачёркнутая"><input className="input" inputMode="decimal" value={form.oldPrice} onChange={(e) => set('oldPrice', e.target.value)} /></Field>
              <Field label="Вес, г"><input className="input" inputMode="numeric" value={form.weightGrams} onChange={(e) => set('weightGrams', e.target.value)} required /></Field>
            </div>
            <Field label="Описание"><textarea className="textarea" value={form.description} onChange={(e) => set('description', e.target.value)} /></Field>
            <Field label="Состав"><textarea className="textarea" value={form.composition} onChange={(e) => set('composition', e.target.value)} /></Field>
            <div className="field">
              <span className="label">Аллергены</span>
              <div className="chips">
                {allergens?.map((a) => {
                  const on = form.allergenIds.includes(a.id);
                  return (
                    <button type="button" key={a.id} className={`chip ${on ? 'on' : ''}`}
                      onClick={() => set('allergenIds', on ? form.allergenIds.filter((x) => x !== a.id) : [...form.allergenIds, a.id])}>
                      {a.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div></div>
        </div>

        <div className="stack">
          <div className="card"><div className="card-body stack">
            <h2>Фотографии</h2>
            {isNew ? (
              <div className="muted">Сохраните товар, чтобы добавить фотографии.</div>
            ) : (
              <div className="images">
                {product?.images.map((img, i) => (
                  <div key={img.id} className="image-tile">
                    <img src={mediaUrl(img.url)!} alt="" />
                    {i === 0 ? <span className="badge badge-amber cover">Обложка</span> : null}
                    <div className="tools">
                      <button type="button" className="btn btn-sm icon-btn" onClick={() => moveImage(i, -1)} disabled={i === 0} aria-label="Левее"><ChevronLeft size={14} /></button>
                      <button type="button" className="btn btn-sm icon-btn" onClick={() => moveImage(i, 1)} disabled={i === (product?.images.length ?? 0) - 1} aria-label="Правее"><ChevronRight size={14} /></button>
                      <button type="button" className="btn btn-sm icon-btn btn-danger" onClick={() => removeImage(img.id)} aria-label="Удалить"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
                <label className="upload-tile">
                  <span><ImagePlus size={22} /><br />JPEG, PNG, WebP<br />до 10 МБ</span>
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => upload(e.target.files)} />
                </label>
              </div>
            )}
          </div></div>

          <div className="card"><div className="card-body stack">
            <h2>Публикация</h2>
            <label className="check"><input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} /> Показывать в приложении</label>
            <label className="check"><input type="checkbox" checked={form.isFeatured} onChange={(e) => set('isFeatured', e.target.checked)} /> В блоке «Популярное» на главной</label>
            <div className="grid grid-2">
              <Field label="Изготовление, часов" hint="Минимум до выдачи (торты — 24–48)"><input className="input" inputMode="numeric" value={form.leadTimeHours} onChange={(e) => set('leadTimeHours', e.target.value)} /></Field>
              <Field label="Порядок сортировки"><input className="input" inputMode="numeric" value={form.sortOrder} onChange={(e) => set('sortOrder', e.target.value)} /></Field>
            </div>
            {product?.inStopList ? <div className="alert">Товар в стоп-листе{product.stopListReason ? `: ${product.stopListReason}` : ''}. Управление — на странице «Стоп-лист».</div> : null}
          </div></div>

          <div className="card"><div className="card-body stack">
            <h2>Пищевая ценность на 100 г</h2>
            <div className="grid grid-2">
              <Field label="Калорийность, ккал"><input className="input" inputMode="numeric" value={form.caloriesKcal} onChange={(e) => set('caloriesKcal', e.target.value)} /></Field>
              <Field label="Белки, г"><input className="input" inputMode="decimal" value={form.proteins} onChange={(e) => set('proteins', e.target.value)} /></Field>
              <Field label="Жиры, г"><input className="input" inputMode="decimal" value={form.fats} onChange={(e) => set('fats', e.target.value)} /></Field>
              <Field label="Углеводы, г"><input className="input" inputMode="decimal" value={form.carbohydrates} onChange={(e) => set('carbohydrates', e.target.value)} /></Field>
            </div>
            <Field label="Условия хранения"><input className="input" value={form.storageConditions} onChange={(e) => set('storageConditions', e.target.value)} placeholder="При +2…+6 °C — 72 часа" /></Field>
            <Field label="Код номенклатуры 1С" hint="GUID для обмена с 1С:УНФ"><input className="input" value={form.externalId} onChange={(e) => set('externalId', e.target.value)} /></Field>
          </div></div>
        </div>
      </div>
    </form>
  );
}
