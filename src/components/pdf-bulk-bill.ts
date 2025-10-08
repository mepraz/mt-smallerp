

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { StudentBill, ClassFees, SchoolSettings } from "@/lib/types";

// A simple number-to-words converter for demonstration
function toWords(num: number): string {
    if (num === 0) return 'Zero';
    const a = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
    const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    
    if ((num = num.toString()).length > 9) return 'overflow';
    const n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return '';
    let str = '';
    str += (Number(n[1]) != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + ' crore ' : '';
    str += (Number(n[2]) != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + ' lakh ' : '';
    str += (Number(n[3]) != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + ' thousand ' : '';
    str += (Number(n[4]) != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + ' hundred ' : '';
    str += (Number(n[5]) != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
    return str.trim();
}

const feeOrder: (keyof Omit<ClassFees, 'medical'> | 'Medical' | 'Previous Dues')[] = [
    "registration", "monthly", "exam", "tuition", "stationery", "tieBelt", "sports", "music", "Medical", "Previous Dues"
];

function drawBillSlip(doc: jsPDF, bill: StudentBill, school: SchoolSettings, x: number, y: number, width: number, height: number) {
    const margin = 5;
    const innerX = x + margin;
    const innerY = y + margin;
    const innerWidth = width - (margin * 2);

    // Draw border for the slip
    doc.rect(x, y, width, height);

    // --- Header ---
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(school.schoolName || "School Name", x + width / 2, innerY + 3, { align: "center" });
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(school.schoolAddress || "School Address", x + width / 2, innerY + 7, { align: "center" });
    doc.text(`Phone: ${school.schoolPhone || 'N/A'}`, x + width / 2, innerY + 10, { align: "center" });
    doc.setLineWidth(0.2);
    doc.line(innerX, innerY + 13, innerX + innerWidth, innerY + 13);
    
    // --- Student Info ---
    doc.setFontSize(8);
    doc.text(`Student: ${bill.student.name}`, innerX, innerY + 18);
    doc.text(`Class: ${bill.class.name}${bill.class.section ? `-${bill.class.section}` : ''}`, innerX, innerY + 22);
    doc.text(`Roll: ${bill.student.rollNumber || 'N/A'}`, x + width - margin, innerY + 22, { align: 'right' });
    doc.text(`Month: ${bill.invoice.month}, ${bill.invoice.year}`, x + width - margin, innerY + 18, { align: 'right' });

    // --- Fees Table ---
    const allFees = new Map<string, number>();
    // Pre-populate with all possible fees with amount 0
    feeOrder.forEach(feeKey => {
        const label = feeKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        allFees.set(label, 0);
    });

    // Populate with actual amounts from the invoice
    bill.invoice.lineItems.forEach(item => {
        const label = item.feeType.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        allFees.set(label, item.amount);
    });
    
    const tableData: [string, string][] = [];
    allFees.forEach((amount, feeType) => {
        tableData.push([feeType, amount.toLocaleString()]);
    });

    const netPayable = bill.invoice.totalBilled;
    
    autoTable(doc, {
        startY: innerY + 25,
        head: [['Particulars', 'Amount']],
        body: tableData,
        theme: 'grid',
        tableWidth: innerWidth,
        margin: { left: innerX },
        styles: {
            fontSize: 7,
            cellPadding: 0.8,
        },
        headStyles: { fontStyle: 'bold', fillColor: [230, 230, 230], textColor: 0 },
        foot: [['Net Payable', netPayable.toLocaleString()]],
        footStyles: { fontStyle: 'bold', halign: 'right' },
    });

    const finalY = (doc as any).lastAutoTable.finalY;

    // --- In Words & Footer ---
    doc.setFontSize(7);
    const totalInWords = toWords(netPayable);
    const splitWords = doc.splitTextToSize(`In Words: Rupees ${totalInWords.charAt(0).toUpperCase() + totalInWords.slice(1)} only.`, innerWidth);
    doc.text(splitWords, innerX, finalY + 4);
    
    const signatureY = y + height - 10;
    doc.text("Accountant's Signature", x + width - margin, signatureY, { align: 'right' });
    doc.line(x + width - margin - 30, signatureY - 2, x + width - margin, signatureY - 2);
}


export async function generateBulkBillSlipsPdf(bills: StudentBill[]) {
    const doc = new jsPDF('p', 'mm', 'a4');
    const school = bills[0]?.school;
    if (!school) {
        throw new Error("School settings not found.");
    }
    
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageMargin = 5;
    
    // Calculate dimensions for 4 slips (2x2 grid)
    const slipWidth = (pageWidth - 3 * pageMargin) / 2;
    const slipHeight = (pageHeight - 3 * pageMargin) / 2;
    
    const positions = [
        { x: pageMargin, y: pageMargin }, // Top-left
        { x: pageMargin * 2 + slipWidth, y: pageMargin }, // Top-right
        { x: pageMargin, y: pageMargin * 2 + slipHeight }, // Bottom-left
        { x: pageMargin * 2 + slipWidth, y: pageMargin * 2 + slipHeight }, // Bottom-right
    ];

    for (let i = 0; i < bills.length; i++) {
        const billIndexOnPage = i % 4;

        if (i > 0 && billIndexOnPage === 0) {
            doc.addPage();
        }

        const bill = bills[i];
        const pos = positions[billIndexOnPage];
        drawBillSlip(doc, bill, school, pos.x, pos.y, slipWidth, slipHeight);
    }

    const fileName = `bulk-bills-${bills[0].class.name}-${Date.now()}.pdf`;
    doc.save(fileName);
}

    