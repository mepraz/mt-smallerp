
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { StudentBill, ClassFees, SchoolSettings } from "@/lib/types";

// A simple number-to-words converter for demonstration
function toWords(num: number): string {
    if (num === 0) return 'Zero only';
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
    return str.trim() + ' only';
}

function drawBillSlip(doc: jsPDF, bill: StudentBill, school: SchoolSettings, x: number, y: number) {
    const slipWidth = 95;
    const slipHeight = 138; 
    const margin = 5;
    const innerX = x + margin;
    const innerY = y + margin;
    const innerWidth = slipWidth - (margin * 2);

    // Draw border for the slip
    doc.rect(x, y, slipWidth, slipHeight);

    // --- Header ---
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(school.schoolName || "School Name", x + slipWidth / 2, innerY + 3, { align: "center" });
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(school.schoolAddress || "School Address", x + slipWidth / 2, innerY + 7, { align: "center" });
    doc.text(`Phone: ${school.schoolPhone || 'N/A'}`, x + slipWidth / 2, innerY + 10, { align: "center" });
    doc.setLineWidth(0.2);
    doc.line(innerX, innerY + 13, innerX + innerWidth, innerY + 13);
    
    // --- Student Info ---
    doc.setFontSize(8);
    const studentName = `Student: ${bill.student.name}`;
    const classText = `Class: ${bill.class.name}-${bill.class.section}`;
    const rollText = `Roll: ${bill.student.rollNumber || 'N/A'}`;
    const monthText = `Month: ${bill.invoice.month}, ${bill.invoice.year}`;

    doc.text(studentName, innerX, innerY + 18);
    doc.text(classText, innerX, innerY + 22);
    doc.text(rollText, x + slipWidth - margin, innerY + 22, { align: 'right' });
    doc.text(monthText, x + slipWidth - margin, innerY + 18, { align: 'right' });

    // --- Fees Table ---
    const feeOrder: (keyof Omit<ClassFees, 'medical'> | 'Medical' | 'Previous Dues')[] = [
        "registration", "monthly", "exam", "sports", "music", "tuition", "stationery", "tieBelt", "Medical", "Previous Dues"
    ];

    const tableData = feeOrder
        .map(feeKey => {
            const lineItem = bill.invoice.lineItems.find(li => li.feeType.toLowerCase().replace(/\s+/g, '') === feeKey.toLowerCase().replace(/\s+/g, ''));
            if (!lineItem) return null;
            const label = feeKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            return [label, lineItem.amount.toLocaleString()];
        })
        .filter((item): item is [string, string] => item !== null);

    const currentMonthTotal = bill.invoice.totalBilled;
    
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
        foot: [['Total', currentMonthTotal.toLocaleString()]],
        footStyles: { fontStyle: 'bold', halign: 'right' },
    });

    const finalY = (doc as any).lastAutoTable.finalY;

    // --- In Words & Footer ---
    doc.setFontSize(7);
    const totalInWords = toWords(currentMonthTotal);
    doc.text(`In Words: ${totalInWords.charAt(0).toUpperCase() + totalInWords.slice(1)}`, innerX, finalY + 5);
    
    doc.text("Accountant", x + slipWidth - margin, finalY + 15, { align: 'right' });
    doc.line(x + slipWidth - margin - 20, finalY + 12, x + slipWidth - margin, finalY + 12);
}


export async function generateBulkBillSlipsPdf(bills: StudentBill[]) {
    const doc = new jsPDF();
    const school = bills[0]?.school;
    if (!school) {
        throw new Error("School settings not found.");
    }
    
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    const slipWidth = pageWidth / 2 - 5; // 2 slips per row with some margin
    const slipHeight = pageHeight / 2 - 5; // 2 slips per column
    
    let x = 5;
    let y = 5;
    let billCount = 0;

    for (const bill of bills) {
        if (billCount > 0 && billCount % 4 === 0) {
            doc.addPage();
            x = 5;
            y = 5;
        }

        drawBillSlip(doc, bill, school, x, y);
        
        billCount++;
        
        if (billCount % 2 === 0) { // Move to next row
            x = 5;
            y += slipHeight;
        } else { // Move to next column
            x += slipWidth;
        }
    }

    const fileName = `bulk-bills-${bills[0].class.name}-${Date.now()}.pdf`;
    doc.save(fileName);
}
