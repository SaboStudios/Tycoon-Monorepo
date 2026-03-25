import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TradeModal, TradePlayer } from "../src/components/game/TradeModal";

// ─── Mock data ───────────────────────────────────────────────────────────────

const mockCurrentPlayer: TradePlayer = {
    id: "p1",
    name: "Alice",
    cash: 1500,
    properties: [
        { name: "Park Place", color: "bg-blue-700", price: 350, type: "property" },
        {
            name: "Boardwalk",
            color: "bg-blue-700",
            price: 400,
            type: "property",
        },
        {
            name: "Reading Railroad",
            color: "bg-gray-800",
            price: 200,
            type: "railroad",
        },
    ],
};

const mockPlayers: TradePlayer[] = [
    mockCurrentPlayer,
    {
        id: "p2",
        name: "Bob",
        cash: 1200,
        properties: [
            {
                name: "Mediterranean Ave",
                color: "bg-purple-900",
                price: 60,
                type: "property",
            },
            {
                name: "Electric Company",
                color: "bg-yellow-400",
                price: 150,
                type: "utility",
            },
        ],
    },
    {
        id: "p3",
        name: "Carol",
        cash: 800,
        properties: [
            {
                name: "Oriental Ave",
                color: "bg-cyan-400",
                price: 100,
                type: "property",
            },
        ],
    },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderModal(props: Partial<React.ComponentProps<typeof TradeModal>> = {}) {
    const defaultProps = {
        isOpen: true,
        onClose: vi.fn(),
        players: mockPlayers,
        currentPlayer: mockCurrentPlayer,
    };
    const merged = { ...defaultProps, ...props };
    const result = render(<TradeModal {...merged} />);
    return { ...result, onClose: merged.onClose };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("TradeModal", () => {
    let user: ReturnType<typeof userEvent.setup>;

    beforeEach(() => {
        user = userEvent.setup();
    });

    // 1. Renders when open
    it("renders trade UI when isOpen is true", () => {
        renderModal();
        expect(screen.getByTestId("trade-modal")).toBeDefined();
        expect(screen.getByText("Propose Trade")).toBeDefined();
        expect(screen.getByLabelText("Trade Partner")).toBeDefined();
        expect(screen.getByTestId("offer-column")).toBeDefined();
        expect(screen.getByTestId("request-column")).toBeDefined();
        expect(screen.getByTestId("cancel-button")).toBeDefined();
        expect(screen.getByTestId("confirm-button")).toBeDefined();
    });

    // 2. Hidden when closed
    it("does not render when isOpen is false", () => {
        renderModal({ isOpen: false });
        expect(screen.queryByTestId("trade-modal")).toBeNull();
    });

    // 3. Close via Cancel button
    it("calls onClose when Cancel is clicked", async () => {
        const { onClose } = renderModal();
        await user.click(screen.getByTestId("cancel-button"));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    // 4. Close via Escape key
    it("calls onClose when Escape is pressed", async () => {
        const { onClose } = renderModal();
        await user.keyboard("{Escape}");
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    // 5. Close via backdrop click
    it("calls onClose when backdrop is clicked", async () => {
        const { onClose } = renderModal();
        await user.click(screen.getByTestId("trade-modal-backdrop"));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    // 6. Partner selection
    it("allows selecting a trade partner", async () => {
        renderModal();
        const select = screen.getByLabelText("Trade Partner") as HTMLSelectElement;
        await user.selectOptions(select, "p2");
        expect(select.value).toBe("p2");
    });

    // 7. Validation: no partner selected
    it("shows error when confirming without selecting a partner", async () => {
        renderModal();
        await user.click(screen.getByTestId("confirm-button"));
        expect(screen.getByTestId("validation-error")).toBeDefined();
        expect(screen.getByText("Please select a trade partner.")).toBeDefined();
    });

    // 8. Validation: empty trade (nothing offered or requested)
    it("shows error when confirming an empty trade", async () => {
        renderModal();
        // Select partner first
        const select = screen.getByLabelText("Trade Partner") as HTMLSelectElement;
        await user.selectOptions(select, "p2");
        // Confirm without selecting anything
        await user.click(screen.getByTestId("confirm-button"));
        expect(screen.getByTestId("validation-error")).toBeDefined();
        expect(
            screen.getByText(
                "You must offer or request at least one property or some cash."
            )
        ).toBeDefined();
    });

    // 9. Full mock trade flow
    it("completes a full mock trade flow", async () => {
        const { onClose } = renderModal();
        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => { });

        // Select trade partner
        const select = screen.getByLabelText("Trade Partner") as HTMLSelectElement;
        await user.selectOptions(select, "p2");
        expect(select.value).toBe("p2");

        // Offer a property
        const parkPlace = screen.getByTestId("offer-property-park-place");
        await user.click(parkPlace);

        // Request a property
        const medAve = screen.getByTestId("request-property-mediterranean-ave");
        await user.click(medAve);

        // Offer cash
        const offerCashInput = screen.getByTestId("offer-cash-input");
        await user.type(offerCashInput, "100");

        // Confirm trade
        await user.click(screen.getByTestId("confirm-button"));

        // Validation error should NOT appear
        expect(screen.queryByTestId("validation-error")).toBeNull();

        // onClose should have been called
        expect(onClose).toHaveBeenCalledTimes(1);

        // Console log should have been called with trade details
        expect(consoleSpy).toHaveBeenCalledWith(
            "Trade proposed:",
            expect.objectContaining({
                from: "Alice",
                to: "Bob",
                offeredProperties: ["Park Place"],
                requestedProperties: ["Mediterranean Ave"],
                offeredCash: 100,
            })
        );

        consoleSpy.mockRestore();
    });

    // 10. Shows current player's properties in offer column
    it("displays current player properties in the offer column", () => {
        renderModal();
        const offerCol = screen.getByTestId("offer-column");
        expect(within(offerCol).getByText("Park Place")).toBeDefined();
        expect(within(offerCol).getByText("Boardwalk")).toBeDefined();
        expect(within(offerCol).getByText("Reading Railroad")).toBeDefined();
    });

    // 11. Request column disabled until partner selected
    it("disables the request column when no partner is selected", () => {
        renderModal();
        const requestCol = screen.getByTestId("request-column");
        expect(requestCol.className).toContain("pointer-events-none");
    });

    // 12. Close button (X) works
    it("calls onClose when the X button is clicked", async () => {
        const { onClose } = renderModal();
        await user.click(screen.getByLabelText("Close trade modal"));
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
