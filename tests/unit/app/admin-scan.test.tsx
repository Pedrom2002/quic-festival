import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/admin/qr-scanner", () => ({ default: () => <div data-test="scanner" /> }));

import ScanPage from "@/app/admin/(authed)/scan/page";

describe("ScanPage", () => {
  it("render heading + scanner", () => {
    const { container } = render(<ScanPage />);
    expect(container.textContent).toContain("Check-in");
    expect(container.querySelector('[data-test="scanner"]')).toBeTruthy();
  });
});
