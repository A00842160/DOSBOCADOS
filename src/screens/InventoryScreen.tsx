import { useState } from 'react';
import type { Role } from '../auth';
import {
  daysLeft,
  formatQty,
  isLow,
  MOVEMENT_KINDS,
  round,
  unitInfo,
  UNITS,
  usage,
  type MovementKind,
  type Supply,
  type Unit,
} from '../domain/inventory';
import { productsOf } from '../domain/menuEdit';
import { startOfDay } from '../domain/report';
import {
  addSupply,
  editRecipe,
  registerMovement,
  removeSupply,
  updateSupply,
  useMovementsSince,
  useRecipes,
  useSupplies,
} from '../inventoryStore';
import { useMenu } from '../menuStore';
import CommitInput, { decimalText } from './CommitInput';

type Tab = 'existencias' | 'recetas' | 'movimientos';

const WINDOW_DAYS = 7;

/** Stock of each supply, recipes that use them up, and the history of changes. */
export default function InventoryScreen({ role, who }: { role: Role; who: string }) {
  const [tab, setTab] = useState<Tab>('existencias');
  const tabs: { id: Tab; label: string }[] = [
    { id: 'existencias', label: 'Existencias' },
    ...(role === 'dueno' ? [{ id: 'recetas' as const, label: 'Recetas' }] : []),
    { id: 'movimientos', label: 'Movimientos' },
  ];
  return (
    <div className="report">
      <div className="segmented">
        {tabs.map((t) => (
          <button key={t.id} className={t.id === tab ? 'seg active' : 'seg'} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'existencias' && <Stock owner={role === 'dueno'} who={who} />}
      {tab === 'recetas' && <RecipesEditor />}
      {tab === 'movimientos' && <History />}
    </div>
  );
}

function since(days: number): number {
  return startOfDay(Date.now()) - (days - 1) * 24 * 60 * 60 * 1000;
}

function Stock({ owner, who }: { owner: boolean; who: string }) {
  const supplies = useSupplies();
  const [from] = useState(() => since(WINDOW_DAYS));
  const recent = usage(useMovementsSince(from), WINDOW_DAYS);
  const low = supplies.filter(isLow);

  return (
    <>
      {low.length > 0 && (
        <p className="notice warn">Por acabarse: {low.map((s) => `${s.name} (${formatQty(s.stock, s.unit)})`).join(', ')}</p>
      )}
      {supplies.length === 0 && (
        <p className="placeholder">
          {owner
            ? 'Agrega tus insumos abajo (carne, tortillas, refrescos...). Luego, en Recetas, dices cuánto usa cada platillo.'
            : 'El dueño todavía no ha dado de alta insumos.'}
        </p>
      )}
      {supplies.map((s) => (
        <SupplyCard key={s.id} supply={s} perDay={recent[s.id]?.perDay ?? 0} owner={owner} who={who} />
      ))}
      {owner && <NewSupply />}
    </>
  );
}

function SupplyCard({ supply: s, perDay, owner, who }: { supply: Supply; perDay: number; owner: boolean; who: string }) {
  const [action, setAction] = useState<Exclude<MovementKind, 'venta'> | null>(null);
  const [qty, setQty] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const left = daysLeft(s, perDay);
  const unit = unitInfo(s.unit).label;

  const save = async () => {
    if (!action || qty === '') return;
    await registerMovement(s, action, Number(qty), who);
    setAction(null);
    setQty('');
  };

  return (
    <article className={isLow(s) ? 'product supply low' : 'product supply'}>
      <div className="soldout-product">
        {owner ? (
          <CommitInput
            className="editor-name"
            value={s.name}
            onCommit={(text) => text.trim() && updateSupply(s.id, { name: text.trim() })}
          />
        ) : (
          <h2>{s.name}</h2>
        )}
        <span className="supply-stock">{formatQty(s.stock, s.unit)}</span>
      </div>
      <p className="product-description">
        {left === null ? 'Sin ventas en los últimos 7 días' : `Alcanza para unos ${left} días al ritmo de esta semana`}
        {isLow(s) && ' · Hay que comprar'}
      </p>
      <div className="editor-row">
        <span className="muted">Avisar cuando queden</span>
        {owner ? (
          <CommitInput
            className="inline-input"
            decimal
            value={String(s.minimum)}
            onCommit={(text) => updateSupply(s.id, { minimum: Number(text || 0) })}
          />
        ) : (
          <span>{s.minimum}</span>
        )}
        <span className="muted">{unit}</span>
      </div>
      {action === null ? (
        <div className="row-end">
          <button className="secondary" onClick={() => setAction('compra')}>
            + Compra
          </button>
          <button className="secondary" onClick={() => setAction('merma')}>
            Merma
          </button>
          <button className="secondary" onClick={() => setAction('conteo')}>
            Contar
          </button>
          {owner &&
            (!confirmRemove ? (
              <button className="secondary" onClick={() => setConfirmRemove(true)}>
                Quitar
              </button>
            ) : (
              <>
                <button className="secondary" onClick={() => setConfirmRemove(false)}>
                  No
                </button>
                <button className="danger" onClick={() => removeSupply(s.id)}>
                  Sí, quitar
                </button>
              </>
            ))}
        </div>
      ) : (
        <form
          className="editor-row"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <span>
            {action === 'compra' ? 'Cuánto compraste' : action === 'merma' ? 'Cuánto se perdió' : 'Cuánto hay contado'}
          </span>
          <input
            autoFocus
            className="inline-input"
            inputMode="decimal"
            value={qty}
            onChange={(e) => setQty(decimalText(e.target.value))}
          />
          <span className="muted">{unit}</span>
          <button type="button" className="secondary" onClick={() => setAction(null)}>
            Cancelar
          </button>
          <button type="submit" className="primary" disabled={qty === ''}>
            Guardar
          </button>
        </form>
      )}
    </article>
  );
}

function NewSupply() {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState<Unit>('kg');
  const [minimum, setMinimum] = useState('');
  return (
    <article className="product">
      <h2>Nuevo insumo</h2>
      <form
        className="staff-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          await addSupply(name, unit, Number(minimum || 0));
          setName('');
          setMinimum('');
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre, ej. Arrachera" />
        <select value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
          {UNITS.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
            </option>
          ))}
        </select>
        <input
          className="inline-input"
          inputMode="decimal"
          value={minimum}
          onChange={(e) => setMinimum(decimalText(e.target.value))}
          placeholder="Mínimo"
        />
        <button type="submit" className="primary" disabled={!name.trim()}>
          Agregar
        </button>
      </form>
    </article>
  );
}

function RecipesEditor() {
  const menu = useMenu();
  const supplies = useSupplies();
  const recipes = useRecipes();
  const [categoryId, setCategoryId] = useState(menu.categories[0].id);

  if (supplies.length === 0) {
    return <p className="placeholder">Primero agrega tus insumos en Existencias.</p>;
  }

  return (
    <div className="menu">
      <nav className="menu-categories">
        {menu.categories.map((c) => {
          const missing = productsOf(menu, c.id)
            .flatMap((p) => p.variants)
            .filter((v) => !recipes[v.id]).length;
          return (
            <button
              key={c.id}
              className={c.id === categoryId ? 'category active' : 'category'}
              onClick={() => setCategoryId(c.id)}
            >
              {c.name}
              {missing > 0 && <span className="count-badge muted-badge">{missing}</span>}
            </button>
          );
        })}
      </nav>
      <section className="menu-products">
        <p className="category-note">
          Pon cuánto usa una pieza de cada platillo. Al cobrar, la app lo descuenta de las existencias. El número en cada
          categoría son los platillos que aún no tienen receta.
        </p>
        {productsOf(menu, categoryId).map((p) => (
          <article key={p.id} className="product editor">
            <h2>{p.name}</h2>
            {p.variants.map((v) => (
              <VariantRecipe
                key={v.id}
                label={v.name || 'Receta'}
                recipe={recipes[v.id] ?? {}}
                supplies={supplies}
                onChange={(supplyId, qty) => editRecipe(v.id, supplyId, qty)}
              />
            ))}
          </article>
        ))}
      </section>
    </div>
  );
}

function VariantRecipe({
  label,
  recipe,
  supplies,
  onChange,
}: {
  label: string;
  recipe: Record<string, number>;
  supplies: Supply[];
  onChange: (supplyId: string, qty: number) => unknown;
}) {
  const unused = supplies.filter((s) => !(s.id in recipe));
  const [supplyId, setSupplyId] = useState('');
  const [qty, setQty] = useState('');
  const picked = unused.find((s) => s.id === supplyId) ?? unused[0];

  return (
    <div className="recipe">
      <span className="recipe-label">{label}</span>
      {supplies
        .filter((s) => s.id in recipe)
        .map((s) => {
          const u = unitInfo(s.unit);
          return (
            <div key={s.id} className="editor-row">
              <span>{s.name}</span>
              <CommitInput
                className="inline-input"
                decimal
                value={String(round(recipe[s.id] * u.factor))}
                onCommit={(text) => onChange(s.id, Number(text || 0) / u.factor)}
              />
              <span className="muted">{u.recipeLabel}</span>
              <button className="secondary" onClick={() => onChange(s.id, 0)}>
                Quitar
              </button>
            </div>
          );
        })}
      {picked && (
        <form
          className="editor-row"
          onSubmit={async (e) => {
            e.preventDefault();
            if (qty === '' || Number(qty) <= 0) return;
            await onChange(picked.id, Number(qty) / unitInfo(picked.unit).factor);
            setSupplyId('');
            setQty('');
          }}
        >
          <select value={picked.id} onChange={(e) => setSupplyId(e.target.value)}>
            {unused.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            className="inline-input"
            inputMode="decimal"
            value={qty}
            onChange={(e) => setQty(decimalText(e.target.value))}
            placeholder={unitInfo(picked.unit).recipeLabel}
          />
          <button type="submit" className="secondary" disabled={qty === '' || Number(qty) <= 0}>
            + Insumo
          </button>
        </form>
      )}
    </div>
  );
}

function History() {
  const supplies = useSupplies();
  const [from] = useState(() => since(WINDOW_DAYS));
  const movements = useMovementsSince(from);
  const totals = usage(movements, WINDOW_DAYS);
  const byId = new Map(supplies.map((s) => [s.id, s]));
  const time = new Intl.DateTimeFormat('es-MX', { weekday: 'short', hour: '2-digit', minute: '2-digit' });

  if (movements.length === 0) {
    return <p className="placeholder">No hay movimientos en los últimos 7 días.</p>;
  }

  return (
    <>
      <article className="product">
        <h2>Últimos 7 días</h2>
        <table className="inv-table">
          <thead>
            <tr>
              <th>Insumo</th>
              <th>Comprado</th>
              <th>Vendido</th>
              <th>Merma y diferencias</th>
            </tr>
          </thead>
          <tbody>
            {supplies
              .filter((s) => totals[s.id])
              .map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{formatQty(totals[s.id].bought, s.unit)}</td>
                  <td>{formatQty(totals[s.id].sold, s.unit)}</td>
                  <td>{formatQty(totals[s.id].lost, s.unit)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </article>
      <article className="product">
        <h2>Movimientos</h2>
        {movements
          .filter((m) => m.kind !== 'venta')
          .slice(0, 50)
          .map((m) => {
            const s = byId.get(m.supplyId);
            return (
              <div key={m.id} className="paid-row">
                <span>
                  {time.format(m.at)} · {MOVEMENT_KINDS.find((k) => k.id === m.kind)!.label} · {s?.name ?? 'Insumo quitado'}
                  {m.by ? ` · ${m.by}` : ''}
                </span>
                <span>
                  {m.qty > 0 ? '+' : ''}
                  {s ? formatQty(m.qty, s.unit) : m.qty}
                </span>
              </div>
            );
          })}
        <p className="hint">Las ventas se descuentan solas al cobrar y se suman en la tabla de arriba.</p>
      </article>
    </>
  );
}
