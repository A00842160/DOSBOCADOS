// Tickets are plain text lines of a fixed width, so the same output can be
// shown on screen and sent to an ESC/POS printer later.
// 48 characters fits an 80 mm printer; 32 fits a 58 mm one.

import { formatPrice } from '../menu';
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

export interface BillExtras {
  /** Payment lines appended under the total, e.g. method, tip and change. */
  footer?: string[];
}

export function billTicket(order: Order, now = Date.now(), extras: BillExtras = {}, width = TICKET_WIDTH): string[] {
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
  if (extras.footer?.length) out.push(...extras.footer);
  out.push('', center('¡Gracias por su visita!', width));
  return out;
}
