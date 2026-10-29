import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import ForgotPasswordPage from "./ForgotPasswordPage";

describe("ForgotPasswordPage", () => {
  it("shows inline email validation without browser-native required popups", () => {
    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>,
    );
    const email = screen.getByLabelText(/email address/i) as HTMLInputElement;
    expect(email.required).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Send OTP" }));
    expect(screen.getByRole("alert").textContent).toContain(
      "Please enter your email address.",
    );
    expect(email.getAttribute("aria-invalid")).toBe("true");
  });
});
