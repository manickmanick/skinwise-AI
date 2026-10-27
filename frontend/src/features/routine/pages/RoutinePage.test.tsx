import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { invalidateCsrfToken } from "../../../lib/api";
import RoutinePage from "./RoutinePage";

function response(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body };
}

afterEach(() => {
  vi.unstubAllGlobals();
  invalidateCsrfToken();
});

describe("RoutinePage checklist", () => {
  it("saves a checked step and reflects the server completion percentage", async () => {
    let completed = false;
    let summaryCalls = 0;
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/api/routine/current"))
          return response({
            routine: {
              id: "routine-1",
              version: 1,
              createdAt: "2026-10-27T00:00:00.000Z",
              steps: [
                {
                  id: "step-1",
                  position: 1,
                  period: "morning",
                  title: "Gentle cleanser",
                  instructions: "Use gently.",
                  frequency: "Daily",
                  reason: "A simple routine step.",
                  caution: null,
                  completed,
                },
                {
                  id: "step-2",
                  position: 1,
                  period: "night",
                  title: "Moisturizer",
                  instructions: "Apply a comfortable layer.",
                  frequency: "Daily",
                  reason: "Support comfort.",
                  caution: null,
                  completed: false,
                },
              ],
            },
            completion: {
              date: "2026-10-27",
              completed: completed ? 1 : 0,
              eligible: 2,
              percentage: completed ? 50 : 0,
              qualifies: completed,
            },
          });
        if (url.endsWith("/api/progress/summary")) {
          summaryCalls += 1;
          return response({
            streak: {
              currentStreak: summaryCalls > 1 ? 1 : 0,
              bestStreak: summaryCalls > 1 ? 1 : 0,
              todayQualifies: summaryCalls > 1,
            },
          });
        }
        if (url.endsWith("/api/environment/uv"))
          return response({ available: false, reason: "No city saved." });
        if (url.endsWith("/api/auth/csrf"))
          return response({ csrfToken: "test-token" });
        if (
          url.endsWith("/api/routine/completions/step-1") &&
          init?.method === "PUT"
        ) {
          completed = JSON.parse(String(init.body)).completed;
          return response({
            date: "2026-10-27",
            completed: completed ? 1 : 0,
            eligible: 2,
            percentage: completed ? 50 : 0,
            qualifies: completed,
          });
        }
        return response({ message: "Unexpected request" }, 500);
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<RoutinePage />);
    const checkbox = await screen.findByRole("checkbox", {
      name: "Mark Gentle cleanser complete",
    });
    await fireEvent.click(checkbox);
    expect(
      await screen.findByText("50%", { selector: "strong" }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/routine/completions/step-1"),
      expect.objectContaining({ method: "PUT", headers: expect.any(Headers) }),
    );
  });
});
