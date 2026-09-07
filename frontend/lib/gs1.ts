export interface GS1Data {
  isGS1: boolean;
  gtin: string | null;
  barcode: string | null;
  mfgDate: string | null;
  expiryDate: string | null;
  batchNumber: string | null;
  serialNumber: string | null;
  rawData: string;
}

const AI_FIXED_LENGTH: Record<string, { name: string; length: number | null }> = {
  "01": { name: "gtin", length: 14 },
  "02": { name: "contentGtin", length: 14 },
  "10": { name: "batchNumber", length: null },
  "11": { name: "mfgDate", length: 6 },
  "13": { name: "packDate", length: 6 },
  "15": { name: "bestBeforeDate", length: 6 },
  "17": { name: "expiryDate", length: 6 },
  "21": { name: "serialNumber", length: null },
};

function parseGS1Date(value: string): string | null {
  if (value.length !== 6) return null;
  const yy = parseInt(value.slice(0, 2), 10);
  const mm = parseInt(value.slice(2, 4), 10);
  let dd = parseInt(value.slice(4, 6), 10);
  if (isNaN(yy) || isNaN(mm) || isNaN(dd)) return null;
  const year = 2000 + yy;
  if (dd === 0) dd = 1;
  return `${year}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

export function isGS1Barcode(data: string): boolean {
  data = data.trim();
  if (data.startsWith("]C1") || data.startsWith("]e0") || data.startsWith("]d2")) return true;
  if (/^\(?\d{2}\)/.test(data) && data.length > 16) return true;
  if (data.startsWith("01") && data.length >= 16 && /^\d{16}/.test(data)) return true;
  return false;
}

export function parseGS1Barcode(data: string): GS1Data {
  let clean = data.trim();

  for (const prefix of ["]C1", "]e0", "]d2"]) {
    if (clean.startsWith(prefix)) {
      clean = clean.slice(prefix.length);
      break;
    }
  }

  clean = clean.replace(/[()]/g, "");

  const result: GS1Data = {
    isGS1: true,
    gtin: null,
    barcode: null,
    mfgDate: null,
    expiryDate: null,
    batchNumber: null,
    serialNumber: null,
    rawData: data,
  };

  let pos = 0;
  const GS = "\x1d";

  while (pos < clean.length) {
    let matched = false;

    const aiCodes = Object.keys(AI_FIXED_LENGTH).sort((a, b) => b.length - a.length);

    for (const ai of aiCodes) {
      if (clean.slice(pos, pos + ai.length) === ai) {
        pos += ai.length;
        const info = AI_FIXED_LENGTH[ai];
        let value: string;

        if (info.length) {
          value = clean.slice(pos, pos + info.length);
          pos += info.length;
        } else {
          const gsPos = clean.indexOf(GS, pos);
          if (gsPos !== -1) {
            value = clean.slice(pos, gsPos);
            pos = gsPos + 1;
          } else {
            let nextAIPos = clean.length;
            for (const otherAI of aiCodes) {
              const idx = clean.indexOf(otherAI, pos + 1);
              if (idx !== -1 && idx < nextAIPos) {
                nextAIPos = idx;
              }
            }
            value = clean.slice(pos, nextAIPos);
            pos = nextAIPos;
          }
        }

        switch (info.name) {
          case "gtin":
            result.gtin = value;
            result.barcode = value.startsWith("0") ? value.slice(1) : value;
            break;
          case "mfgDate":
          case "packDate":
            result.mfgDate = parseGS1Date(value);
            break;
          case "expiryDate":
            result.expiryDate = parseGS1Date(value);
            break;
          case "bestBeforeDate":
            if (!result.expiryDate) result.expiryDate = parseGS1Date(value);
            break;
          case "batchNumber":
            result.batchNumber = value;
            break;
          case "serialNumber":
            result.serialNumber = value;
            break;
        }

        matched = true;
        break;
      }
    }

    if (!matched) pos++;
  }

  return result;
}
