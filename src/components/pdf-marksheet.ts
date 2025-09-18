
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { SchoolSettings, StudentMarksheet } from "@/lib/types";
import { getNepaliDate } from "@/lib/nepali-date";
import { format } from "date-fns";

// Grading logic based on the provided image
function getGradeDetails(percentage: number): { grade: string; gpa: number; remarks: string } {
    if (isNaN(percentage) || percentage < 0) return { grade: 'N/A', gpa: 0, remarks: 'N/A' };
    if (percentage >= 90) return { grade: 'A+', gpa: 4.0, remarks: 'OUTSTANDING' };
    if (percentage >= 80) return { grade: 'A', gpa: 3.6, remarks: 'EXCELLENT' };
    if (percentage >= 70) return { grade: 'B+', gpa: 3.2, remarks: 'VERY GOOD' };
    if (percentage >= 60) return { grade: 'B', gpa: 2.8, remarks: 'GOOD' };
    if (percentage >= 50) return { grade: 'C+', gpa: 2.4, remarks: 'SATISFACTORY' };
    if (percentage >= 40) return { grade: 'C', gpa: 2.0, remarks: 'ACCEPTABLE' };
    if (percentage >= 35) return { grade: 'D+', gpa: 1.6, remarks: 'BASIC' };
    return { grade: 'NG', gpa: 0, remarks: 'NON GRADED' }; // Below 35
}

// Grading scale data
const gradingScale = [
    ['90 TO 100', 'A+', '4.0', 'OUTSTANDING'],
    ['80 TO BELOW 90', 'A', '3.6', 'EXCELLENT'],
    ['70 TO BELOW 80', 'B+', '3.2', 'VERY GOOD'],
    ['60 TO BELOW 60', 'B', '2.8', 'GOOD'],
    ['50 TO BELOW 60', 'C+', '2.4', 'SATISFACTORY'],
    ['40 TO BELOW 50', 'C', '2.0', 'ACCEPTABLE'],
    ['35 TO BELOW 40', 'D+', '1.6', 'BASIC'],
    ['BELOW 35', 'NG', 'BELOW 1.6', 'NON GRADED'],
];


export async function generateMarksheetPdf(school: SchoolSettings, marksheets: StudentMarksheet[]) {
  const doc = new jsPDF();
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();

  for (const [index, marksheet] of marksheets.entries()) {
    if (index > 0) {
      doc.addPage();
    }
    const { student, class: studentClass, exam, results } = marksheet;

    // --- Header ---
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text(school.schoolName?.toUpperCase() || "SCHOOL NAME", pageWidth / 2, 15, { align: "center" });
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`${school.schoolAddress || "School Address"}`, pageWidth / 2, 22, { align: "center" });
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(exam.name.toUpperCase(), pageWidth / 2, 30, { align: "center" });

    // --- Student Details ---
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`STUDENT'S NAME: ${student.name.toUpperCase()}`, 15, 40);
    doc.text(`ROLL NO.: ${student.rollNumber || 'N/A'}`, pageWidth - 15, 40, { align: "right" });
    const className = studentClass.section ? `${studentClass.name} - ${studentClass.section}` : studentClass.name;
    doc.text(`CLASS: ${className.toUpperCase()}`, pageWidth - 15, 45, { align: "right" });
    doc.setLineWidth(0.5);
    doc.line(10, 50, pageWidth - 10, 50);

    // --- Marks Table ---
    let totalMarksObtained = 0;
    let totalFullMarks = 0;
    let totalGpaPoints = 0;
    let subjectCount = 0;

    const tableBody = results.map((res, i) => {
      const fullMarks = res.fullMarksTheory + res.fullMarksPractical;
      const marksObtained = res.theoryMarks + res.practicalMarks;

      if(fullMarks > 0) {
        totalMarksObtained += marksObtained;
        totalFullMarks += fullMarks;
        subjectCount++;
      }

      const percentage = fullMarks > 0 ? (marksObtained / fullMarks) * 100 : 0;
      const gradeDetails = getGradeDetails(percentage);
      if(fullMarks > 0) {
        totalGpaPoints += gradeDetails.gpa;
      }
      

      return [
        i + 1,
        res.subjectName,
        `${res.fullMarksTheory} + ${res.fullMarksPractical} = ${fullMarks}`,
        `${res.theoryMarks} + ${res.practicalMarks} = ${marksObtained}`,
        gradeDetails.grade,
        gradeDetails.gpa.toFixed(2),
        gradeDetails.remarks
      ];
    });

    const averageGpa = totalGpaPoints / (subjectCount || 1);
    const finalPercentage = totalFullMarks > 0 ? (totalMarksObtained / totalFullMarks) * 100 : 0;
    const finalGrade = getGradeDetails(finalPercentage);

    const tableFoot = [
        ['', 'TOTAL', totalFullMarks, totalMarksObtained, finalGrade.grade, averageGpa.toFixed(2), finalGrade.remarks]
    ];
    
    autoTable(doc, {
      startY: 55,
      head: [['S.N', 'Subject', 'FULL MARKS (TH+PR)', 'MARKS OBTAINED (TH+PR)', 'GRADE', 'GPA', 'REMARKS']],
      body: tableBody,
      foot: tableFoot,
      theme: 'grid',
      headStyles: { fontStyle: 'bold', halign: 'center', fillColor: [230, 230, 230], textColor: 0 },
      footStyles: { fontStyle: 'bold', halign: 'center' },
      columnStyles: {
          0: { halign: 'center' },
          2: { halign: 'center' },
          3: { halign: 'center' },
          4: { halign: 'center' },
          5: { halign: 'center' },
          6: { halign: 'center' },
      }
    });

    let finalY = (doc as any).lastAutoTable.finalY + 10;
    
    // --- Grading Scale Table ---
    const gradingTableWidth = 80;
    autoTable(doc, {
        startY: finalY,
        head: [['INTERVAL IN PERCENT', 'GRADE', 'GPA', 'REMARKS']],
        body: gradingScale,
        theme: 'grid',
        tableWidth: gradingTableWidth,
        margin: {left: 15},
        headStyles: { fontStyle: 'bold', halign: 'center', fillColor: [230, 230, 230], textColor: 0, fontSize: 8 },
        styles: { fontSize: 8 },
        columnStyles: {
            0: { halign: 'center', cellWidth: 30 },
            1: { halign: 'center' },
            2: { halign: 'center' },
            3: { halign: 'center' },
        }
    });

    // --- Final Summary Box ---
    const summaryX = 15 + gradingTableWidth + 10;
    const nepaliDate = getNepaliDate(new Date());
    const formattedNepaliDate = `${nepaliDate.year}/${String(nepaliDate.monthIndex + 1).padStart(2, '0')}/${String(nepaliDate.day).padStart(2, '0')}`;

    doc.setFontSize(12);
    doc.text(`GPA: ${averageGpa.toFixed(2)}`, summaryX, finalY + 5);
    doc.text(`Final Grade: ${finalGrade.grade}`, summaryX, finalY + 12);
    doc.text(`Result: ${finalGrade.remarks}`, summaryX, finalY + 19);
    doc.text(`Issue Date: ${format(new Date(), 'yyyy-MM-dd')}`, summaryX, finalY + 26);
    doc.setDrawColor(0);
    doc.rect(summaryX - 5, finalY - 2, pageWidth - summaryX - 10, 35);

    // --- Footer Signatures ---
    const footerY = pageHeight - 30;
    doc.line(20, footerY, 60, footerY);
    doc.text("CLASS TEACHER", 40, footerY + 5, { align: 'center' });

    doc.line(pageWidth - 60, footerY, pageWidth - 20, footerY);
    doc.text("PRINCIPAL", pageWidth - 40, footerY + 5, { align: 'center' });

    // --- School Seal Placeholder ---
    doc.text("SCHOOL SEAL", 105, footerY - 5, { align: 'center' });
    doc.circle(105, footerY - 12, 10);
    
  }

  doc.save(`results-${marksheets[0].exam.name}-${marksheets[0].class.name}-${Date.now()}.pdf`);
}
