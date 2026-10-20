interface Props {
  title: string;
  lines: string[];
  onClose: () => void;
}

/** Shows a ticket as it will print. Printing arrives with the Bluetooth printer step. */
export default function TicketDialog({ title, lines, onClose }: Props) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog ticket-dialog" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <pre className="paper">{lines.join('\n')}</pre>
        <div className="form-actions">
          <button className="secondary" disabled>
            Imprimir (falta impresora)
          </button>
          <button className="primary" onClick={onClose}>
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}
