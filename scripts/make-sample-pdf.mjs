// Generates public/sample-statement.pdf — a deliberately messy HDFC-style statement for demos.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { writeFileSync } from 'fs';

const rows = [
  ['01/10/26', 'NEFT CR-ACME TECH PVT LTD-SALARY OCT', '', '95,000.00', '1,42,310.55'],
  ['03/10/26', 'UPI/430155/RAMESH KUMAR/rameshkumar@okhdfc/rent', '22,000.00', '', '1,20,310.55'],
  ['04/10/26', 'POS 4521XXXX DECATHLON SPORTS BLR', '2,899.00', '', '1,17,411.55'],
  ['05/10/26', 'ACH D- GROWW SIP 1029384', '10,000.00', '', '1,07,411.55'],
  ['06/10/26', 'UPI/430287/URBAN COMPANY/urbanco@icici/salon', '799.00', '', '1,06,612.55'],
  ['07/10/26', 'NETFLIX.COM AUTOPAY SI', '649.00', '', '1,05,963.55'],
  ['08/10/26', 'ACH D- BAJAJ FINANCE EMI LN8837', '4,250.00', '', '1,01,713.55'],
  ['09/10/26', 'UPI/430399/CHAI POINT/chaipoint@ybl/', '180.00', '', '1,01,533.55'],
  ['11/10/26', 'UPI/430455/SWIGGY/swiggy@icici/order', '612.00', '', '1,00,921.55'],
  ['12/10/26', 'UPI/430501/KIRANAKART TECH/zeptonow@ybl/', '1,134.00', '', '99,787.55'],
  ['14/10/26', 'BIL/ONL/AIRTEL POSTPAID 98XXXX1234', '599.00', '', '99,188.55'],
  ['15/10/26', 'IMPS/P2A/rahul verma/refund dinner', '', '1,200.00', '1,00,388.55'],
  ['18/10/26', 'UPI/430777/BESCOM/bescom@sbi/electricity', '1,644.00', '', '98,744.55'],
  ['21/10/26', 'UPI/430812/PVR INOX/pvrinox@hdfcbank/', '980.00', '', '97,764.55'],
  ['24/10/26', 'UPI/430901/MAKEMYTRIP/mmt@icici/goa', '8,450.00', '', '89,314.55'],
  ['27/10/26', 'UPI/430990/APOLLO PHARMACY/apollo@ybl/', '436.00', '', '88,878.55'],
];

const pdf = await PDFDocument.create();
const page = pdf.addPage([595, 842]);
const font = await pdf.embedFont(StandardFonts.Helvetica);
const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
const t = (s, x, y, f = font, size = 8, c = rgb(0.1, 0.1, 0.1)) => page.drawText(s, { x, y, size, font: f, color: c });
t('SAMPLE BANK LTD  (demo statement - fictional data)', 40, 800, bold, 12);
t('Statement of account   A/c No: XXXXXXXX4821   Period: 01/10/2026 to 31/10/2026', 40, 782);
t('Customer: RIYA S   Branch: KORAMANGALA BLR   IFSC: SAMP0001234', 40, 770);
t('Date', 40, 740, bold); t('Narration', 90, 740, bold); t('Withdrawal Amt.', 350, 740, bold); t('Deposit Amt.', 430, 740, bold); t('Closing Balance', 500, 740, bold);
t('OPENING BALANCE', 90, 725); t('47,310.55', 500, 725);
let y = 708;
for (const [d, n, w, dep, bal] of rows) {
  t(d, 40, y); t(n, 90, y, font, 7); if (w) t(w, 350, y); if (dep) t(dep, 430, y); t(bal, 500, y);
  y -= 16;
}
t('CLOSING BALANCE', 90, y - 6); t('88,878.55', 500, y - 6);
t('*** This is a computer generated statement and does not require signature ***', 120, 60, font, 7, rgb(0.4, 0.4, 0.4));
t('Page 1 of 1', 270, 45, font, 7, rgb(0.4, 0.4, 0.4));
writeFileSync('public/sample-statement.pdf', await pdf.save());
console.log('ok');
