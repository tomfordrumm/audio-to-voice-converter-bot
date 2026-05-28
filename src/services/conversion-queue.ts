export class ConversionQueue {
    private active = 0;
    private readonly queue: Array<() => void> = [];

    constructor(
        private readonly maxConcurrent: number,
        private readonly maxQueued: number,
    ) {}

    hasCapacity() {
        return this.active + this.queue.length < this.maxConcurrent + this.maxQueued;
    }

    async run<T>(task: () => Promise<T>) {
        return new Promise<T>((resolve, reject) => {
            const run = () => {
                this.active += 1;

                task()
                    .then(resolve)
                    .catch(reject)
                    .finally(() => {
                        this.active -= 1;
                        const next = this.queue.shift();

                        if (next) {
                            next();
                        }
                    });
            };

            if (this.active < this.maxConcurrent) {
                run();
                return;
            }

            this.queue.push(run);
        });
    }
}
