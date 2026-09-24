import { toast, ToastOptions } from 'react-toastify';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastConfig extends ToastOptions {
    type: ToastType;
    message: string;
    autoClose?: number | false;
}

/**
 * Toast queue to prevent rapid duplicate toasts
 */
class ToastManager {
    private queue: Map<string, number> = new Map();
    private readonly DEDUP_TIMEOUT = 3000; // 3 seconds

    /**
     * Show a toast with deduplication
     * Prevents showing the same message multiple times within DEDUP_TIMEOUT
     */
    show(config: ToastConfig) {
        const key = `${config.type}:${config.message}`;
        const lastShown = this.queue.get(key);
        const now = Date.now();

        // Skip if same toast shown recently
        if (lastShown && now - lastShown < this.DEDUP_TIMEOUT) {
            return;
        }

        this.queue.set(key, now);

        const options: ToastOptions = {
            autoClose: config.autoClose ?? 5000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            ...config,
        };

        switch (config.type) {
            case 'success':
                toast.success(config.message, options);
                break;
            case 'error':
                toast.error(config.message, options);
                break;
            case 'info':
                toast.info(config.message, options);
                break;
            case 'warning':
                toast.warning(config.message, options);
                break;
        }

        // Clean up queue entry after timeout
        setTimeout(() => {
            this.queue.delete(key);
        }, this.DEDUP_TIMEOUT);
    }

    success(message: string, options?: Omit<ToastOptions, 'type'>) {
        this.show({ type: 'success', message, ...options });
    }

    error(message: string, options?: Omit<ToastOptions, 'type'>) {
        this.show({ type: 'error', message, ...options });
    }

    info(message: string, options?: Omit<ToastOptions, 'type'>) {
        this.show({ type: 'info', message, ...options });
    }

    warning(message: string, options?: Omit<ToastOptions, 'type'>) {
        this.show({ type: 'warning', message, ...options });
    }

    /**
     * Clear all toasts
     */
    clear() {
        toast.dismiss();
    }
}

export const toastManager = new ToastManager();
