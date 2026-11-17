# Demo pay stubs

Synthetic SPECIMEN pay stubs for the live demo. Every name, employer, address and number is fictional.

| File | Use | Document check result |
|---|---|---|
| `rosa-paystub-cropped.png` | Rosa's first upload, which fails | insufficient: cropped, name missing, pay period missing |
| `rosa-paystub-photo.png` | Rosa's second upload, which passes (photo on a desk) | sufficient: $1,560.00 biweekly, current, name matches |
| `rosa-paystub-scan.png` | Flat version of Rosa's stub | sufficient |
| `rosa-paystub-print.pdf` | Print it for the live camera moment | not checked (same content as the scan) |
| `marcus-paystub-photo.png` | Optional prop for Marcus | not checked |

These results come from two runs through the real `extractFields` and `judgeDocument` with a live API key on 16 Nov 2026.

Rosa: $19.50 × 80 hours = $1,560.00 gross, biweekly. Pay period 10/26/2026 – 11/08/2026, paid 11/13/2026.

## Regenerating

`stub.html` is the template. Open it in a browser with `?who=rosa|marcus&scene=flat|photo|cropped`, then screenshot it, or print it to PDF with headless Chrome.

Keep the header "PAY STUB". The document check matches the document type exactly, so a header such as "EARNINGS STATEMENT" is extracted as "earnings statement (pay stub)" and fails.
