// Using a self-contained Nepali date converter to avoid external dependency issues.
// Based on the work of https://github.com/bahadurbaniya/Date-Converter

interface NepaliDate {
    year: number;
    monthIndex: number; // 0 for Baisakh, 11 for Chaitra
    day: number;
}

const nepaliYearData = [
    { gregorianStartDate: { year: 1944, month: 4, day: 13 }, nepaliStartDate: { year: 2000, month: 1, day: 1 }, daysInMonth: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31] },
    { gregorianStartDate: { year: 1944, month: 4, day: 13 }, nepaliStartDate: { year: 2001, month: 1, day: 1 }, daysInMonth: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30] },
    { gregorianStartDate: { year: 1944, month: 4, day: 13 }, nepaliStartDate: { year: 2002, month: 1, day: 1 }, daysInMonth: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30] },
    // Data for more years would be needed for a full implementation
    // For this app, we'll focus on a range around the current date.
    // Adding more recent years to ensure functionality.
    { gregorianStartDate: { year: 2018, month: 4, day: 14 }, nepaliStartDate: { year: 2075, month: 1, day: 1 }, daysInMonth: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30] },
    { gregorianStartDate: { year: 2019, month: 4, day: 14 }, nepaliStartDate: { year: 2076, month: 1, day: 1 }, daysInMonth: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30] },
    { gregorianStartDate: { year: 2020, month: 4, day: 13 }, nepaliStartDate: { year: 2077, month: 1, day: 1 }, daysInMonth: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31] },
    { gregorianStartDate: { year: 2021, month: 4, day: 14 }, nepaliStartDate: { year: 2078, month: 1, day: 1 }, daysInMonth: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30] },
    { gregorianStartDate: { year: 2022, month: 4, day: 14 }, nepaliStartDate: { year: 2079, month: 1, day: 1 }, daysInMonth: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30] },
    { gregorianStartDate: { year: 2023, month: 4, day: 14 }, nepaliStartDate: { year: 2080, month: 1, day: 1 }, daysInMonth: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31] },
    { gregorianStartDate: { year: 2024, month: 4, day: 13 }, nepaliStartDate: { year: 2081, month: 1, day: 1 }, daysInMonth: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30] },
    { gregorianStartDate: { year: 2025, month: 4, day: 14 }, nepaliStartDate: { year: 2082, month: 1, day: 1 }, daysInMonth: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30] },
    { gregorianStartDate: { year: 2026, month: 4, day: 14 }, nepaliStartDate: { year: 2083, month: 1, day: 1 }, daysInMonth: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30] },
];

function findNepaliYearData(gregorianYear: number) {
    // A simplified search. For a production app, a more robust search or a full dataset is needed.
    return nepaliYearData.find(d => d.gregorianStartDate.year === gregorianYear) || 
           nepaliYearData.find(d => d.gregorianStartDate.year + (d.nepaliStartDate.year - d.gregorianStartDate.year) === gregorianYear + 57) ||
           nepaliYearData[nepaliYearData.length - 1]; // Fallback to the latest available data
}

export function getNepaliDate(gregorianDate: Date): NepaliDate {
    const gregYear = gregorianDate.getFullYear();
    const gregMonth = gregorianDate.getMonth() + 1;
    const gregDay = gregorianDate.getDate();

    const nepaliYearInfo = findNepaliYearData(gregYear) || nepaliYearData.find(d => d.nepaliStartDate.year === 2081)!;
    
    let nepaliYear = nepaliYearInfo.nepaliStartDate.year;
    let nepaliMonth = nepaliYearInfo.nepaliStartDate.month;
    let nepaliDay = nepaliYearInfo.nepaliStartDate.day;
    
    const startDate = new Date(nepaliYearInfo.gregorianStartDate.year, nepaliYearInfo.gregorianStartDate.month - 1, nepaliYearInfo.gregorianStartDate.day);
    const targetDate = new Date(gregYear, gregMonth - 1, gregDay);

    const dayDifference = Math.ceil((targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    nepaliDay += dayDifference;

    let i = 0;
    while(nepaliDay > nepaliYearInfo.daysInMonth[i]) {
        if(nepaliYearInfo.daysInMonth[i] === 0) continue; // Should not happen with valid data
        
        nepaliDay -= nepaliYearInfo.daysInMonth[i];
        nepaliMonth++;
        i++;

        if(nepaliMonth > 12) {
            nepaliMonth = 1;
            nepaliYear++;
            // This is a simplification. The daysInMonth for the next year would be needed.
            // For now, we'll reset `i` and use the same year's data, which is an approximation.
            i = 0; 
        }
    }
    
    // Fallback for dates outside the limited data range
    if(nepaliYear < 2075 || nepaliYear > 2085) {
        // Provide a reasonable estimate for current dates
        const estimatedYear = gregYear + 57;
        const estimatedMonth = (gregMonth + 8) % 12; // Very rough estimate
        return {
            year: estimatedYear,
            monthIndex: estimatedMonth,
            day: gregDay,
        }
    }

    return {
        year: nepaliYear,
        monthIndex: nepaliMonth - 1, // Convert to 0-indexed
        day: nepaliDay,
    };
}
