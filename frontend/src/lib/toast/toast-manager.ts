import { toast, ToastOptions } from 'react-toastify';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastConfig extends ToastOptions {
    type: ToastType;
    message: string;
    autoClose?: number | false;
}

/**
 * Toast queue to prevent rapid duplicate toasts
 */
export class ToastManager {
    private queue: Map<string, number> = new Map();
    private readonly DEDUP_TIMEOUT = 3000; // 3 seconds
    private isInitialized = false;

    /**
     * Initialize the toast manager
     * Validates that react-toastify is available
     */
    private ensureInitialized(): void {
        if (!this.isInitialized) {
            try {
                // Verify toast is available
                if (typeof toast === 'undefined') {
                    throw new Error('Toast system not initialized');
                }
                this.isInitialized = true;
            } catch (error) {
                console.error('Failed to initialize ToastManager:', error);
                throw error;
            }
        }
    }

    /**
     * Show a toast with deduplication
     * Prevents showing the same message multiple times within DEDUP_TIMEOUT
     * Handles stale and invalid states gracefully
     */
    show(config: ToastConfig): void {
        try {
            this.ensureInitialized();

            // Validate config
            if (!config || !config.message || !config.type) {
                console.warn('Invalid toast config:', config);
                return;
            }

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
                default:
                    // Exhaustive check - should never reach here
                    const _exhaustive: never = config.type;
                    return _exhaustive;
            }

            // Clean up queue entry after timeout
            setTimeout(() => {
                this.queue.delete(key);
            }, this.DEDUP_TIMEOUT);
        } catch (error) {
            console.error('Error showing toast:', error);
            // Fail silently to prevent breaking the app
        }
    }

    success(message: string, options?: Omit<ToastOptions, 'type'>): void {
        this.show({ type: 'success', message, ...options });
    }

    error(message: string, options?: Omit<ToastOptions, 'type'>): void {
        this.show({ type: 'error', message, ...options });
    }

    info(message: string, options?: Omit<ToastOptions, 'type'>): void {
        this.show({ type: 'info', message, ...options });
    }

    warning(message: string, options?: Omit<ToastOptions, 'type'>): void {
        this.show({ type: 'warning', message, ...options });
    }

    /**
     * Clear all toasts
     */
    clear(): void {
        try {
            this.ensureInitialized();
            toast.dismiss();
        } catch (error) {
            console.error('Error clearing toasts:', error);
        }
    }

    /**
     * Reset the deduplication queue
     * Useful for testing or clearing stale state
     */
    resetQueue(): void {
        this.queue.clear();
    }

    /**
     * Get the current queue size (for testing/debugging)
     */
    getQueueSize(): number {
        return this.queue.size;
    }
}

export const toastManager = new ToastManager();
