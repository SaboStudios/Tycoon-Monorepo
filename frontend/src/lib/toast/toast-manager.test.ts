import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { toastManager } from './toast-manager';

// Mock react-toastify
vi.mock('react-toastify', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warning: vi.fn(),
        dismiss: vi.fn(),
    },
    ToastOptions: {},
}));

import { toast } from 'react-toastify';

describe('ToastManager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        toastManager.resetQueue();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('show', () => {
        it('should show a success toast', () => {
            toastManager.show({
                type: 'success',
                message: 'Success message',
            });

            expect(toast.success).toHaveBeenCalledWith(
                'Success message',
                expect.objectContaining({
                    autoClose: 5000,
                    hideProgressBar: false,
                    closeOnClick: true,
                    pauseOnHover: true,
                    draggable: true,
                })
            );
        });

        it('should show an error toast', () => {
            toastManager.show({
                type: 'error',
                message: 'Error message',
            });

            expect(toast.error).toHaveBeenCalledWith(
                'Error message',
                expect.any(Object)
            );
        });

        it('should show an info toast', () => {
            toastManager.show({
                type: 'info',
                message: 'Info message',
            });

            expect(toast.info).toHaveBeenCalledWith(
                'Info message',
                expect.any(Object)
            );
        });

        it('should show a warning toast', () => {
            toastManager.show({
                type: 'warning',
                message: 'Warning message',
            });

            expect(toast.warning).toHaveBeenCalledWith(
                'Warning message',
                expect.any(Object)
            );
        });

        it('should respect custom autoClose option', () => {
            toastManager.show({
                type: 'success',
                message: 'Custom timeout',
                autoClose: 10000,
            });

            expect(toast.success).toHaveBeenCalledWith(
                'Custom timeout',
                expect.objectContaining({
                    autoClose: 10000,
                })
            );
        });

        it('should allow autoClose to be false', () => {
            toastManager.show({
                type: 'success',
                message: 'No auto close',
                autoClose: false,
            });

            expect(toast.success).toHaveBeenCalledWith(
                'No auto close',
                expect.objectContaining({
                    autoClose: false,
                })
            );
        });

        it('should deduplicate identical toasts within timeout', () => {
            toastManager.show({
                type: 'success',
                message: 'Duplicate message',
            });

            toastManager.show({
                type: 'success',
                message: 'Duplicate message',
            });

            expect(toast.success).toHaveBeenCalledTimes(1);
        });

        it('should allow duplicate toasts after timeout', () => {
            toastManager.show({
                type: 'success',
                message: 'Message',
            });

            expect(toast.success).toHaveBeenCalledTimes(1);

            // Advance time past dedup timeout (3000ms)
            vi.advanceTimersByTime(3100);

            toastManager.show({
                type: 'success',
                message: 'Message',
            });

            expect(toast.success).toHaveBeenCalledTimes(2);
        });

        it('should allow different toast types with same message', () => {
            toastManager.show({
                type: 'success',
                message: 'Same message',
            });

            toastManager.show({
                type: 'error',
                message: 'Same message',
            });

            expect(toast.success).toHaveBeenCalledTimes(1);
            expect(toast.error).toHaveBeenCalledTimes(1);
        });

        it('should handle invalid config gracefully', () => {
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            toastManager.show({
                type: 'success',
                message: '',
            } as any);

            expect(consoleSpy).toHaveBeenCalled();
            expect(toast.success).not.toHaveBeenCalled();

            consoleSpy.mockRestore();
        });

        it('should handle null config gracefully', () => {
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            toastManager.show(null as any);

            expect(consoleSpy).toHaveBeenCalled();

            consoleSpy.mockRestore();
        });

        it('should clean up queue after dedup timeout', () => {
            toastManager.show({
                type: 'success',
                message: 'Message',
            });

            expect(toastManager.getQueueSize()).toBe(1);

            vi.advanceTimersByTime(3100);

            expect(toastManager.getQueueSize()).toBe(0);
        });
    });

    describe('convenience methods', () => {
        it('should call show with success type', () => {
            toastManager.success('Success');

            expect(toast.success).toHaveBeenCalledWith(
                'Success',
                expect.any(Object)
            );
        });

        it('should call show with error type', () => {
            toastManager.error('Error');

            expect(toast.error).toHaveBeenCalledWith(
                'Error',
                expect.any(Object)
            );
        });

        it('should call show with info type', () => {
            toastManager.info('Info');

            expect(toast.info).toHaveBeenCalledWith(
                'Info',
                expect.any(Object)
            );
        });

        it('should call show with warning type', () => {
            toastManager.warning('Warning');

            expect(toast.warning).toHaveBeenCalledWith(
                'Warning',
                expect.any(Object)
            );
        });

        it('should pass options to show method', () => {
            toastManager.success('Message', { autoClose: 2000 });

            expect(toast.success).toHaveBeenCalledWith(
                'Message',
                expect.objectContaining({
                    autoClose: 2000,
                })
            );
        });
    });

    describe('clear', () => {
        it('should dismiss all toasts', () => {
            toastManager.clear();

            expect(toast.dismiss).toHaveBeenCalled();
        });

        it('should handle errors gracefully', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            vi.mocked(toast.dismiss).mockImplementation(() => {
                throw new Error('Dismiss failed');
            });

            expect(() => toastManager.clear()).not.toThrow();
            expect(consoleSpy).toHaveBeenCalled();

            consoleSpy.mockRestore();
        });
    });

    describe('state management', () => {
        it('should reset queue', () => {
            toastManager.show({
                type: 'success',
                message: 'Message 1',
            });

            toastManager.show({
                type: 'error',
                message: 'Message 2',
            });

            expect(toastManager.getQueueSize()).toBe(2);

            toastManager.resetQueue();

            expect(toastManager.getQueueSize()).toBe(0);
        });

        it('should allow duplicate after queue reset', () => {
            toastManager.show({
                type: 'success',
                message: 'Message',
            });

            expect(toast.success).toHaveBeenCalledTimes(1);

            toastManager.resetQueue();

            toastManager.show({
                type: 'success',
                message: 'Message',
            });

            expect(toast.success).toHaveBeenCalledTimes(2);
        });

        it('should report correct queue size', () => {
            expect(toastManager.getQueueSize()).toBe(0);

            toastManager.show({
                type: 'success',
                message: 'Message 1',
            });

            expect(toastManager.getQueueSize()).toBe(1);

            toastManager.show({
                type: 'error',
                message: 'Message 2',
            });

            expect(toastManager.getQueueSize()).toBe(2);

            toastManager.resetQueue();

            expect(toastManager.getQueueSize()).toBe(0);
        });
    });

    describe('error handling', () => {
        it('should handle show errors gracefully', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            vi.mocked(toast.success).mockImplementation(() => {
                throw new Error('Toast failed');
            });

            expect(() => {
                toastManager.show({
                    type: 'success',
                    message: 'Message',
                });
            }).not.toThrow();

            expect(consoleSpy).toHaveBeenCalled();

            consoleSpy.mockRestore();
        });

        it('should handle convenience method errors gracefully', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            vi.mocked(toast.error).mockImplementation(() => {
                throw new Error('Toast failed');
            });

            expect(() => {
                toastManager.error('Message');
            }).not.toThrow();

            expect(consoleSpy).toHaveBeenCalled();

            consoleSpy.mockRestore();
        });
    });
});
