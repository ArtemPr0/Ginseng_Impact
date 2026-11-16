/** Cuts a building's meshes into solid chunks off the main thread (FractureObject.WorkerFracturer). */
import { cutJob, toData } from './FractureObject';

interface Job {
  id: number;
  position: Float32Array; normal: Float32Array | null; uv: Float32Array | null; index: Uint32Array | null;
  n: number; seed: number; thickness: number;
}

self.onmessage = (ev: MessageEvent<Job>) => {
  const j = ev.data;
  let r: ReturnType<typeof cutJob>;
  try { r = cutJob(j, j.seed, j.thickness); } catch (e) {
    (self as unknown as Worker).postMessage({ id: j.id, error: String(e) });
    return;
  }
  const chunks = r.chunks.map(toData);
  const transfer: ArrayBuffer[] = [];
  for (const c of chunks) transfer.push(c.position.buffer as ArrayBuffer, c.normal.buffer as ArrayBuffer, c.uv.buffer as ArrayBuffer);
  (self as unknown as Worker).postMessage({ id: j.id, chunks, adjacent: r.adjacent }, transfer);
};
