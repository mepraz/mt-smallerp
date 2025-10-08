

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { SchoolSettings, StudentMarksheet, Subject, Result } from "@/lib/types";
import { getNepaliDate } from "@/lib/nepali-date";

async function getClientImageData(url: string): Promise<string | null> {
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const blob = await response.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error("Failed to fetch image for PDF:", error);
        return null;
    }
}

function getGradeDetails(percentage: number): { grade: string; gpa: number; remarks: string } {
    if (isNaN(percentage) || percentage < 0 || percentage < 35) return { grade: 'NG', gpa: 0.0, remarks: 'NON-GRADED' };
    if (percentage >= 90) return { grade: 'A+', gpa: 4.0, remarks: 'OUTSTANDING' };
    if (percentage >= 80) return { grade: 'A', gpa: 3.6, remarks: 'EXCELLENT' };
    if (percentage >= 70) return { grade: 'B+', gpa: 3.2, remarks: 'VERY GOOD' };
    if (percentage >= 60) return { grade: 'B', gpa: 2.8, remarks: 'GOOD' };
    if (percentage >= 50) return { grade: 'C+', gpa: 2.4, remarks: 'SATISFACTORY' };
    if (percentage >= 40) return { grade: 'C', gpa: 2.0, remarks: 'ACCEPTABLE' };
    // Between 35 and 40
    return { grade: 'D', gpa: 1.6, remarks: 'BASIC' };
}

const NEPALI_MONTHS = ["Baisakh", "Jestha", "Ashadh", "Shrawan", "Bhadra", "Ashwin", "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"];

function getDaySuffix(day: number) {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
        case 1: return "st";
        case 2: return "nd";
        case 3: return "rd";
        default: return "th";
    }
}


export async function generateMarksheetPdf(school: SchoolSettings, marksheets: StudentMarksheet[]) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  const logoData = school.schoolLogoUrl ? await getClientImageData(school.schoolLogoUrl) : null;
  
  for (const [index, marksheet] of marksheets.entries()) {
    if (index > 0) {
      doc.addPage();
    }
    
    let totalGpaPoints = 0;
    let totalSubjectsForGpa = 0;
    let grandTotalFullMarks = 0;
    let grandTotalObtainedMarks = 0;

    const { student, class: studentClass, exam, results } = marksheet;

    // --- Border ---
    doc.setDrawColor(0);
    doc.setLineWidth(1);
    doc.rect(5, 5, pageWidth - 10, pageHeight - 10);
    
    // --- Header ---
    doc.setFontSize(10);
    doc.setFont("times", "italic");
    doc.text(school.schoolMotto || `"EDUCATION IS THE ONLY KEY TO OVERPOWER THE UNIVERSE"`, pageWidth / 2, 12, { align: 'center' });
    
    if (logoData) {
        doc.addImage(logoData, 'PNG', 15, 15, 20, 20);
    }
    
    doc.setFontSize(28);
    doc.setFont("times", "bold");
    doc.text(school.schoolName?.toUpperCase() || "SCHOOL NAME", pageWidth / 2, 22, { align: "center" });

    doc.setFontSize(12);
    doc.setFont("times", "normal");
    doc.text(school.schoolAddress?.toUpperCase() || "SCHOOL ADDRESS", pageWidth / 2, 28, { align: "center" });

    doc.setFillColor(0, 0, 139);
    doc.roundedRect(pageWidth / 2 - 35, 32, 70, 8, 3, 3, 'F');
    doc.setFontSize(16);
    doc.setFont("times", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("GRADE-SHEET", pageWidth / 2, 37.5, { align: "center" });
    doc.setTextColor(0);

    // --- Student Info ---
    doc.setFontSize(12);
    doc.setFont("times", "normal");
    const infoY = 48;
    doc.text(`THE GRADE(S) SECURED BY: ${student.name.toUpperCase()}`, 15, infoY);
    
    const infoY2 = infoY + 7;
    doc.text(`GRADE: ${studentClass.name}`, 15, infoY2);
    doc.text(`SECTION: ${studentClass.section || 'A'}`, 60, infoY2);
    doc.text(`ROLL NO: ${student.rollNumber || 'N/A'}`, pageWidth / 2 + 20, infoY2);
    doc.text(`SYMBOL. NO: `, pageWidth - 15, infoY2, {align: 'right'});

    const infoY3 = infoY2 + 7;
    const nepaliExamDate = getNepaliDate(new Date(exam.date));
    doc.text(`${exam.name.toUpperCase()} CONDUCTED IN ${nepaliExamDate.year} B.S. (${new Date(exam.date).getFullYear()} A.D.) ARE GIVEN BELOW.`, pageWidth / 2, infoY3, { align: 'center'});

    // --- Main Marks Table ---
    const coreSubjects = results.filter(s => !s.isExtra);
    const extraSubjects = results.filter(s => s.isExtra);
    
    const mapResultsToTableBody = (resultsToMap: (Result & Subject)[], isExtra: boolean) => {
        return resultsToMap.map((res: (Result & Subject)) => {
            const fullMarksTheory = res.fullMarksTheory || 0;
            const fullMarksPractical = res.fullMarksPractical || 0;
            const obtainedTheory = res.theoryMarks || 0;
            const obtainedPractical = res.practicalMarks || 0;
            
            const totalObtained = obtainedTheory + obtainedPractical;
            const totalFull = fullMarksTheory + fullMarksPractical;
    
            const percentage = totalFull > 0 ? (totalObtained / totalFull) * 100 : 0;
            const gradeDetails = getGradeDetails(percentage);
    
            if (!isExtra) {
                totalGpaPoints += gradeDetails.gpa;
                totalSubjectsForGpa++;
                grandTotalFullMarks += totalFull;
                grandTotalObtainedMarks += totalObtained;
            }
            
            return [
                res.code || '',
                res.name || '',
                fullMarksTheory,
                fullMarksPractical,
                obtainedTheory,
                obtainedPractical,
                gradeDetails.grade,
                gradeDetails.remarks,
            ];
        });
    }

    const tableBody = mapResultsToTableBody(coreSubjects, false);
    
    const MINIMUM_ROWS = 12;
    while(tableBody.length < MINIMUM_ROWS) {
        tableBody.push(['', '', '', '', '', '', '', '']);
    }

    const extraSubjectBody = mapResultsToTableBody(extraSubjects, true);
    
    const gpa = totalSubjectsForGpa > 0 ? totalGpaPoints / totalSubjectsForGpa : 0;
    const finalPercentage = grandTotalFullMarks > 0 ? (grandTotalObtainedMarks / grandTotalFullMarks) * 100 : 0;
    const finalGradeDetails = getGradeDetails(finalPercentage);
    
     autoTable(doc, {
        startY: infoY3 + 3,
        head: [
            [
                { content: 'CODE', rowSpan: 2 },
                { content: 'SUBJECTS', rowSpan: 2 },
                { content: 'FULL MARKS', colSpan: 2 },
                { content: 'OBTAINED MARKS', colSpan: 2 },
                { content: 'GRADE', rowSpan: 2 },
                { content: 'REMARKS', rowSpan: 2 },
            ],
            [
                { content: 'Th.'},
                { content: 'Pr.'},
                { content: 'Th.'},
                { content: 'Pr.'},
            ]
        ],
        body: tableBody,
        theme: 'grid',
        headStyles: { fontStyle: 'bold', halign: 'center', fillColor: [255, 255, 255], textColor: 0, lineWidth: 0.1, lineColor: 0, fontSize: 9 },
        styles: { halign: 'center', lineWidth: 0.1, lineColor: 0, fontSize: 11 },
        columnStyles: {
            0: { cellWidth: 15 },
            1: { halign: 'left', cellWidth: 55 },
            2: { cellWidth: 10 },
            3: { cellWidth: 10 },
            4: { cellWidth: 10 },
            5: { cellWidth: 10 },
            6: { cellWidth: 18 },
            7: { halign: 'left', cellWidth: 'auto' }
        },
    });

    let finalY = (doc as any).lastAutoTable.finalY;

     if (extraSubjects.length > 0) {
        autoTable(doc, {
            startY: finalY,
            head: [['', 'EXTRA CREDIT SUBJECT', '', '', '', '', '', '']],
            body: extraSubjectBody,
            theme: 'grid',
            headStyles: { fontStyle: 'bold', halign: 'left', fillColor: [255, 255, 255], textColor: 0, lineWidth: 0.1, lineColor: 0, fontSize: 12 },
            styles: { halign: 'center', lineWidth: 0.1, lineColor: 0, fontSize: 11 },
            columnStyles: {
                0: { cellWidth: 15 },
                1: { halign: 'left', cellWidth: 55 },
                2: { cellWidth: 10 },
                3: { cellWidth: 10 },
                4: { cellWidth: 10 },
                5: { cellWidth: 10 },
                6: { cellWidth: 18 },
                7: { halign: 'left', cellWidth: 'auto' }
            },
        });
        finalY = (doc as any).lastAutoTable.finalY;
    }

    autoTable(doc, {
        startY: finalY,
        body: [[
            {content: 'GRADE POINT AVERAGE (GPA)', styles: { halign: 'right', fontStyle: 'bold' }},
            {content: gpa.toFixed(2), styles: {halign: 'center', fontStyle: 'bold'}},
        ]],
        theme: 'grid',
        styles: { lineWidth: 0.1, lineColor: 0, fontSize: 11 },
        columnStyles: { 0: { cellWidth: 153 } },
    });
    
    const gpaTableFinalY = (doc as any).lastAutoTable.finalY;

    const summaryData = [
        ['Total Marks', grandTotalFullMarks.toString(), grandTotalObtainedMarks.toFixed(2)],
        ['Percentage', '', `${finalPercentage.toFixed(2)}%`],
        ['Grade', '', finalGradeDetails.grade],
    ];

    autoTable(doc, {
        startY: gpaTableFinalY + 5,
        body: summaryData,
        theme: 'grid',
        tableWidth: 100,
        margin: { left: 15 },
        styles: { lineWidth: 0.1, lineColor: 0, fontSize: 12 },
        columnStyles: {
            0: { fontStyle: 'bold' }
        }
    });
    const summaryBoxFinalY = (doc as any).lastAutoTable.finalY;
    
    if(student.totalAttendance && student.presentAttendance) {
        doc.setFontSize(12);
        doc.setFont("times", "normal");
        doc.text(`ATTENDENCE: ${student.presentAttendance} / ${student.totalAttendance}`, pageWidth - 15, gpaTableFinalY + 15, { align: 'right' });
    }
    
    doc.setFontSize(12);
    const nepaliIssueDate = getNepaliDate(new Date());
    const formattedDate = `${NEPALI_MONTHS[nepaliIssueDate.monthIndex]} ${nepaliIssueDate.day}${getDaySuffix(nepaliIssueDate.day)}, ${nepaliIssueDate.year}`;
    doc.text(`DATE OF ISSUE: ${formattedDate}`, 15, summaryBoxFinalY + 10);

    // --- Footer with Signatures & Seal ---
    const signatureY = pageHeight - 60;
    doc.setFontSize(12);

    doc.line(15, signatureY + 15, 55, signatureY + 15);
    doc.text("Class Teacher", 35, signatureY + 20, { align: 'center' });

    const sealX = pageWidth / 2;
    const sealY = signatureY + 2; 
    
    doc.setLineWidth(0.5);
    doc.circle(sealX, sealY, 12);
    if (logoData) {
        doc.addImage(logoData, 'PNG', sealX - 10, sealY - 10, 20, 20);
    }
    doc.setFontSize(8);
    doc.text("SCHOOL SEAL", sealX, sealY + 15, { align: 'center' });
    doc.setFontSize(12);

    doc.line(pageWidth - 55, signatureY + 15, pageWidth - 15, signatureY + 15);
    doc.text("Principal", pageWidth - 35, signatureY + 20, { align: 'center' });

    // --- Final Note ---
    const noteWidth = pageWidth - 20;
    const notes = "NOTE: ONE CREDIT HOUR EQUAL TO 36 CLOCK HOURS, INTERNAL (IN) THIS COVERS THE PARTICIPATION PRACTICAL PROJECT WORKS COMMUNITY WORKS, INTERNAL PRESCRTATIONS, TERMINAL EXAMINATION, THEORY (TH) THIS COVERS WRITTEN EXAMINATION, ABS. ABSENT, W: WITHHELD";
    
    doc.setFontSize(10);
    doc.setFont('times', 'normal');
    const splitNotes = doc.splitTextToSize(notes, noteWidth - 4);
    
    const lineHeight = doc.getLineHeight() / doc.internal.scaleFactor;
    const noteHeight = (splitNotes.length * lineHeight) + 8;

    const noteY = pageHeight - 12 - noteHeight;

    doc.rect(10, noteY, noteWidth, noteHeight);
    doc.text(splitNotes, 12, noteY + 5);
  }

  const fileName = marksheets.length > 0 && marksheets[0].exam && marksheets[0].class
    ? `results-${marksheets[0].exam.name}-${marksheets[0].class.name}-${Date.now()}.pdf`
    : `results-${Date.now()}.pdf`;

  doc.save(fileName);
}




