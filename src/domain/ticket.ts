// Tickets are plain text lines of a fixed width, so the same output can be
// shown on screen and sent to an ESC/POS printer later.
// 48 characters fits an 80 mm printer; 32 fits a 58 mm one.

import { formatPrice } from '../menu';
import { SALIDA_KINDS, type Corte, type Day } from './cash';
import { changeDue, METHODS, methodLabel, payments } from './payment';
import { activeLines, lineTotal, orderLabel, orderTotal, type KitchenBatch, type Order, type OrderLine } from './order';

export const TICKET_WIDTH = 48;

function rule(width: number): string {
  return '-'.repeat(width);
}

function center(text: string, width: number): string {
  const pad = Math.max(0, Math.floor((width - text.length) / 2));
  return ' '.repeat(pad) + text;
}

function spread(left: string, right: string, width: number): string {
  const space = width - left.length - right.length;
  if (space >= 1) return left + ' '.repeat(space) + right;
  return `${left.slice(0, width - right.length - 1)} ${right}`;
}

/** Wraps text to the ticket width, indenting continuation lines. */
function wrap(text: string, width: number, indent: string): string[] {
  if (text.length <= width) return [text];
  const out: string[] = [];
  let current = '';
  for (const word of text.split(' ')) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > width && current) {
      out.push(current);
      current = indent + word;
    } else {
      current = candidate;
    }
  }
  if (current) out.push(current);
  return out;
}

export function formatDateTime(time: number): string {
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(time);
}

function customerLines(order: Order): string[] {
  const out = [orderLabel(order)];
  if (order.phone) out.push(`Tel. ${order.phone}`);
  return out;
}

function kitchenLine(line: OrderLine, width: number, suffix = ''): string[] {
  const out = wrap(`${String(line.qty).padStart(2)}  ${line.name}${suffix}`, width, '    ');
  for (const mod of line.mods) out.push(...wrap(`    - ${mod}`, width, '      '));
  if (line.note) out.push(...wrap(`    * ${line.note}`, width, '      '));
  return out;
}

export function kitchenTicket(order: Order, batch: KitchenBatch, now = Date.now(), width = TICKET_WIDTH): string[] {
  const out = [spread('COCINA', `Ronda ${batch.number}`, width), ...customerLines(order), formatDateTime(now), rule(width)];
  for (const line of batch.newLines) out.push(...kitchenLine(line, width));
  if (batch.changedLines.length > 0) {
    if (batch.newLines.length > 0) out.push(rule(width));
    out.push('CAMBIOS:');
    for (const line of batch.changedLines) out.push(...kitchenLine(line, width, line.cancelled ? ' (CANCELADO)' : ''));
  }
  out.push(rule(width));
  return out;
}

function paymentLines(order: Order, width: number): string[] {
  const out: string[] = [];
  for (const p of payments(order)) {
    out.push(spread(methodLabel(p.method), formatPrice(p.amount), width));
    if (p.tip > 0) out.push(spread('  Propina', formatPrice(p.tip), width));
    if (p.method === 'efectivo' && p.received !== undefined) {
      out.push(spread('  Recibido', formatPrice(p.received), width));
      out.push(spread('  Cambio', formatPrice(changeDue(p.amount, p.tip, p.received)), width));
    }
  }
  return out;
}

export function billTicket(order: Order, now = Date.now(), width = TICKET_WIDTH): string[] {
  const out = [
    center('DOSBOCADOS', width),
    center('Comida al carbón', width),
    '',
    ...customerLines(order),
    formatDateTime(now),
    rule(width),
  ];
  for (const line of activeLines(order)) {
    const left = `${line.qty} ${line.name}`;
    const price = formatPrice(lineTotal(line));
    const wrapped = wrap(left, width - price.length - 1, '  ');
    wrapped.forEach((text, i) => out.push(i === wrapped.length - 1 ? spread(text, price, width) : text));
  }
  out.push(rule(width), spread('TOTAL', formatPrice(orderTotal(order)), width));
  const paid = paymentLines(order, width);
  if (paid.length > 0) out.push('', ...paid);
  out.push('', center('¡Gracias por su visita!', width));
  return out;
}

const CHANNEL_LABELS = { mesa: 'Mesas', llevar: 'Para llevar', whatsapp: 'WhatsApp' } as const;

/** The corte as a printable report for the owner. */
export function corteTicket(day: Day, c: Corte, now = Date.now(), width = TICKET_WIDTH): string[] {
  const money = (label: string, amount: number) => spread(label, formatPrice(amount), width);
  const out = [
    center('CORTE DE CAJA', width),
    `Abrió: ${formatDateTime(day.openedAt)}${day.openedBy ? ` (${day.openedBy})` : ''}`,
    `Corte: ${formatDateTime(day.closedAt ?? now)}${day.closedBy ? ` (${day.closedBy})` : ''}`,
    rule(width),
    money('VENTA TOTAL', c.sales),
    spread('Pedidos cobrados', String(c.orders), width),
    money('Ticket promedio', c.averageTicket),
    '',
    'POR FORMA DE PAGO',
  ];
  for (const m of METHODS) out.push(money(`  ${m.label}`, c.byMethod[m.id].sales));
  out.push('', 'POR CANAL');
  for (const [channel, label] of Object.entries(CHANNEL_LABELS) as [keyof typeof CHANNEL_LABELS, string][]) {
    const row = c.byChannel[channel];
    out.push(money(`  ${label} (${row.orders})`, row.sales));
  }
  out.push('', 'PROPINAS', money('  En efectivo', c.tipsCash), money('  Con tarjeta/transf.', c.tipsCard));
  out.push(rule(width), 'EFECTIVO EN CAJA', money('  Fondo', c.fondo), money('  + Ventas en efectivo', c.byMethod.efectivo.sales));
  out.push(money('  + Propinas en efectivo', c.tipsCash));
  for (const k of SALIDA_KINDS) if (c.salidasByKind[k.id] > 0) out.push(money(`  - Salidas: ${k.label}`, c.salidasByKind[k.id]));
  out.push(money('  = Esperado', c.expectedCash));
  if (day.counted !== undefined) {
    out.push(money('  Contado', day.counted), money('  Diferencia', day.counted - c.expectedCash));
  }
  if (day.salidas.length > 0) {
    out.push(rule(width), 'SALIDAS DE CAJA');
    for (const s of day.salidas) {
      const label = `  ${s.concept || SALIDA_KINDS.find((k) => k.id === s.kind)!.label}`;
      out.push(money(label.slice(0, width - 12), s.amount));
    }
  }
  if (c.cancelledOrders > 0 || c.cancelledLines > 0) {
    out.push(rule(width), spread('Pedidos cancelados', String(c.cancelledOrders), width));
    out.push(money(`Platillos cancelados (${c.cancelledLines})`, c.cancelledAmount));
  }
  if (c.openOrders > 0) out.push(rule(width), money(`ABIERTOS SIN COBRAR (${c.openOrders})`, c.openAmount));
  if (c.items.length > 0) {
    out.push(rule(width), 'PLATILLOS VENDIDOS');
    for (const item of c.items) {
      const price = formatPrice(item.total);
      const wrapped = wrap(`${item.qty} ${item.name}`, width - price.length - 1, '  ');
      wrapped.forEach((text, i) => out.push(i === wrapped.length - 1 ? spread(text, price, width) : text));
    }
  }
  out.push(rule(width));
  return out;
}
