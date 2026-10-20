import { useState } from 'react';
import { clearSoldOut, setSoldOut, useSoldOut } from '../availability';
import { productsOf } from '../domain/menuEdit';
import { useMenu } from '../menuStore';

export default function SoldOutScreen() {
  const soldOut = useSoldOut();
  const menu = useMenu();
  const [categoryId, setCategoryId] = useState('bebidas');

  return (
    <div className="menu">
      <nav className="menu-categories">
        {menu.categories.map((c) => {
          const count = productsOf(menu, c.id).flatMap((p) => p.variants).filter((v) => soldOut.has(v.id)).length;
          return (
            <button
              key={c.id}
              className={c.id === categoryId ? 'category active' : 'category'}
              onClick={() => setCategoryId(c.id)}
            >
              {c.name}
              {count > 0 && <span className="count-badge">{count}</span>}
            </button>
          );
        })}
      </nav>
      <section className="menu-products">
        <div className="soldout-head">
          <p className="category-note">Lo que marques como agotado ya no se puede elegir al tomar pedidos.</p>
          {soldOut.size > 0 && (
            <button className="secondary" onClick={() => clearSoldOut()}>
              Todo disponible
            </button>
          )}
        </div>
        {productsOf(menu, categoryId).map((p) => {
          const ids = p.variants.map((v) => v.id);
          const allOut = ids.every((id) => soldOut.has(id));
          return (
            <article key={p.id} className="product">
              <div className="soldout-product">
                <h2>{p.name}</h2>
                {p.variants.length > 1 && (
                  <button className="secondary" onClick={() => setSoldOut(ids, !allOut)}>
                    {allOut ? 'Activar todos' : 'Agotar todos'}
                  </button>
                )}
              </div>
              <div className="variants">
                {p.variants.map((v) => {
                  const out = soldOut.has(v.id);
                  return (
                    <button
                      key={v.id}
                      className={out ? 'toggle out' : 'toggle'}
                      onClick={() => setSoldOut([v.id], !out)}
                    >
                      <span className="variant-name">{v.name || p.name}</span>
                      <span className="toggle-state">{out ? 'Agotado' : 'Disponible'}</span>
                    </button>
                  );
                })}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
