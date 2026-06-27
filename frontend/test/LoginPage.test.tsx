import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockPush = vi.fn();
const mockLogin = vi.fn();
const mockApiRequest = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ login: mockLogin }),
}));

vi.mock("@/lib/api", () => ({
  apiRequest: mockApiRequest,
}));

import LoginPage from "@/app/login/page";

describe("LoginPage", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockLogin.mockClear();
    mockApiRequest.mockClear();
  });

  it("renders an accessible login form with labeled fields", () => {
    render(<LoginPage />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole("button", { name: /sign in/i });

    expect(emailInput).toBeInTheDocument();
    expect(emailInput).toHaveAttribute("id", "login-email");
    expect(emailInput).toHaveAttribute("autocomplete", "email");
    expect(emailInput).toHaveAttribute("autofocus");

    expect(passwordInput).toBeInTheDocument();
    expect(passwordInput).toHaveAttribute("id", "login-password");
    expect(passwordInput).toHaveAttribute("autocomplete", "current-password");

    expect(submitButton).toBeInTheDocument();
  });

  it("submits credentials, logs in, and navigates on success", async () => {
    mockApiRequest.mockResolvedValue({ access_token: "token", refresh_token: "refresh" });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "admin@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "password123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledWith("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "admin@example.com",
          password: "password123",
        }),
      });
    });

    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith("token", "refresh"));
    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it("shows a user-friendly message when the login service is unavailable", async () => {
    mockApiRequest.mockRejectedValue(new TypeError("Failed to fetch"));

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "admin@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "password123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    const alert = await screen.findByRole("alert");

    expect(alert).toHaveTextContent(
      /unable to reach the authentication service/i
    );
    expect(mockLogin).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
