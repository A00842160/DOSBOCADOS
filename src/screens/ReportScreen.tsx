import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../db';
import { METHODS } from '../domain/payment';
import { lastDays, month, salesReport, type Range } from '../domain/report';
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
  const r = salesReport(orders, PERIODS.find((p) => p.id === period)!.range());

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
      </div>

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
              {METHODS.map((m) => (
                <Share key={m.id} label={m.label} value={r.byMethod[m.id]} total={r.sales} />
              ))}
              <h3>Canal</h3>
              <Share label="Mesas" value={r.byChannel.mesa} total={r.sales} />
              <Share label="Para llevar" value={r.byChannel.llevar} total={r.sales} />
              <Share label="WhatsApp" value={r.byChannel.whatsapp} total={r.sales} />
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

function Bars({ data }: { data: { label: string; sales: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.sales));
  return (
    <div className="bars" style={{ gridTemplateColumns: `repeat(${data.length}, 1fr)` }}>
      {data.map((d, i) => (
        <div key={i} className="bar-col" title={`${d.label}: ${formatPrice(d.sales)}`}>
          <span className="bar-value">{d.sales > 0 && data.length <= 14 ? formatPrice(d.sales) : ''}</span>
          <div className="bar" style={{ height: `${(d.sales / max) * 100}%` }} />
          <span className="bar-label">{data.length <= 14 || i % 5 === 0 ? d.label : ''}</span>
        </div>
      ))}
    </div>
  );
}
