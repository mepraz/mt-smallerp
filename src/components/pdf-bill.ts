
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { StudentBill } from "@/lib/types";
import { format } from 'date-fns';

export async function generateBillsPdf(bills: StudentBill[]) {
  const doc = new jsPDF();
  
  for (const [index, bill] of bills.entries()) {
    if (index > 0) {
      doc.addPage();
    }

    const { school, student, class: studentClass, invoice, previousDues } = bill;

    // --- Header ---
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text(school.schoolName || "School Name", doc.internal.pageSize.getWidth() / 2, 20, { align: "center" });
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(school.schoolAddress || "School Address", doc.internal.pageSize.getWidth() / 2, 28, { align: "center" });
    doc.text(`Phone: ${school.schoolPhone || 'N/A'}`, doc.internal.pageSize.getWidth() / 2, 33, { align: "center" });
    doc.setLineWidth(0.5);
    doc.line(10, 40, 200, 40);
    
    // --- Bill Title ---
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("CASH BILL", doc.internal.pageSize.getWidth() / 2, 50, { align: "center" });
    
    // --- Student Details ---
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Student Name: ${student.name}`, 15, 65);
    doc.text(`Class: ${studentClass.name} - ${studentClass.section}`, 15, 72);
    doc.text(`Roll No: ${student.rollNumber || 'N/A'}`, 15, 79);
    
    doc.text(`Bill No: ${invoice.id.slice(-6).toUpperCase()}`, 195, 65, { align: "right" });
    doc.text(`Date: ${format(new Date(), 'yyyy-MM-dd')}`, 195, 72, { align: "right" });
    doc.text(`Month: ${invoice.month}, ${invoice.year}`, 195, 79, { align: "right" });

    // --- Fees Table ---
    const tableData = invoice.lineItems
    .filter(item => item.feeType !== 'Previous Dues')
    .map((item, i) => [
        i + 1,
        item.feeType.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()), // Prettify fee type
        `Rs. ${item.amount.toLocaleString()}`
    ]);
    
    const currentMonthTotal = invoice.lineItems
        .filter(item => item.feeType !== 'Previous Dues')
        .reduce((acc, item) => acc + item.amount, 0);

    autoTable(doc, {
        startY: 85,
        head: [['S.N.', 'Particulars', 'Amount']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [22, 160, 133], textColor: 255 },
        foot: [['', 'Current Month Total', `Rs. ${currentMonthTotal.toLocaleString()}`]],
        footStyles: { fontStyle: 'bold' },
        margin: { left: 15, right: 15 },
    });
    
    const finalY = (doc as any).lastAutoTable.finalY;

    // --- Summary Section ---
    const totalBilledWithPrevious = currentMonthTotal + previousDues;
    const summaryData = [
        ['Total Amount', `Rs. ${currentMonthTotal.toLocaleString()}`],
        ['Previous Dues', `Rs. ${previousDues.toLocaleString()}`],
        ['Net Amount', `Rs. ${totalBilledWithPrevious.toLocaleString()}`],
        ['Paid Amount', `Rs. ${invoice.totalPaid.toLocaleString()}`],
        ['Remaining Balance', `Rs. ${invoice.balance.toLocaleString()}`],
    ];

    autoTable(doc, {
        startY: finalY + 5,
        body: summaryData,
        theme: 'plain',
        styles: { cellPadding: 2 },
        columnStyles: {
            0: { fontStyle: 'bold', halign: 'right' },
            1: { halign: 'right' }
        },
        margin: { left: 100 }, // Align to the right
    });
    
    // --- Footer ---
    const footerY = (doc as any).lastAutoTable.finalY;
    doc.text("Signature of Accountant", 195, footerY + 20, { align: "right" });
    doc.line(150, footerY + 15, 195, footerY + 15);
  }

  const fileName = bills.length > 1
    ? `bills-${bills[0].class.name}-${Date.now()}.pdf`
    : `bill-${bills[0].student.name}-${Date.now()}.pdf`;

  doc.save(fileName);
}
