import { useState } from 'react';
import {
  addProduct,
  addVariant,
  productsOf,
  removeProduct,
  removeVariant,
  renameProduct,
  renameVariant,
  setDescription,
  setPrice,
  type Menu,
} from '../domain/menuEdit';
import type { Product } from '../menu';
import { setCommission, useCommissions } from '../commissions';
import { channelLabel, PLATFORMS } from '../domain/order';
import { editMenu, resetMenu, useMenu } from '../menuStore';

/** Owner only: change prices, names and options, or add and remove dishes. */
export default function MenuEditorScreen() {
  const menu = useMenu();
  const [categoryId, setCategoryId] = useState(menu.categories[0].id);
  const [name, setName] = useState('');
  const [price, setPriceText] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const category = menu.categories.find((c) => c.id === categoryId)!;
  const commissions = useCommissions();

  return (
    <div className="menu">
      <nav className="menu-categories">
        {menu.categories.map((c) => (
          <button
            key={c.id}
            className={c.id === categoryId ? 'category active' : 'category'}
            onClick={() => setCategoryId(c.id)}
          >
            {c.name}
          </button>
        ))}
      </nav>
      <section className="menu-products">
        <div className="soldout-head">
          <p className="category-note">
            Los cambios se guardan al salir de cada casilla. Los pedidos ya tomados conservan su precio.
          </p>
          {!confirmReset ? (
            <button className="secondary" onClick={() => setConfirmReset(true)}>
              Restaurar menú original
            </button>
          ) : (
            <span className="row-end">
              <button className="secondary" onClick={() => setConfirmReset(false)}>
                No
              </button>
              <button
                className="danger"
                onClick={async () => {
                  await resetMenu();
                  setConfirmReset(false);
                }}
              >
                Sí, restaurar
              </button>
            </span>
          )}
        </div>

        <article className="product">
          <h2>Comisión de apps de reparto</h2>
          <p className="product-description">
            El porcentaje que se queda cada app. Se descuenta en el corte y en los reportes de los pedidos nuevos.
          </p>
          {PLATFORMS.map((p) => (
            <div key={p} className="editor-row">
              <span>{channelLabel(p)}</span>
              <CommitInput
                className="inline-input"
                numeric
                value={String(commissions[p])}
                onCommit={(text) => setCommission(p, Math.min(100, Number(text || 0)))}
              />
              <span className="muted">%</span>
            </div>
          ))}
        </article>

        {productsOf(menu, categoryId).map((p) => (
          <ProductEditor key={p.id} product={p} />
        ))}

        <article className="product">
          <h2>Nuevo platillo en {category.name}</h2>
          <form
            className="staff-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!name.trim() || price === '') return;
              await editMenu((m: Menu) => addProduct(m, categoryId, name, Number(price)));
              setName('');
              setPriceText('');
            }}
          >
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre, ej. Gringa" />
            <input
              className="inline-input"
              inputMode="numeric"
              value={price}
              onChange={(e) => setPriceText(e.target.value.replace(/\D/g, ''))}
              placeholder="$"
            />
            <button type="submit" className="primary" disabled={!name.trim() || price === ''}>
              Agregar
            </button>
          </form>
        </article>
      </section>
    </div>
  );
}

function ProductEditor({ product: p }: { product: Product }) {
  const [optionName, setOptionName] = useState('');
  const [optionPrice, setOptionPrice] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const named = p.variants.length > 1 || p.variants[0].name !== '';

  return (
    <article className="product editor">
      <div className="soldout-product">
        <CommitInput
          className="editor-name"
          value={p.name}
          onCommit={(text) => editMenu((m) => renameProduct(m, p.id, text))}
        />
        {!confirmRemove ? (
          <button className="secondary" onClick={() => setConfirmRemove(true)}>
            Quitar platillo
          </button>
        ) : (
          <span className="row-end">
            <button className="secondary" onClick={() => setConfirmRemove(false)}>
              No
            </button>
            <button className="danger" onClick={() => editMenu((m) => removeProduct(m, p.id))}>
              Sí, quitar
            </button>
          </span>
        )}
      </div>
      <CommitInput
        value={p.description ?? ''}
        placeholder="Descripción (opcional)"
        onCommit={(text) => editMenu((m) => setDescription(m, p.id, text))}
      />
      {p.variants.map((v) => (
        <div key={v.id} className="editor-row">
          {named ? (
            <CommitInput
              value={v.name}
              placeholder="Opción"
              onCommit={(text) => editMenu((m) => renameVariant(m, p.id, v.id, text))}
            />
          ) : (
            <span className="muted">Precio</span>
          )}
          <CommitInput
            className="inline-input"
            numeric
            value={String(v.price)}
            onCommit={(text) => text !== '' && editMenu((m) => setPrice(m, p.id, v.id, Number(text)))}
          />
          {p.variants.length > 1 && (
            <button className="secondary" onClick={() => editMenu((m) => removeVariant(m, p.id, v.id))}>
              Quitar
            </button>
          )}
        </div>
      ))}
      <form
        className="editor-row"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!optionName.trim() || optionPrice === '') return;
          await editMenu((m) => addVariant(m, p.id, optionName, Number(optionPrice)));
          setOptionName('');
          setOptionPrice('');
        }}
      >
        <input value={optionName} onChange={(e) => setOptionName(e.target.value)} placeholder="Nueva opción, ej. Pastor" />
        <input
          className="inline-input"
          inputMode="numeric"
          value={optionPrice}
          onChange={(e) => setOptionPrice(e.target.value.replace(/\D/g, ''))}
          placeholder="$"
        />
        <button type="submit" className="secondary" disabled={!optionName.trim() || optionPrice === ''}>
          + Opción
        </button>
      </form>
    </article>
  );
}

/** A text box that saves when it loses focus or on Enter, and shows the stored value otherwise. */
function CommitInput({
  value,
  onCommit,
  numeric,
  placeholder,
  className,
}: {
  value: string;
  onCommit: (text: string) => unknown;
  numeric?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null && draft !== value) onCommit(draft);
    setDraft(null);
  };
  return (
    <input
      className={className}
      value={draft ?? value}
      placeholder={placeholder}
      inputMode={numeric ? 'numeric' : undefined}
      onChange={(e) => setDraft(numeric ? e.target.value.replace(/\D/g, '') : e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}
