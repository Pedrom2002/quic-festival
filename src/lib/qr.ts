import QRCode from "qrcode";

export async function generateQrDataUrl(token: string): Promise<string> {
  return QRCode.toDataURL(token, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 512,
    color: { dark: "#06111B", light: "#F4EBD6" },
  });
}
