/**
 * Purchase Modal telemetry unit tests
 * Verifies privacy-safe telemetry hooks.
 */

import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));

import { track } from "@/lib/analytics";
import { usePurchaseModalTelemetry } from "@/hooks/usePurchaseModalTelemetry";

const mockTrack = vi.mocked(track);

beforeEach(() => mockTrack.mockClear());

describe("usePurchaseModalTelemetry", () => {
    describe("trackModalViewed", () => {
        it("emits purchase_modal_viewed with correct fields", () => {
            const { result } = renderHook(() => usePurchaseModalTelemetry());
            act(() =>
                result.current.trackModalViewed({
                    itemName: "Speed Boost",
                    currency: "USD",
                    value: "100.00",
                }),
            );
            expect(mockTrack).toHaveBeenCalledWith("purchase_modal_viewed", {
                route: "/shop",
                item_name: "Speed Boost",
                currency: "USD",
                value: "100.00",
            });
        });

        it("works without optional fields", () => {
            const { result } = renderHook(() => usePurchaseModalTelemetry());
            act(() => result.current.trackModalViewed({ itemName: "Dice" }));
            expect(mockTrack).toHaveBeenCalledWith("purchase_modal_viewed", {
                route: "/shop",
                item_name: "Dice",
                currency: undefined,
                value: undefined,
            });
        });
    });

    describe("trackModalCanceled", () => {
        it("emits purchase_modal_canceled", () => {
            const { result } = renderHook(() => usePurchaseModalTelemetry("/home"));
            act(() =>
                result.current.trackModalCanceled({
                    itemName: "Lucky Dice",
                    currency: "NEAR",
                    value: 10,
                }),
            );
            expect(mockTrack).toHaveBeenCalledWith("purchase_modal_canceled", {
                route: "/home",
                item_name: "Lucky Dice",
                currency: "NEAR",
                value: 10,
            });
        });
    });

    describe("trackModalConfirmed", () => {
        it("emits purchase_modal_confirmed", () => {
            const { result } = renderHook(() => usePurchaseModalTelemetry());
            act(() =>
                result.current.trackModalConfirmed({
                    itemName: "Gold",
                }),
            );
            expect(mockTrack).toHaveBeenCalledWith("purchase_modal_confirmed", {
                route: "/shop",
                item_name: "Gold",
                currency: undefined,
                value: undefined,
            });
        });
    });

    describe("PII safety — taxonomy schema", () => {
        it("purchase_modal_viewed schema contains no PII fields", async () => {
            const { analyticsEventSchema } = await import("@/lib/analytics/taxonomy");
            const fields = analyticsEventSchema.purchase_modal_viewed as readonly string[];
            ["user_id", "wallet_address", "email", "token", "session_id"].forEach((f) =>
                expect(fields).not.toContain(f),
            );
        });

        it("purchase_modal_canceled schema contains no PII fields", async () => {
            const { analyticsEventSchema } = await import("@/lib/analytics/taxonomy");
            const fields = analyticsEventSchema.purchase_modal_canceled as readonly string[];
            ["user_id", "wallet_address", "email", "token", "session_id"].forEach((f) =>
                expect(fields).not.toContain(f),
            );
        });

        it("purchase_modal_confirmed schema contains no PII fields", async () => {
            const { analyticsEventSchema } = await import("@/lib/analytics/taxonomy");
            const fields = analyticsEventSchema.purchase_modal_confirmed as readonly string[];
            ["user_id", "wallet_address", "email", "token", "session_id"].forEach((f) =>
                expect(fields).not.toContain(f),
            );
        });

        it("sanitizeAnalyticsPayload strips PII fields", async () => {
            const { sanitizeAnalyticsPayload } = await import("@/lib/analytics/taxonomy");
            const result = sanitizeAnalyticsPayload("purchase_modal_viewed", {
                route: "/shop",
                item_name: "Test",
                user_id: "12345",
            });
            expect(result).not.toHaveProperty("user_id");
            expect(result).toHaveProperty("item_name", "Test");
        });
    });
});
