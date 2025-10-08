

"use server";

import { Db, ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { Class, Student, Subject, Result, ClassFees, Invoice, InvoiceLineItem, SchoolSettings, Exam, User, PaymentTransaction, StudentBill, ClassMonthlySummary, StudentMarksheet } from '@/lib/types';
import { redirect } from 'next/navigation';
import { getSession, sessionOptions } from './session';
import { cookies } from 'next/headers';
import * as bcrypt from 'bcrypt';
import { generateBillsPdf } from '@/components/pdf-bill';
import { generateMarksheetPdf } from '@/components/pdf-marksheet';
import { generateReceiptPdf } from '@/components/pdf-receipt';

async function getDb(): Promise<Db> {
  const { db } = await connectToDatabase();
  return db;
}

async function getImageDataAsBase64(url: string): Promise<string | null> {
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64 = buffer.toString('base64');
        const mimeType = response.headers.get('content-type') || 'image/png';
        return `data:${mimeType};base64,${base64}`;
    } catch (error) {
        console.error("Failed to fetch and process image on server:", error);
        return null;
    }
}


// --- Auth Management ---
export async function authenticate(prevState: string | undefined, formData: FormData) {
    try {
        const { username, password } = Object.fromEntries(formData);
        const db = await getDb();
        const user = await db.collection('users').findOne({ username: username as string });

        if (!user) {
            return 'Invalid credentials.';
        }

        const passwordsMatch = await bcrypt.compare(password as string, user.passwordHash);

        if (!passwordsMatch) {
            return 'Invalid credentials.';
        }

        const session = await getSession();
        session.isLoggedIn = true;
        session.username = user.username;
        session.role = user.role;
        await session.save();

    } catch (error) {
        if ((error as Error).message.includes('credentialssignin')) {
            return 'Invalid credentials.';
        }
        console.error('Authentication error:', error);
        return 'An unexpected error occurred.';
    }
    redirect('/dashboard');
}

export async function logout() {
    const session = await getSession();
    session.destroy();
    redirect('/');
}


// --- User Management ---
export async function getUsers(): Promise<User[]> {
    const db = await getDb();
    const users = await db.collection('users').find().sort({ username: 1 }).toArray();
    return users.map(u => ({
        id: u._id.toString(),
        username: u.username,
        passwordHash: u.passwordHash,
        role: u.role || 'admin', // default to admin for old users
    }));
}

export async function createUser(formData: FormData): Promise<void> {
    const db = await getDb();
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;

    const existingUser = await db.collection('users').findOne({ username });
    if (existingUser) {
        throw new Error('User with this username already exists.');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await db.collection('users').insertOne({
        username,
        passwordHash,
        role: 'admin', // New users created from UI are admins by default
    });
}

export async function updateUserPassword(userId: string, newPassword: string):Promise<void> {
    if(!ObjectId.isValid(userId)) return;
    const db = await getDb();
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.collection('users').updateOne(
        { _id: new ObjectId(userId) },
        { $set: { passwordHash } }
    );
}

// --- Settings Management ---
export async function getSettings(): Promise<SchoolSettings> {
    const db = await getDb();
    const settings = await db.collection('settings').findOne({ key: 'school' });
    return settings?.data || {};
}

export async function updateSettings(formData: FormData): Promise<void> {
    const db = await getDb();
    
    // Upload logo if present
    const logoFile = formData.get('logo') as File;
    let logoUrl;
    if (logoFile && logoFile.size > 0) {
        const imgbbApiKey = '657a6661a152716e967bd3000b05b701';
        const uploadFormData = new FormData();
        uploadFormData.append('image', logoFile);

        const response = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbApiKey}`, {
            method: 'POST',
            body: uploadFormData,
        });
        const result = await response.json();
        if (result.success) {
            logoUrl = result.data.url;
        } else {
            throw new Error('Failed to upload logo to ImgBB');
        }
    }

    const currentSettings = await getSettings();
    
    const schoolName = formData.get('schoolName') as string;
    const schoolAddress = formData.get('schoolAddress') as string;
    const schoolPhone = formData.get('schoolPhone') as string;
    
    const settingsData: SchoolSettings = {
        schoolName: schoolName || currentSettings.schoolName,
        schoolAddress: schoolAddress || currentSettings.schoolAddress,
        schoolPhone: schoolPhone || currentSettings.schoolPhone,
        schoolLogoUrl: logoUrl || currentSettings.schoolLogoUrl,
    };

    await db.collection('settings').updateOne(
        { key: 'school' },
        { $set: { key: 'school', data: settingsData } },
        { upsert: true }
    );
}


// --- Class Management ---
export async function getClasses(): Promise<Class[]> {
  const db = await getDb();
  const classes = await db.collection('classes').find().sort({ name: 1, section: 1 }).toArray();
  return classes.map(c => ({
    id: c._id.toString(),
    name: c.name,
    section: c.section,
    fees: c.fees || {}
  }));
}

export async function getClassById(classId: string): Promise<Class | null> {
  if (!ObjectId.isValid(classId)) return null;
  const db = await getDb();
  const classData = await db.collection('classes').findOne({ _id: new ObjectId(classId) });
  if (!classData) return null;
  return {
    id: classData._id.toString(),
    name: classData.name,
    section: classData.section,
    fees: classData.fees || {}
  };
}

export async function addClass(formData: FormData): Promise<void> {
  const name = formData.get('name') as string;
  const section = formData.get('section') as string;
  const db = await getDb();
  const defaultFees: ClassFees = {
    registration: 0,
    monthly: 0,
    exam: 0,
    sports: 0,
    music: 0,
    medical: 0,
    tuition: 0,
    stationery: 0,
    tieBelt: 0,
  }
  await db.collection('classes').insertOne({ name, section, fees: defaultFees });
}

export async function updateClass(classId: string, name: string, section: string): Promise<void> {
    if (!ObjectId.isValid(classId)) return;
    const db = await getDb();
    await db.collection('classes').updateOne(
        { _id: new ObjectId(classId) },
        { $set: { name, section } }
    );
}


export async function updateClassFees(classId: string, newFees: Partial<ClassFees>): Promise<void> {
    if (!ObjectId.isValid(classId)) return;
    const db = await getDb();

    const existingClass = await db.collection('classes').findOne({ _id: new ObjectId(classId) });
    
    const currentFees: ClassFees = (existingClass && typeof existingClass.fees === 'object' && existingClass.fees !== null)
      ? { ...existingClass.fees } as ClassFees
      : {
          registration: 0, monthly: 0, exam: 0, sports: 0, music: 0, medical: 0, tuition: 0, stationery: 0, tieBelt: 0
        };
  
    const updatedFees = { ...currentFees, ...newFees };
  
    await db.collection('classes').updateOne(
      { _id: new ObjectId(classId) },
      { $set: { fees: updatedFees } }
    );
}

// --- Student Management ---
export async function getStudents(filters: { classId?: string, name?: string } = {}): Promise<Student[]> {
  const db = await getDb();
  const query: any = {};
  if (filters.classId) {
    if (ObjectId.isValid(filters.classId)) {
        query.classId = new ObjectId(filters.classId);
    } else {
        return [];
    }
  }
  if (filters.name) {
    query.name = { $regex: filters.name, $options: 'i' };
  }

  const students = await db.collection('students').find(query).sort({ rollNumber: 1, name: 1 }).toArray();
  return students.map(s => ({
    id: s._id.toString(),
    sid: s.sid,
    name: s.name,
    rollNumber: s.rollNumber,
    classId: s.classId.toString(),
    address: s.address,
    openingBalance: s.openingBalance || 0,
    inTuition: s.inTuition || false,
    dob: s.dob,
    totalAttendance: s.totalAttendance,
    presentAttendance: s.presentAttendance,
  }));
}

export async function getStudentById(studentId: string): Promise<Student | null> {
    if (!ObjectId.isValid(studentId)) return null;
    const db = await getDb();
    const student = await db.collection('students').findOne({ _id: new ObjectId(studentId) });
    if (!student) return null;
    return {
      id: student._id.toString(),
      sid: student.sid,
      name: student.name,
      rollNumber: student.rollNumber,
      classId: student.classId.toString(),
      address: student.address,
      openingBalance: student.openingBalance || 0,
      inTuition: student.inTuition || false,
      dob: student.dob,
      totalAttendance: student.totalAttendance,
      presentAttendance: student.presentAttendance,
    };
  }
  

export async function addStudent(formData: FormData): Promise<void> {
    const name = formData.get('name') as string;
    const classId = formData.get('classId') as string;
    const address = formData.get('address') as string;
    const rollNumber = formData.get('rollNumber') as string;
    const openingBalance = formData.get('openingBalance') as string;
    const inTuition = formData.get('inTuition') === 'on';
    
    const sid = Math.floor(100000 + Math.random() * 900000).toString();
    
    const db = await getDb();
    await db.collection('students').insertOne({
        sid,
        name,
        rollNumber: Number(rollNumber),
        classId: new ObjectId(classId),
        address,
        openingBalance: Number(openingBalance) || 0,
        inTuition,
    });
}

export async function updateStudent(studentId: string, formData: FormData): Promise<void> {
    if (!ObjectId.isValid(studentId)) return;
    
    const db = await getDb();

    const updateData: Partial<Student> & { classId: ObjectId } = {
        name: formData.get('name') as string,
        rollNumber: Number(formData.get('rollNumber')),
        classId: new ObjectId(formData.get('classId') as string),
        address: formData.get('address') as string,
        openingBalance: Number(formData.get('openingBalance')),
        inTuition: formData.get('inTuition') === 'on',
        dob: formData.get('dob') as string,
    };

    // Clean up undefined fields
    Object.keys(updateData).forEach(key => (updateData[key as keyof typeof updateData] === undefined || isNaN(updateData[key as keyof typeof updateData] as number)) && delete updateData[key as keyof typeof updateData]);

    await db.collection('students').updateOne(
        { _id: new ObjectId(studentId) },
        { $set: updateData }
    );
}

export async function updateStudentAttendance(studentId: string, totalAttendance: number, presentAttendance: number): Promise<void> {
    if (!ObjectId.isValid(studentId)) return;
    const db = await getDb();
    await db.collection('students').updateOne(
        { _id: new ObjectId(studentId) },
        { $set: { totalAttendance, presentAttendance } }
    );
}


// --- Accounting / Invoicing ---

// Helper function to serialize invoices safely
function serializeInvoice(invoice: any): Invoice {
    return {
      id: invoice._id.toString(),
      studentId: invoice.studentId.toString(),
      classId: invoice.classId.toString(),
      month: invoice.month,
      year: invoice.year,
      lineItems: invoice.lineItems.map((li: any) => ({
          feeType: li.feeType,
          amount: li.amount,
      })),
      totalBilled: invoice.totalBilled,
      payments: invoice.payments?.map((p: any) => ({ ...p, date: new Date(p.date).toISOString(), id: p._id.toString() })) || [],
      totalPaid: invoice.totalPaid || 0,
      balance: invoice.balance,
      createdAt: new Date(invoice.createdAt),
    };
  }

export async function getPayments(): Promise<PaymentTransaction[]> {
    const db = await getDb();
    const invoices = await db.collection('invoices').find({ 'payments.0': { $exists: true } }).toArray();
    let allPayments: PaymentTransaction[] = [];
    invoices.forEach(invoice => {
        if(invoice.payments) {
            allPayments = [...allPayments, ...invoice.payments.map((p: any) => ({...p, id: p._id.toString(), date: p.date.toISOString() }))]
        }
    });
    return allPayments;
}
  

export async function getInvoicesForStudent(studentId: string): Promise<Invoice[]> {
    const db = await getDb();
    if (!ObjectId.isValid(studentId)) return [];
    const invoicesData = await db.collection('invoices').find({ studentId: new ObjectId(studentId) }).sort({ year: -1, createdAt: -1 }).toArray();
    return invoicesData.map(serializeInvoice);
}

export async function getInvoiceForMonth(studentId: string, month: string, year: number): Promise<Invoice | null> {
    if (!ObjectId.isValid(studentId)) return null;
    const db = await getDb();
    const invoiceData = await db.collection('invoices').findOne({ 
        studentId: new ObjectId(studentId),
        month: month,
        year: year
    });

    if (!invoiceData) return null;

    return serializeInvoice(invoiceData);
}

export async function getLatestInvoice(studentId: string): Promise<Invoice | null> {
    const invoices = await getInvoicesForStudent(studentId);
    return invoices.length > 0 ? invoices[0] : null;
}

export async function createOrUpdateInvoice(
    studentId: string,
    classId: string,
    month: string,
    year: number,
    chargedFees: { feeType: string; amount: number }[],
    medicalFee: number
  ): Promise<string> {
    const db = await getDb();
    const studentObjectId = new ObjectId(studentId);
  
    const student = await db.collection('students').findOne({ _id: studentObjectId });
    if (!student) throw new Error("Student not found");
    const sClass = await db.collection('classes').findOne({ _id: new ObjectId(classId) });
    if (!sClass) throw new Error("Class not found");

    const previousInvoice = await db.collection('invoices')
      .findOne(
        { studentId: studentObjectId },
        { sort: { year: -1, createdAt: -1 } }
      );
    
    const previousBalance = previousInvoice ? previousInvoice.balance : (student?.openingBalance || 0);

    const lineItems: InvoiceLineItem[] = [];
    
    chargedFees.forEach(fee => {
      lineItems.push({ feeType: fee.feeType, amount: fee.amount });
    });
    
    // Automatically add tuition fee if the student is in tuition
    if (student.inTuition && sClass.fees.tuition > 0 && !chargedFees.some(f => f.feeType === 'tuition')) {
        lineItems.push({ feeType: 'tuition', amount: sClass.fees.tuition });
    }

    if (medicalFee > 0) {
      lineItems.push({ feeType: 'Medical', amount: medicalFee });
    }
  
    const currentMonthFeesTotal = lineItems.reduce((acc, item) => acc + item.amount, 0);

    // Filter out old Previous Dues before adding new one
    const filteredLineItems = lineItems.filter(item => item.feeType !== 'Previous Dues');
    
    if (previousBalance > 0) { // Only add previous dues if there is a balance
      filteredLineItems.unshift({ feeType: 'Previous Dues', amount: previousBalance });
    }
  
    const totalBilled = currentMonthFeesTotal + (previousBalance > 0 ? previousBalance : 0);
  
    const existingInvoice = await db.collection('invoices').findOne({ studentId: studentObjectId, month, year });
  
    if (existingInvoice) {
      const newBalance = totalBilled - existingInvoice.totalPaid;
      await db.collection('invoices').updateOne(
        { _id: existingInvoice._id },
        {
          $set: {
            lineItems: filteredLineItems,
            totalBilled,
            balance: newBalance,
            createdAt: new Date(),
          }
        }
      );
      return existingInvoice._id.toString();
    } else {
      const result = await db.collection('invoices').insertOne({
        studentId: studentObjectId,
        classId: new ObjectId(classId),
        month,
        year,
        lineItems: filteredLineItems,
        totalBilled,
        totalPaid: 0,
        balance: totalBilled,
        createdAt: new Date(),
        payments: [],
      });
      return result.insertedId.toString();
    }
}

export async function bulkCreateInvoices(
    classId: string,
    month: string,
    year: number,
    chargedFees: { feeType: string; amount: number }[]
  ): Promise<{ created: number; updated: number }> {
    const students = await getStudents({ classId });
    let createdCount = 0;
    let updatedCount = 0;
    const db = await getDb();

    for (const student of students) {
        const existingInvoice = await db.collection('invoices').findOne({ studentId: new ObjectId(student.id), month, year });
        await createOrUpdateInvoice(student.id, classId, month, year, chargedFees, 0);
        if (existingInvoice) {
            updatedCount++;
        } else {
            createdCount++;
        }
    }

    return { created: createdCount, updated: updatedCount };
}
  
export async function addPayment(studentId: string, invoiceId: string, amount: number): Promise<PaymentTransaction> {
    const db = await getDb();
    const invoiceObjectId = new ObjectId(invoiceId);
  
    const paymentRecord: PaymentTransaction = {
        id: new ObjectId().toString(),
        amount,
        date: new Date(),
    };

    const result = await db.collection('invoices').updateOne(
        { _id: invoiceObjectId },
        {
            $inc: {
                totalPaid: amount,
                balance: -amount,
            },
            $push: {
                payments: {
                    _id: new ObjectId(paymentRecord.id),
                    amount: paymentRecord.amount,
                    date: paymentRecord.date,
                }
            }
        }
    );

    if (result.modifiedCount === 0) {
        throw new Error("Failed to find and update the invoice.");
    }
    
    const studentObjectId = new ObjectId(studentId);
    const updatedInvoice = await db.collection('invoices').findOne({ _id: invoiceObjectId });
    if (!updatedInvoice) throw new Error("Could not retrieve updated invoice");
    
    // Find all invoices for the student that were created AFTER the one that was just paid.
    const subsequentInvoices = await db.collection('invoices').find({
        studentId: studentObjectId,
        createdAt: { $gt: updatedInvoice.createdAt }
    }).toArray();

    // The logic here should be to update the 'Previous Dues' line item and recalculate totals.
    // A simple increment on the balance can lead to inconsistencies.
    for (const inv of subsequentInvoices) {
        const oldPreviousDuesItem = inv.lineItems.find((li: InvoiceLineItem) => li.feeType === 'Previous Dues');
        const oldPreviousDues = oldPreviousDuesItem ? oldPreviousDuesItem.amount : 0;
        
        // The new "previous dues" for this subsequent invoice is the balance of the *just paid* invoice.
        // We need to find the invoice right before `inv`.
        const invoiceBeforeThisOne = await db.collection('invoices').findOne(
            { studentId: studentObjectId, createdAt: { $lt: inv.createdAt } },
            { sort: { createdAt: -1 } }
        );

        const newPreviousDues = invoiceBeforeThisOne ? invoiceBeforeThisOne.balance : 0;

        const newFilteredLineItems = inv.lineItems.filter((li: InvoiceLineItem) => li.feeType !== 'Previous Dues');
        if (newPreviousDues > 0) {
            newFilteredLineItems.unshift({ feeType: 'Previous Dues', amount: newPreviousDues });
        }
        
        const currentMonthFeesTotal = inv.lineItems
            .filter((li: InvoiceLineItem) => li.feeType !== 'Previous Dues')
            .reduce((acc: number, item: InvoiceLineItem) => acc + item.amount, 0);

        const newTotalBilled = currentMonthFeesTotal + (newPreviousDues > 0 ? newPreviousDues : 0);
        const newBalance = newTotalBilled - inv.totalPaid;

        await db.collection('invoices').updateOne(
            { _id: inv._id },
            {
                $set: {
                    lineItems: newFilteredLineItems,
                    totalBilled: newTotalBilled,
                    balance: newBalance
                }
            }
        );
    }
    return paymentRecord;
}

export async function checkInvoicesExistForMonth(classId: string, month: string, year: number): Promise<boolean> {
    if (!ObjectId.isValid(classId)) return false;
    const db = await getDb();
    const count = await db.collection('invoices').countDocuments({
        classId: new ObjectId(classId),
        month: month,
        year: year
    });
    return count > 0;
}


export async function generateAndDownloadBulkInvoices(
    classId: string,
    month: string,
    year: number,
    chargedFees: { feeType: string; amount: number }[]
) {
    const students = await getStudents({ classId });
    const settings = await getSettings();
    const studentClass = await getClassById(classId);

    if (!studentClass) {
        throw new Error("Class details not found.");
    }
    
    const logoBase64 = settings.schoolLogoUrl ? await getImageDataAsBase64(settings.schoolLogoUrl) : null;

    const bills: StudentBill[] = [];

    for (const student of students) {
        await createOrUpdateInvoice(student.id, classId, month, year, chargedFees, 0);
        const invoice = await getInvoiceForMonth(student.id, month, year);

        if (invoice) {
            const previousDues = invoice.lineItems.find(li => li.feeType === 'Previous Dues')?.amount || 0;
            bills.push({
                school: settings,
                student: student,
                class: studentClass,
                invoice: invoice,
                previousDues,
            });
        }
    }

    if (bills.length > 0) {
        await generateBillsPdf(bills, logoBase64);

    } else {
        throw new Error("No students found or no invoices could be generated.");
    }
}

// --- OPTIMIZED Accounting ---
export async function getFeeSummaryForClass(classId: string, month: string, year: number): Promise<{ summaries: any[], monthlySummary: ClassMonthlySummary }> {
    const db = await getDb();
    if (!ObjectId.isValid(classId)) return { summaries: [], monthlySummary: { totalBilled: 0, totalCollected: 0, totalDues: 0 } };

    const studentClass = await getClassById(classId);
    if (!studentClass) return { summaries: [], monthlySummary: { totalBilled: 0, totalCollected: 0, totalDues: 0 } };

    const students = await getStudents({ classId });
    const studentIds = students.map(s => new ObjectId(s.id));

    // Fetch all relevant invoices in one go
    const allInvoices = await db.collection('invoices').find({ studentId: { $in: studentIds } }).sort({ createdAt: -1 }).toArray();

    let totalBilledMonth = 0;
    let totalCollectedMonth = 0;

    const summaries = students.map(student => {
        // Find invoices for this student from the prefetched list
        const studentInvoices = allInvoices.filter(inv => inv.studentId.toString() === student.id);
        const invoiceForMonth = studentInvoices.find(inv => inv.month === month && inv.year === year);
        const latestInvoiceOverall = studentInvoices.length > 0 ? studentInvoices[0] : null;

        const overallBalance = latestInvoiceOverall ? latestInvoiceOverall.balance : (student.openingBalance || 0);

        let status: 'Paid' | 'Partial' | 'Unpaid' | 'Overpaid';
        if(invoiceForMonth){
            if (invoiceForMonth.balance <= 0) {
                status = 'Paid';
                if (invoiceForMonth.balance < 0) status = 'Overpaid';
            } else if (invoiceForMonth.totalPaid > 0) {
                status = 'Partial';
            } else {
                status = 'Unpaid';
            }
        } else {
            status = 'Unpaid';
        }


        if (invoiceForMonth) {
            totalBilledMonth += invoiceForMonth.lineItems.reduce((acc: number, item: InvoiceLineItem) => item.feeType !== 'Previous Dues' ? acc + item.amount : acc, 0);
            totalCollectedMonth += invoiceForMonth.totalPaid;
        }

        return {
            student,
            class: studentClass,
            latestInvoice: invoiceForMonth ? serializeInvoice(invoiceForMonth) : null,
            overallBalance,
            status,
        };
    });

    const totalDuesMonth = summaries.reduce((acc, s) => {
        if (s.latestInvoice) {
            return acc + s.latestInvoice.balance;
        }
        return acc + s.overallBalance;
    }, 0);

    const monthlySummary = { totalBilled: totalBilledMonth, totalCollected: totalCollectedMonth, totalDues: totalDuesMonth };

    return { summaries, monthlySummary };
}

export async function getOverallFeeSummary(): Promise<ClassFeeSummary[]> {
    const db = await getDb();
    
    // Fetch all data in parallel
    const [classesData, studentsData, allInvoicesData] = await Promise.all([
      getClasses(),
      getStudents(),
      db.collection('invoices').find().sort({ createdAt: -1 }).toArray()
    ]);
    
    // Group students and invoices for efficient lookup
    const studentsByClass = studentsData.reduce((acc, student) => {
        (acc[student.classId] = acc[student.classId] || []).push(student);
        return acc;
    }, {} as Record<string, Student[]>);

    const latestInvoicesByStudent = allInvoicesData.reduce((acc, invoice) => {
        const studentId = invoice.studentId.toString();
        if (!acc[studentId]) {
            acc[studentId] = invoice;
        }
        return acc;
    }, {} as Record<string, any>);


    const summaries: ClassFeeSummary[] = classesData.map(c => {
        const studentsInClass = studentsByClass[c.id] || [];
        
        let totalBilled = 0;
        let totalCollected = 0;
        let totalDues = 0;

        for (const student of studentsInClass) {
            const latestInvoice = latestInvoicesByStudent[student.id];
            if (latestInvoice) {
                totalBilled += latestInvoice.totalBilled;
                totalCollected += latestInvoice.totalPaid;
                totalDues += latestInvoice.balance;
            } else {
                 totalDues += student.openingBalance || 0;
            }
        }
        
        return {
            class: c,
            totalBilled,
            totalCollected,
            totalDues,
        };
    });
    
    return summaries;
}


// --- Exam Management ---
export async function getExams(): Promise<Exam[]> {
    const db = await getDb();
    const exams = await db.collection('exams').find().sort({ date: -1 }).toArray();
    return exams.map(e => ({
        id: e._id.toString(),
        name: e.name,
        date: new Date(e.date),
    }));
}

export async function getExamById(examId: string): Promise<Exam | null> {
    if (!ObjectId.isValid(examId)) return null;
    const db = await getDb();
    const exam = await db.collection('exams').findOne({ _id: new ObjectId(examId) });
    if (!exam) return null;
    return {
        id: exam._id.toString(),
        name: exam.name,
        date: new Date(exam.date),
    };
}

export async function addExam(formData: FormData): Promise<void> {
    const db = await getDb();
    const name = formData.get('name') as string;
    const date = formData.get('date') as string;
    await db.collection('exams').insertOne({
        name,
        date: new Date(date),
    });
}


// --- Subject & Result Management ---
export async function getSubjects(filters: { classId?: string } = {}): Promise<Subject[]> {
  const db = await getDb();
  const query: any = {};
  if (filters.classId) {
    if (ObjectId.isValid(filters.classId)) {
        query.classId = new ObjectId(filters.classId);
    } else {
        return [];
    }
  }
  const subjects = await db.collection('subjects').find(query).toArray();
  return subjects.map(s => ({
    id: s._id.toString(),
    name: s.name,
    classId: s.classId.toString(),
    fullMarksTheory: s.fullMarksTheory || 100,
    fullMarksPractical: s.fullMarksPractical || 0,
    code: s.code || '',
    isExtra: s.isExtra || false,
  }));
}

export async function addSubject(classId: string, name: string, fullMarksTheory: number, fullMarksPractical: number, code: string, isExtra: boolean): Promise<void> {
    if (!ObjectId.isValid(classId)) return;
    const db = await getDb();
    await db.collection('subjects').insertOne({
        name,
        classId: new ObjectId(classId),
        fullMarksTheory,
        fullMarksPractical,
        code,
        isExtra,
    });
}

export async function updateSubject(subjectId: string, name: string, fullMarksTheory: number, fullMarksPractical: number, code: string, isExtra: boolean): Promise<void> {
    if (!ObjectId.isValid(subjectId)) return;
    const db = await getDb();
    await db.collection('subjects').updateOne(
        { _id: new ObjectId(subjectId) },
        {
            $set: {
                name,
                code,
                isExtra,
            }
        }
    );
}

export async function deleteSubject(subjectId: string): Promise<void> {
    if (!ObjectId.isValid(subjectId)) return;
    const db = await getDb();
    await db.collection('subjects').deleteOne({ _id: new ObjectId(subjectId) });
    // Also delete associated results
    await db.collection('results').deleteMany({ subjectId: new ObjectId(subjectId) });
}


export async function getResultsForExam(examId: string): Promise<Result[]> {
  if (!ObjectId.isValid(examId)) return [];
  const db = await getDb();
  const results = await db.collection('results').find({ examId: new ObjectId(examId) }).toArray();
  return results.map(r => ({
    id: r._id.toString(),
    examId: r.examId.toString(),
    studentId: r.studentId.toString(),
    subjectId: r.subjectId.toString(),
    theoryMarks: r.theoryMarks,
    practicalMarks: r.practicalMarks
  }));
}

export async function addOrUpdateResult(examId: string, studentId: string, subjectId: string, theoryMarks: number, practicalMarks: number): Promise<void> {
    if (!ObjectId.isValid(examId) || !ObjectId.isValid(studentId) || !ObjectId.isValid(subjectId)) return;
    const db = await getDb();

    await db.collection('results').updateOne(
        { examId: new ObjectId(examId), studentId: new ObjectId(studentId), subjectId: new ObjectId(subjectId) },
        {
            $set: {
                theoryMarks,
                practicalMarks,
            }
        },
        { upsert: true }
    );
}

// --- Data for Marksheet ---
export async function getMarksheetDataForClass(examId: string, classId: string): Promise<StudentMarksheet[]> {
    if (!ObjectId.isValid(examId) || !ObjectId.isValid(classId)) return [];

    const [exam, studentClass, students, subjects, results] = await Promise.all([
        getExamById(examId),
        getClassById(classId),
        getStudents({ classId }),
        getSubjects({ classId }),
        getResultsForExam(examId),
    ]);

    if (!exam || !studentClass) return [];
    
    return students.map(student => {
        const studentResults = results.filter(r => r.studentId === student.id);
        
        const mergedResults = studentResults.map(res => {
            const subject = subjects.find(s => s.id === res.subjectId);
            return { ...res, ...(subject || {}) } as Result & Subject;
        }).filter(r => r.name); // Filter out if subject not found

        return {
            student,
            class: studentClass,
            exam,
            results: mergedResults,
        };
    });
}

    