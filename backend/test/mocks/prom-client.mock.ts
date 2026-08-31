// Track metric values for mock purposes
const metricStore: Map<string, { type: string; value: number; sum?: number; count?: number }> = new Map();

export class Counter<Type> {
  private _name: string;
  
  constructor(config: { name: string; help: string; labelNames?: readonly string[]; registers?: any[] }) {
    this._name = config.name;
    metricStore.set(this._name, { type: 'counter', value: 0 });
  }
  
  inc = jest.fn((labels?: Record<string, string>) => {
    const metric = metricStore.get(this._name);
    if (metric) {
      metric.value += 1;
    }
  });
  
  get value() {
    return metricStore.get(this._name)?.value ?? 0;
  }
}

export class Gauge<Type> {
  private _name: string;
  
  constructor(config: { name: string; help: string; labelNames?: readonly string[]; registers?: any[] }) {
    this._name = config.name;
    metricStore.set(this._name, { type: 'gauge', value: 0 });
  }
  
  set = jest.fn((val: number, labels?: Record<string, string>) => {
    const metric = metricStore.get(this._name);
    if (metric) {
      metric.value = val;
    }
  });
  
  inc = jest.fn((labels?: Record<string, string>) => {
    const metric = metricStore.get(this._name);
    if (metric) {
      metric.value += 1;
    }
  });
  
  dec = jest.fn((labels?: Record<string, string>) => {
    const metric = metricStore.get(this._name);
    if (metric) {
      metric.value -= 1;
    }
  });
  
  get value() {
    return metricStore.get(this._name)?.value ?? 0;
  }
}

export class Histogram<Type> {
  private _name: string;
  
  constructor(config: { name: string; help: string; labelNames?: readonly string[]; buckets?: number[] }) {
    this._name = config.name;
    metricStore.set(this._name, { type: 'histogram', value: 0, sum: 0, count: 0 });
  }
  
  observe = jest.fn((labels: Record<string, string>, val: number) => {
    const metric = metricStore.get(this._name);
    if (metric) {
      metric.value += 1;
      metric.count = (metric.count ?? 0) + 1;
      metric.sum = (metric.sum ?? 0) + val;
    }
  });
  
  startTimer = jest.fn(() => {
    const start = process.hrtime.bigint();
    return (labels?: Record<string, string>) => {
      const duration = Number(process.hrtime.bigint() - start) / 1e9;
      this.observe(labels || {}, duration);
    };
  });
  
  get count() {
    return metricStore.get(this._name)?.count ?? 0;
  }
}

export class Registry {
  metrics = jest.fn(async () => {
    const parts: string[] = [];
    
    metricStore.forEach((metric, name) => {
      if (metric.type === 'counter') {
        parts.push(`# HELP ${name} ${name} counter`);
        parts.push(`# TYPE ${name} counter`);
        parts.push(`${name} ${metric.value}`);
      } else if (metric.type === 'gauge') {
        parts.push(`# HELP ${name} ${name} gauge`);
        parts.push(`# TYPE ${name} gauge`);
        parts.push(`${name} ${metric.value}`);
      } else if (metric.type === 'histogram') {
        parts.push(`# HELP ${name} ${name} histogram`);
        parts.push(`# TYPE ${name} histogram`);
        parts.push(`${name}_count ${metric.count}`);
        parts.push(`${name}_sum ${metric.sum}`);
      }
    });
    
    return parts.join('\n');
  });

  registerMetric = jest.fn();
  getSingleMetric = jest.fn();
  clear = jest.fn(() => {
    metricStore.clear();
  });
  setDefaultMetrics = jest.fn();
}

// Create a shared global registry for tests
export const register = new Registry();