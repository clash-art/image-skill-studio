export async function mapWithConcurrency(items, concurrency, worker) {
  if (items.length === 0) return;

  const workerCount = Math.min(
    items.length,
    Math.max(1, Math.floor(concurrency) || 1),
  );
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
}
