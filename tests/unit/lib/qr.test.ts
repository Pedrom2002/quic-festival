import { describe, expect, it, vi } from "vitest";

vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn(async (text: string, opts: unknown) => `data:image/png;base64,${text}-${JSON.stringify(opts)}`),
  },
}));

import QRCode from "qrcode";
import { generateQrDataUrl } from "@/lib/qr";

describe("generateQrDataUrl", () => {
  it("chama QRCode.toDataURL com opts esperadas", async () => {
    const url = await generateQrDataUrl("token-123");
    expect(url).toContain("data:image/png;base64,");
    expect(QRCode.toDataURL).toHaveBeenCalledWith("token-123", {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 512,
      color: { dark: "#06111B", light: "#F4EBD6" },
    });
  });
});
