import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "./AuthProvider";
import RequireAuth from "./RequireAuth";

afterEach(() => vi.unstubAllGlobals());

describe("guest route access", () => {
  it("keeps skin analysis public and redirects a guest from the private profile", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({ ok: true, json: async () => ({ user: null }) }),
    );
    const initialEntry = "/skin-analysis";
    const view = render(
      <AuthProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/skin-analysis" element={<p>Guest analysis page</p>} />
            <Route element={<RequireAuth />}>
              <Route path="/skin-profile" element={<p>Private profile</p>} />
            </Route>
            <Route path="/login" element={<p>Sign in page</p>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );
    expect(await screen.findByText("Guest analysis page")).toBeInTheDocument();
    view.unmount();
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/skin-profile"]}>
          <Routes>
            <Route element={<RequireAuth />}>
              <Route path="/skin-profile" element={<p>Private profile</p>} />
            </Route>
            <Route path="/login" element={<p>Sign in page</p>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );
    expect(await screen.findByText("Sign in page")).toBeInTheDocument();
    expect(screen.queryByText("Private profile")).not.toBeInTheDocument();
  });
});
