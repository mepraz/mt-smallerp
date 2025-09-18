import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { StudentBill } from "@/lib/types";
import { format } from 'date-fns';

export async function generateReceiptPdf(bill: StudentBill) {
  const doc = new jsPDF();
  
  const { school, student, class: studentClass, invoice, payment } = bill;

  if (!payment) {
      throw new Error("Payment details are required to generate a receipt.");
  }

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
  
  // --- Receipt Title ---
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("PAYMENT RECEIPT", doc.internal.pageSize.getWidth() / 2, 50, { align: "center" });
  
  // --- Student Details ---
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`Student Name: ${student.name}`, 15, 65);
  doc.text(`Class: ${studentClass.name} - ${studentClass.section}`, 15, 72);
  doc.text(`Roll No: ${student.rollNumber || 'N/A'}`, 15, 79);
  
  doc.text(`Receipt No: ${invoice.id.slice(-6).toUpperCase()}-${Date.now() % 1000}`, 195, 65, { align: "right" });
  doc.text(`Date: ${format(payment.date, 'yyyy-MM-dd')}`, 195, 72, { align: "right" });
  doc.text(`Invoice Month: ${invoice.month}, ${invoice.year}`, 195, 79, { align: "right" });

  // --- Payment Details Table ---
  const balanceBeforePayment = invoice.balance + payment.amount;

  const tableData = [
      ['Balance Before Payment', `Rs. ${balanceBeforePayment.toLocaleString()}`],
      ['Amount Paid', `Rs. ${payment.amount.toLocaleString()}`],
      ['Remaining Balance', `Rs. ${invoice.balance.toLocaleString()}`],
  ];

  autoTable(doc, {
      startY: 85,
      head: [['Description', 'Amount']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [22, 160, 133], textColor: 255 },
      columnStyles: {
          0: { fontStyle: 'bold' },
          1: { halign: 'right' }
      },
      margin: { left: 15, right: 15 },
  });
  
  const finalY = (doc as any).lastAutoTable.finalY;

  // --- In Words ---
  const toWords = (num: number) => {
    // Basic number to words converter
    const a = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
    const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    if ((num = num.toString()).length > 9) return 'overflow';
    const n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return ''; let str = '';
    str += (Number(n[1]) != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + ' crore ' : '';
    str += (Number(n[2]) != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + ' lakh ' : '';
    str += (Number(n[3]) != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + ' thousand ' : '';
    str += (Number(n[4]) != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + ' hundred ' : '';
    str += (Number(n[5]) != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
    return str.trim();
  };
  const amountInWords = toWords(payment.amount).charAt(0).toUpperCase() + toWords(payment.amount).slice(1);
  doc.text(`In Words: Rupees ${amountInWords} only.`, 15, finalY + 15);
  
  // --- Footer ---
  const footerY = finalY + 40;
  doc.text("Signature of Accountant", 195, footerY, { align: "right" });
  doc.line(150, footerY - 5, 195, footerY - 5);

  const fileName = `receipt-${student.name}-${Date.now()}.pdf`;
  doc.save(fileName);
}
