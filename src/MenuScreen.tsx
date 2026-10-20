import { useState } from 'react';
import { CATEGORIES, formatPrice, productsIn } from './menu';

export default function MenuScreen() {
  const [categoryId, setCategoryId] = useState(CATEGORIES[0].id);
  const category = CATEGORIES.find((c) => c.id === categoryId)!;

  return (
    <div className="menu">
      <nav className="menu-categories">
        {CATEGORIES.map((c) => (
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
        {category.note && <p className="category-note">{category.note}</p>}
        {productsIn(categoryId).map((p) => (
          <article key={p.id} className="product">
            <h2>{p.name}</h2>
            {p.description && <p className="product-description">{p.description}</p>}
            <div className="variants">
              {p.variants.map((v) => (
                <div key={v.id} className="variant">
                  <span className="variant-name">
                    {v.favorite && <span className="favorite">★ </span>}
                    {v.name || p.name}
                  </span>
                  <span className="variant-price">{formatPrice(v.price)}</span>
                  {v.description && <span className="variant-description">{v.description}</span>}
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
