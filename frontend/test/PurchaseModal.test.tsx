import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PurchaseModal } from "../src/components/ui/purchase-modal";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, string>) => {
      if (key === "shop.purchase_confirmation_msg") return `Confirm purchase of ${opts?.name}`;
      const map: Record<string, string> = {
        "shop.confirm_purchase": "Confirm Purchase",
        "shop.cancel": "Cancel",
        "shop.purchase": "Purchase",
      };
      return map[key] ?? key;
    },
  }),
}));

vi.mock("@/hooks/useFocusTrap", () => ({
  useFocusTrap: () => undefined,
}));

function renderModal(props: Partial<React.ComponentProps<typeof PurchaseModal>> = {}) {
  const defaults = {
    isOpen: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    itemName: "Speed Boost",
    itemPrice: "100",
    itemCurrency: "NEAR",
  };
  const merged = { ...defaults, ...props };
  render(<PurchaseModal {...merged} />);
  return merged;
}

// ─── Render / interaction ────────────────────────────────────────────────────

describe("PurchaseModal", () => {
  it("renders when open", () => {
    renderModal();
    expect(screen.getByTestId("purchase-modal")).toBeInTheDocument();
    expect(screen.getByTestId("purchase-modal-cancel")).toBeInTheDocument();
    expect(screen.getByTestId("purchase-modal-confirm")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    renderModal({ isOpen: false });
    expect(screen.queryByTestId("purchase-modal")).toBeNull();
  });

  it("calls onClose when Cancel is clicked", async () => {
    const { onClose } = renderModal();
    await userEvent.click(screen.getByTestId("purchase-modal-cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onConfirm when Purchase is clicked", async () => {
    const { onConfirm } = renderModal();
    await userEvent.click(screen.getByTestId("purchase-modal-confirm"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when backdrop is clicked", async () => {
    const { onClose } = renderModal();
    await userEvent.click(screen.getByTestId("purchase-modal-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ─── SW-FE-028: CLS / LCP perf budget ─────────────────────────────────────

  describe("SW-FE-028 — CLS / LCP perf budget", () => {
    it("card has min-h class to prevent layout shift", () => {
      renderModal();
      const card = screen.getByTestId("purchase-modal").querySelector(".min-h-\\[220px\\]");
      expect(card).toBeInTheDocument();
    });

    it("price container has explicit height class to reserve space", () => {
      renderModal();
      const priceEl = screen.getByTestId("purchase-modal-price");
      // The inner div must carry h-10 so the price line never causes CLS
      const inner = priceEl.querySelector(".h-10");
      expect(inner).toBeInTheDocument();
    });
  });

  // ─── SW-FE-031: Security hardening ────────────────────────────────────────

  describe("SW-FE-031 — security hardening", () => {
    it("strips HTML tags from itemName", () => {
      renderModal({ itemName: '<img src=x onerror="alert(1)">Boost' });
      // The sanitized name should appear without the tag
      expect(screen.getByText(/Confirm purchase of Boost/)).toBeInTheDocument();
      expect(screen.queryByRole("img")).toBeNull();
    });

    it("strips HTML tags from itemPrice", () => {
      renderModal({ itemPrice: '<script>alert(1)</script>100' });
      const priceEl = screen.getByTestId("purchase-modal-price");
      expect(priceEl.innerHTML).not.toContain("<script>");
      expect(priceEl.textContent).toContain("100");
    });

    it("strips HTML tags from itemCurrency", () => {
      renderModal({ itemCurrency: '<b>NEAR</b>' });
      const priceEl = screen.getByTestId("purchase-modal-price");
      expect(priceEl.innerHTML).not.toContain("<b>");
      expect(priceEl.textContent).toContain("NEAR");
    });

    it("renders plain text props without modification", () => {
      renderModal({ itemName: "Speed Boost", itemPrice: "100", itemCurrency: "NEAR" });
      expect(screen.getByTestId("purchase-modal-price").textContent).toContain("100 NEAR");
    });
  });
});
