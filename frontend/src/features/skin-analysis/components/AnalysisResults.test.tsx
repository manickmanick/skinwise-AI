import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AnalysisResults from "./AnalysisResults";

describe("AnalysisResults", () => {
  it("renders provider score fields and does not imply every result is a percentage", () => {
    const { container } = render(
      <AnalysisResults
        output={[
          { type: "acne", ui_score: 63, raw_score: 39.8 },
          { type: "skin_type", region: "whole", skin_type: "Oily" },
          { type: "all", score: 75.13 },
        ]}
      />,
    );
    expect(screen.getByText("63")).toBeInTheDocument();
    expect(screen.getByText("39.8")).toBeInTheDocument();
    expect(screen.getByText("75.13")).toBeInTheDocument();
    expect(screen.getByText("Oily")).toBeInTheDocument();
    expect(screen.getByText(/not a medical diagnosis/i)).toBeInTheDocument();
    expect(container.querySelector(".metric-track")).toBeNull();
  });
});
