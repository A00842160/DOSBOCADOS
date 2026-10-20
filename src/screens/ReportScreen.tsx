import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../db';
import { CHANNELS, isPlatform } from '../domain/order';
import { METHODS } from '../domain/payment';
import { foodCost } from '../domain/inventory';
import { kitchenTimes, LATE_MINUTES } from '../domain/kitchen';
import { lastDays, month, paidIn, salesReport, type Range } from '../domain/report';
import { useRecipes, useSupplies } from '../inventoryStore';
import { formatPrice } from '../menu';

type Period = 'semana' | 'mes' | 'mes-pasado';

const PERIODS: { id: Period; label: string; range: () => Range }[] = [
  { id: 'semana', label: 'Últimos 7 días', range: () => lastDays(7) },
  { id: 'mes', label: 'Este mes', range: () => month(0) },
  { id: 'mes-pasado', label: 'Mes pasado', range: () => month(-1) },
];

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/** Owner only: how sales went over a week or a month. */
export default function ReportScreen() {
  const [period, setPeriod] = useState<Period>('semana');
  const orders = useLiveQuery(() => db.orders.toArray(), [], []);
  const range = PERIODS.find((p) => p.id === period)!.range();
  const r = salesReport(orders, range);
  const food = foodCost(paidIn(orders, range), useRecipes(), useSupplies());
  const kitchen = kitchenTimes(orders, range);
  const covered = r.sales ? Math.round((food.coveredSales / r.sales) * 100) : 0;

  const dayLabel = (day: number) =>
    new Intl.DateTimeFormat('es-MX', period === 'semana' ? { weekday: 'short', day: 'numeric' } : { day: 'numeric' }).format(day);

  const busyHours = r.byHour.map((sales, hour) => ({ hour, sales })).filter((h) => h.sales > 0);
  const firstHour = busyHours.length ? busyHours[0].hour : 12;
  const lastHour = busyHours.length ? busyHours.at(-1)!.hour : 23;
  const hours = r.byHour.slice(firstHour, lastHour + 1).map((sales, i) => ({ label: `${firstHour + i}h`, sales }));

  return (
    <div className="report">
      <div className="segmented">
        {PERIODS.map((p) => (
          <button key={p.id} className={p.id === period ? 'seg active' : 'seg'} onClick={() => setPeriod(p.id)}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="stats">
        <Stat label="Venta" value={formatPrice(r.sales)} />
        <Stat label="Pedidos cobrados" value={String(r.orders)} />
        <Stat label="Ticket promedio" value={formatPrice(r.averageTicket)} />
        <Stat label="Propinas" value={formatPrice(r.tips)} />
        {food.cost > 0 && (
          <>
            <Stat label="Costo de insumos (aprox.)" value={formatPrice(food.cost)} />
            <Stat label="Te queda después de insumos" value={formatPrice(r.sales - r.commissions - food.cost)} />
          </>
        )}
      </div>
      {food.cost > 0 && covered < 100 && (
        <p className="hint">
          El costo incluye solo los platillos con receta y costo ({covered}% de la venta). Lo demás cuenta como si no
          costara.
        </p>
      )}

      {kitchen.rounds > 0 && (
        <article className="product">
          <h2>Tiempo de cocina</h2>
          <div className="stats">
            <Stat label="Promedio para salir" value={`${kitchen.averageMinutes} min`} />
            <Stat label={`Rondas de ${LATE_MINUTES} min o más`} value={`${kitchen.latePercent}%`} />
            <Stat label="Rondas medidas" value={String(kitchen.rounds)} />
          </div>
          <h3>Minutos promedio según la hora</h3>
          <Bars
            data={kitchen.byHour
              .map((m, hour) => ({ label: `${hour}h`, sales: m }))
              .filter((h): h is { label: string; sales: number } => h.sales !== null)}
            format={(m) => `${m} min`}
          />
          {kitchen.slowest.length > 0 && (
            <>
              <h3>Los que más tardan</h3>
              {kitchen.slowest.map((d) => (
                <div key={d.name} className="sum-row">
                  <span>
                    {d.name} <span className="muted">({d.servings} veces)</span>
                  </span>
                  <span>{d.averageMinutes} min</span>
                </div>
              ))}
            </>
          )}
        </article>
      )}

      {r.orders === 0 ? (
        <p className="placeholder">Todavía no hay ventas cobradas en este periodo.</p>
      ) : (
        <>
          <article className="product">
            <h2>Venta por día</h2>
            <Bars data={r.byDay.map((d) => ({ label: dayLabel(d.day), sales: d.sales }))} />
          </article>

          <div className="corte">
            <article className="product">
              <h2>Horas con más venta</h2>
              <Bars data={hours} />
            </article>
            {period !== 'semana' && (
              <article className="product">
                <h2>Venta por día de la semana</h2>
                <Bars data={[1, 2, 3, 4, 5, 6, 0].map((d) => ({ label: WEEKDAYS[d], sales: r.byWeekday[d] }))} />
              </article>
            )}
          </div>

          <div className="corte">
            <article className="product">
              <h2>Platillos más vendidos</h2>
              {r.items.slice(0, 15).map((item, i) => (
                <div key={item.name} className="sum-row">
                  <span>
                    {i + 1}. {item.name} <span className="muted">× {item.qty}</span>
                  </span>
                  <span>{formatPrice(item.total)}</span>
                </div>
              ))}
            </article>
            <article className="product">
              <h2>Forma de pago</h2>
              {METHODS.filter((m) => m.id !== 'plataforma' || r.byMethod.plataforma > 0).map((m) => (
                <Share key={m.id} label={m.label} value={r.byMethod[m.id]} total={r.sales} />
              ))}
              <h3>Canal</h3>
              {CHANNELS.filter((ch) => !isPlatform(ch.id) || r.byChannel[ch.id] > 0).map((ch) => (
                <Share key={ch.id} label={ch.label} value={r.byChannel[ch.id]} total={r.sales} />
              ))}
              {r.commissions > 0 && (
                <>
                  <h3>Apps de reparto</h3>
                  <div className="sum-row">
                    <span>Comisiones</span>
                    <span>{formatPrice(r.commissions)}</span>
                  </div>
                  <div className="sum-row">
                    <span>Venta neta</span>
                    <span>{formatPrice(r.sales - r.commissions)}</span>
                  </div>
                </>
              )}
            </article>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}

function Share({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="sum-row">
      <span>{label}</span>
      <span>
        {formatPrice(value)} <span className="muted">({pct}%)</span>
      </span>
    </div>
  );
}

function Bars({
  data,
  format = formatPrice,
}: {
  data: { label: string; sales: number }[];
  format?: (value: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.sales));
  return (
    <div className="bars" style={{ gridTemplateColumns: `repeat(${data.length}, 1fr)` }}>
      {data.map((d, i) => (
        <div key={i} className="bar-col" title={`${d.label}: ${format(d.sales)}`}>
          <span className="bar-value">{d.sales > 0 && data.length <= 14 ? format(d.sales) : ''}</span>
          <div className="chart-bar" style={{ height: `${(d.sales / max) * 100}%` }} />
          <span className="bar-label">{data.length <= 14 || i % 5 === 0 ? d.label : ''}</span>
        </div>
      ))}
    </div>
  );
}
