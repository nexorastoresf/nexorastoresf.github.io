import { auth } from './firebase.js';
import { getFirestore, collection, doc, getDocFromServer, getDocsFromServer, query, where } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

const db = getFirestore(auth.app);
const asset = name => new URL('./ocr/' + name, import.meta.url).href;
let engine;
let queue = Promise.resolve();
const readings = new Map();

async function startReader() {
  const { default: Tesseract } = await import('./ocr/tesseract.esm.min.js');
  return Tesseract.createWorker('eng', 1, {
    workerPath: asset('worker.min.js'),
    corePath: 'https://cdn.jsdelivr.net/gh/naptha/tesseract.js-core@5ed64d41d0549f4f46fa235d597e643ddd748cbb/tesseract-core-lstm.wasm.js',
    langPath: 'https://cdn.jsdelivr.net/gh/tesseract-ocr/tessdata_fast@b893ed3917f4eb4f3f08a79b1b58fe95097a7473',
    gzip: false,
    workerBlobURL: false
  });
}

function readOnce(image) {
  if (!readings.has(image)) {
    const task = queue.then(async () => {
      engine ||= startReader().catch(error => { engine = null; throw error; });
      const worker = await engine;
      const { data } = await worker.recognize(image);
      return parseReceipt(data.text);
    });
    readings.set(image, task);
    queue = task.catch(() => readings.delete(image));
    if (readings.size > 60) readings.delete(readings.keys().next().value);
  }
  return readings.get(image);
}

export function parseReceipt(text) {
  const plain = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const refs = [...plain.matchAll(/(?:OPERACI[OE0]N|REFERENCIA)\b[\s:#.°º-]*([A-Z0-9-]{4,24})\b/g)]
    .map(match => match[1]).filter(value => /\d/.test(value));
  const amounts = [...plain.matchAll(/\bS\s*\/\.?\s*(\d{1,6}(?:[.,]\d{2})?)(?![\d.,])/g)]
    .map(match => Math.round(Number(match[1].replace(',', '.')) * 100));
  return {
    operation: new Set(refs).size === 1 ? refs[0] : null,
    cents: new Set(amounts).size === 1 ? amounts[0] : null
  };
}

async function previousUse(entry, operation) {
  const claimed = await getDocFromServer(doc(db, 'yapeOperations', operation));
  if (claimed.exists()) {
    const data = claimed.data();
    return data.orderId ? 'pedido ' + data.orderId : 'recarga ' + (data.topupId || 'anterior');
  }
  // Older orders may predate the shared operation registry.
  const matches = ref => getDocsFromServer(query(ref, where('yapeOperation', '==', operation)));
  const [topups, users] = await Promise.all([matches(collection(db, 'yapeTopups')), getDocsFromServer(collection(db, 'users'))]);
  for (const snap of topups.docs) {
    if (entry.kind === 'topup' && snap.id === entry.id) continue;
    if (snap.data().status !== 'rejected') return 'recarga ' + snap.id;
  }
  for (const user of users.docs) {
    const orders = await matches(collection(db, 'users', user.id, 'orders'));
    for (const snap of orders.docs) {
      if (entry.kind === 'order' && user.id === entry.uid && snap.id === entry.id) continue;
      if (snap.data().status !== 'cancelled') return 'pedido ' + snap.id;
    }
  }
  return null;
}

export async function review(entry) {
  const prefix = entry.kind === 'topup' ? 'Recarga de saldo' : 'Compra';
  const expected = entry.amountCents ?? entry.priceCents;
  let operation = entry.yapeOperation;
  let summary = prefix + ' · Sin captura (registro anterior).';
  if (entry.proofImage) {
    if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(entry.proofImage)) throw Error('Formato de captura inválido.');
    const read = await readOnce(entry.proofImage);
    if (!read.operation || read.cents == null) throw Error('No se pudo leer el monto o la operación. Solicita una captura más clara.');
    operation = read.operation;
    summary = prefix + ' · S/ ' + (read.cents / 100).toFixed(2) + ' · Operación ' + operation + '.';
    const used = await previousUse(entry, operation);
    if (used) throw Error(summary + ' Número repetido en ' + used + '.');
    if (operation !== entry.yapeOperation || read.cents !== expected) throw Error(summary + ' Los datos difieren de lo declarado. Revisa el comprobante.');
  } else {
    if (!/^[A-Z0-9-]{4,24}$/.test(operation || '')) throw Error('Referencia inválida.');
    const used = await previousUse(entry, operation);
    if (used) throw Error('Operación repetida en ' + used + '.');
  }
  return summary + ' Sin coincidencias en el historial revisado. Confirma el ingreso en tu Yape.';
}

export function showReview(container, entry, button) {
  const message = document.createElement('p');
  message.setAttribute('role', 'status');
  message.textContent = 'Leyendo el comprobante y revisando el historial…';
  container.append(message);
  button.disabled = true;
  review(entry).then(result => {
    message.textContent = result;
    button.disabled = false;
  }).catch(error => {
    message.textContent = 'Pendiente de revisión. ' + (error.message || 'Actualiza para volver a intentar.');
  });
}
