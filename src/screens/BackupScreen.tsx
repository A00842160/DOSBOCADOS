import { useState } from 'react';
import { restoreBackup, shareBackup, useLastBackup } from '../backup';
import { daysSince, parseBackup, summarize, type Backup } from '../domain/backup';

const dateTime = new Intl.DateTimeFormat('es-MX', { dateStyle: 'long', timeStyle: 'short' });

/** Owner only: save everything to a file, or bring a saved file back. */
export default function BackupScreen() {
  const last = useLastBackup();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; warn?: boolean } | null>(null);
  const [pending, setPending] = useState<Backup | null>(null);
  const days = daysSince(last);

  const share = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await shareBackup();
      setMessage({ text: 'Respaldo listo. Guárdalo en tu WhatsApp, correo o Drive.' });
    } catch {
      setMessage({ text: 'No se pudo hacer el respaldo. Inténtalo otra vez.', warn: true });
    } finally {
      setBusy(false);
    }
  };

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setMessage(null);
    try {
      setPending(parseBackup(await file.text()));
    } catch (e) {
      setMessage({ text: (e as Error).message, warn: true });
    }
  };

  const restore = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await restoreBackup(pending);
      setMessage({ text: 'Listo, la información del respaldo ya está en esta tablet.' });
    } catch {
      setMessage({ text: 'No se pudo restaurar. No se cambió nada.', warn: true });
    } finally {
      setPending(null);
      setBusy(false);
    }
  };

  const summary = pending && summarize(pending);

  return (
    <div className="settings">
      {message && <p className={message.warn ? 'notice warn' : 'notice'}>{message.text}</p>}

      <article className="product">
        <h2>Hacer respaldo</h2>
        <p className="product-description">
          {days === null
            ? 'Todavía no has hecho ningún respaldo.'
            : `Último respaldo: ${dateTime.format(last!)}${days > 0 ? ` (hace ${days} ${days === 1 ? 'día' : 'días'})` : ''}`}
        </p>
        <p className="product-description">
          Guarda ventas, cortes, menú, inventario y recetas en un archivo. Mándatelo por WhatsApp o correo. Lo mejor es
          hacerlo después de cada corte. Los PINs no se guardan en el archivo.
        </p>
        <button className="primary" disabled={busy} onClick={share}>
          Hacer respaldo ahora
        </button>
      </article>

      <article className="product">
        <h2>Restaurar un respaldo</h2>
        <p className="product-description">
          Para una tablet nueva o si se borró la app. Elige el archivo que guardaste.
        </p>
        {!pending ? (
          <label className="secondary file-pick">
            Elegir archivo
            <input
              type="file"
              accept="application/json,.json"
              onChange={(e) => {
                pick(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
        ) : (
          <>
            <p className="notice warn">
              Respaldo del {dateTime.format(summary!.createdAt)}: {summary!.orders} pedidos, {summary!.days} días de caja,{' '}
              {summary!.supplies} insumos. Esto reemplaza todo lo que hay ahora en esta tablet.
            </p>
            <div className="form-actions start">
              <button className="secondary" disabled={busy} onClick={() => setPending(null)}>
                Cancelar
              </button>
              <button className="danger" disabled={busy} onClick={restore}>
                Sí, restaurar
              </button>
            </div>
          </>
        )}
      </article>
    </div>
  );
}
